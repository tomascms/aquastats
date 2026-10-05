-- Migration 011: the API's own least-privilege role, and row-level security that actually applies.
--
-- Why: aquastats_app was created in the Neon console, so Neon made it a member of neon_superuser
-- (pg_read_all_data, pg_write_all_data) with BYPASSRLS, CREATEROLE and CREATEDB. Every policy of 002/009/010
-- was skipped for it and the revokes of 010 had no effect. aquastats_api is created here, by SQL, so it is an
-- ordinary role. It cannot log in until an operator gives it a password outside the repository:
--     ALTER ROLE aquastats_api LOGIN PASSWORD '<from the secret store>';
-- The API refuses to start in production with a role that bypasses RLS (core/startup.py).
--
-- What it also does:
--   * swimmers only see their own rows in athlete data (app.role = 'swimmer' + app.athlete_id), not the
--     whole team: the API used to load the team and filter in Python;
--   * FORCE row level security everywhere (production had it on 18 tables, set by hand);
--   * defensive RLS on the authentication tables: only the auth flows (app.bypass_rls) or the user's own rows;
--   * prediction_ledger: maintenance switch only for the owner, never for the API role;
--   * updated_at triggers that production was missing (attendance_sessions, race_sessions, season_plans).
-- Idempotent: safe to run again, and to run on a database that already has 001–010.

-- ── Context helpers ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_role() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.role', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_athlete_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.athlete_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- A swimmer sees only their own athlete rows; coaches see their whole team.
CREATE OR REPLACE FUNCTION app_sees_athlete(athlete uuid) RETURNS boolean AS $$
  SELECT app_role() IS DISTINCT FROM 'swimmer' OR athlete = app_athlete_id();
$$ LANGUAGE sql STABLE;

-- ── The role ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aquastats_api') THEN
    CREATE ROLE aquastats_api NOLOGIN;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aquastats_api', current_database());
END$$;
-- Re-asserted on every run, whatever someone changed by hand.
ALTER ROLE aquastats_api NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE aquastats_api SET statement_timeout = '30s';
ALTER ROLE aquastats_api SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE aquastats_api SET lock_timeout = '10s';

GRANT USAGE ON SCHEMA public TO aquastats_api;
REVOKE CREATE ON SCHEMA public FROM aquastats_api;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM aquastats_api;

-- Table by table: what the API does (tests/postgres/test_rls_matrix.py fails if a table is missing here).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, teams, users, oauth_accounts, refresh_tokens, password_reset_tokens, email_verification_tokens,
  profiles, team_members, team_invites, athletes, workouts, time_logs, competitions, meet_entries, meet_results,
  race_sessions, season_plans, attendance_sessions, idempotency_keys, outbox_events, personal_records, goals,
  hr_sessions, polar_links
TO aquastats_api;
GRANT SELECT, INSERT, UPDATE ON saga_instances, saga_logs TO aquastats_api;
-- Audit rows are never edited; they are deleted only with the account they belong to (right to erasure).
GRANT SELECT, INSERT, DELETE ON audit_logs TO aquastats_api;
-- Predictions are append-only; deletions only come from cascades (athlete, workout, team, account).
GRANT SELECT, INSERT ON prediction_ledger TO aquastats_api;
-- Not granted: schema_migrations (the API does not migrate production), oauth_states (unused).

-- ── Athlete data: team, and for swimmers only their own rows ─────────────────
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS athletes_team ON athletes;
CREATE POLICY athletes_team ON athletes
  USING (app_bypass_rls() OR (team_id = app_team_id() AND app_sees_athlete(id)))
  WITH CHECK (app_bypass_rls() OR (team_id = app_team_id() AND app_sees_athlete(id)));

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_logs_team ON time_logs;
CREATE POLICY time_logs_team ON time_logs
  USING (app_bypass_rls() OR (workout_id IN (SELECT id FROM workouts WHERE team_id = app_team_id()) AND app_sees_athlete(athlete_id)))
  WITH CHECK (app_bypass_rls() OR (workout_id IN (SELECT id FROM workouts WHERE team_id = app_team_id()) AND app_sees_athlete(athlete_id)));

ALTER TABLE meet_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meet_entries_team ON meet_entries;
CREATE POLICY meet_entries_team ON meet_entries
  USING (app_bypass_rls() OR (competition_id IN (SELECT id FROM competitions WHERE team_id = app_team_id()) AND app_sees_athlete(athlete_id)))
  WITH CHECK (app_bypass_rls() OR (competition_id IN (SELECT id FROM competitions WHERE team_id = app_team_id()) AND app_sees_athlete(athlete_id)));

