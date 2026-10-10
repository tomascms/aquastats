-- Migration 012: a separate role for the authentication flows, and the only one that may skip RLS.
--
-- Until now "app.bypass_rls = true" was a session setting: any role can set it, so SQL injected into an
-- ordinary request could have switched isolation off. Now the bypass also requires the session's role to be
-- aquastats_auth. The API keeps two connections: aquastats_api for every team request (cannot bypass, even
-- if it sets the flag) and aquastats_auth only for login, signup, tokens, invites and account deletion.
-- Like aquastats_api, it logs in only once an operator sets its password outside the repository:
--     ALTER ROLE aquastats_auth LOGIN PASSWORD '<from the secret store>';
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aquastats_auth') THEN
    CREATE ROLE aquastats_auth NOLOGIN;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aquastats_auth', current_database());
END$$;
ALTER ROLE aquastats_auth NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE aquastats_auth SET statement_timeout = '30s';
ALTER ROLE aquastats_auth SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE aquastats_auth SET lock_timeout = '10s';

GRANT USAGE ON SCHEMA public TO aquastats_auth;
REVOKE CREATE ON SCHEMA public FROM aquastats_auth;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM aquastats_auth;
-- Account deletion removes everything that was the user's, in any team, and hands over what they created
-- for others: the auth role needs to read and delete across teams. Still no DDL, no ledger edits.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, teams, users, oauth_accounts, refresh_tokens, password_reset_tokens, email_verification_tokens,
  profiles, team_members, team_invites, athletes, workouts, time_logs, competitions, meet_entries, meet_results,
  race_sessions, season_plans, attendance_sessions, idempotency_keys, outbox_events, personal_records, goals,
  hr_sessions, polar_links, saga_instances, saga_logs
TO aquastats_auth;
GRANT SELECT, INSERT, DELETE ON audit_logs TO aquastats_auth;
GRANT SELECT ON prediction_ledger TO aquastats_auth;

-- The bypass now needs both the flag and the auth role. Superusers and BYPASSRLS owners skip RLS anyway.
CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), '') = 'true'
     AND pg_has_role(current_user, 'aquastats_auth', 'MEMBER');
$$ LANGUAGE sql STABLE;

-- Before a request knows its team it identifies the user (signed session): their own memberships and athlete
-- rows are readable, so the API role no longer needs the bypass to find which team a user belongs to.
DROP POLICY IF EXISTS team_members_team ON team_members;
CREATE POLICY team_members_team ON team_members
  USING (app_bypass_rls() OR team_id = app_team_id() OR user_id = app_user_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

DROP POLICY IF EXISTS athletes_team ON athletes;
CREATE POLICY athletes_team ON athletes
  USING (app_bypass_rls() OR (team_id = app_team_id() AND app_sees_athlete(id)) OR user_id = app_user_id())
  WITH CHECK (app_bypass_rls() OR (team_id = app_team_id() AND app_sees_athlete(id)));