-- meet_results follow their entry (the subquery is itself filtered by meet_entries' policy).
ALTER TABLE meet_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meet_results_team ON meet_results;
CREATE POLICY meet_results_team ON meet_results
  USING (app_bypass_rls() OR entry_id IN (SELECT me.id FROM meet_entries me JOIN competitions c ON c.id = me.competition_id WHERE c.team_id = app_team_id()))
  WITH CHECK (app_bypass_rls() OR entry_id IN (SELECT me.id FROM meet_entries me JOIN competitions c ON c.id = me.competition_id WHERE c.team_id = app_team_id()));

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS personal_records_team ON personal_records;
CREATE POLICY personal_records_team ON personal_records
  USING (app_bypass_rls() OR (athlete_id IN (SELECT id FROM athletes WHERE team_id = app_team_id()) AND app_sees_athlete(athlete_id)))
  WITH CHECK (app_bypass_rls() OR (athlete_id IN (SELECT id FROM athletes WHERE team_id = app_team_id()) AND app_sees_athlete(athlete_id)));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['race_sessions', 'goals', 'hr_sessions', 'polar_links', 'prediction_ledger'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_bypass_rls() OR (team_id = app_team_id() AND app_sees_athlete(athlete_id))) '
      'WITH CHECK (app_bypass_rls() OR (team_id = app_team_id() AND app_sees_athlete(athlete_id)))',
      t || '_team', t);
  END LOOP;
END$$;

-- ── Coach-only team tables: audit trail (IPs, user agents), pending invites (third parties' emails), outbox ──
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_org ON audit_logs;
CREATE POLICY audit_logs_org ON audit_logs
  USING (app_bypass_rls() OR (app_role() = 'coach' AND organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id())))
  WITH CHECK (app_bypass_rls() OR organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id()));

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_events_org ON outbox_events;
CREATE POLICY outbox_events_org ON outbox_events
  USING (app_bypass_rls() OR (app_role() = 'coach' AND organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id())))
  WITH CHECK (app_bypass_rls() OR organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id()));

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_invites_team ON team_invites;
CREATE POLICY team_invites_team ON team_invites
  USING (app_bypass_rls() OR (app_role() = 'coach' AND team_id = app_team_id()))
  WITH CHECK (app_bypass_rls() OR (app_role() = 'coach' AND team_id = app_team_id()));

-- ── Authentication tables: auth flows only, or the user's own rows ───────────
-- users: yourself; a coach also sees the team's accounts; a swimmer only the coaches (never teammates' emails).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self_or_team ON users;
CREATE POLICY users_self_or_team ON users
  USING (app_bypass_rls() OR id = app_user_id() OR id IN (
    SELECT user_id FROM team_members
    WHERE team_id = app_team_id() AND (app_role() IS DISTINCT FROM 'swimmer' OR status IN ('owner', 'coach'))))
  WITH CHECK (app_bypass_rls() OR id = app_user_id());

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['oauth_accounts', 'refresh_tokens', 'password_reset_tokens', 'email_verification_tokens'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_self', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (app_bypass_rls() OR user_id = app_user_id()) WITH CHECK (app_bypass_rls() OR user_id = app_user_id())', t || '_self', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['oauth_states', 'saga_instances', 'saga_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_system', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (app_bypass_rls()) WITH CHECK (app_bypass_rls())', t || '_system', t);
  END LOOP;
END$$;

-- ── FORCE everywhere RLS is on (owners are bound too, unless they have BYPASSRLS) ──
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END$$;

-- ── Ledger maintenance switch: owner only ─────────────────────────────────────
CREATE OR REPLACE FUNCTION prediction_ledger_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- pg_trigger_depth() > 1: the change comes from a foreign-key cascade (workout, athlete, team or account
  -- deleted), not from someone editing a prediction.
  IF pg_trigger_depth() > 1 THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  -- Any role can set a custom setting, so the switch only counts for roles other than the API's.
  IF coalesce(current_setting('aquastats.ledger_maintenance', true), '') = 'on'
     AND NOT pg_has_role(current_user, 'aquastats_api', 'MEMBER') THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'prediction_ledger is append-only';
END;
$$;

-- ── updated_at triggers missing in production ────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance_sessions', 'race_sessions', 'season_plans'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at()', t);
  END LOOP;
END$$;
