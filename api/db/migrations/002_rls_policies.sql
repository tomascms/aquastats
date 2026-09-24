-- Migration 002: Row Level Security policies (defense in depth with aquastats_app role)
-- Policies allow access when app.bypass_rls=true (auth bootstrap) OR tenant matches.

-- ── Direct team_id tables ────────────────────────────────────────────────────

ALTER TABLE IF EXISTS athletes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS athletes_team ON athletes;
CREATE POLICY athletes_team ON athletes
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workouts_team ON workouts;
CREATE POLICY workouts_team ON workouts
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS competitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS competitions_team ON competitions;
CREATE POLICY competitions_team ON competitions
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS race_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS race_sessions_team ON race_sessions;
CREATE POLICY race_sessions_team ON race_sessions
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS season_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS season_plans_team ON season_plans;
CREATE POLICY season_plans_team ON season_plans
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS attendance_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_sessions_team ON attendance_sessions;
CREATE POLICY attendance_sessions_team ON attendance_sessions
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_members_team ON team_members;
CREATE POLICY team_members_team ON team_members
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS team_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_invites_team ON team_invites;
CREATE POLICY team_invites_team ON team_invites
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teams_self ON teams;
CREATE POLICY teams_self ON teams
  USING (app_bypass_rls() OR id = app_team_id())
  WITH CHECK (app_bypass_rls() OR id = app_team_id());

-- ── Child tables (via parent team) ───────────────────────────────────────────

ALTER TABLE IF EXISTS time_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_logs_team ON time_logs;
CREATE POLICY time_logs_team ON time_logs
  USING (
    app_bypass_rls()
    OR workout_id IN (SELECT id FROM workouts WHERE team_id = app_team_id())
  )
  WITH CHECK (
    app_bypass_rls()
    OR workout_id IN (SELECT id FROM workouts WHERE team_id = app_team_id())
  );

ALTER TABLE IF EXISTS meet_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meet_entries_team ON meet_entries;
CREATE POLICY meet_entries_team ON meet_entries
  USING (
    app_bypass_rls()
    OR competition_id IN (SELECT id FROM competitions WHERE team_id = app_team_id())
  )
  WITH CHECK (
    app_bypass_rls()
    OR competition_id IN (SELECT id FROM competitions WHERE team_id = app_team_id())
  );

ALTER TABLE IF EXISTS meet_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meet_results_team ON meet_results;
CREATE POLICY meet_results_team ON meet_results
  USING (
    app_bypass_rls()
    OR entry_id IN (
      SELECT me.id FROM meet_entries me
      JOIN competitions c ON c.id = me.competition_id
      WHERE c.team_id = app_team_id()
    )
  )
  WITH CHECK (
    app_bypass_rls()
    OR entry_id IN (
      SELECT me.id FROM meet_entries me
      JOIN competitions c ON c.id = me.competition_id
      WHERE c.team_id = app_team_id()
    )
  );

ALTER TABLE IF EXISTS personal_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS personal_records_team ON personal_records;
CREATE POLICY personal_records_team ON personal_records
  USING (
    app_bypass_rls()
    OR athlete_id IN (SELECT id FROM athletes WHERE team_id = app_team_id())
  )
  WITH CHECK (
    app_bypass_rls()
    OR athlete_id IN (SELECT id FROM athletes WHERE team_id = app_team_id())
  );

-- ── User-scoped (profile + own tokens when not bypassing) ────────────────────

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles
  USING (app_bypass_rls() OR user_id = app_user_id())
  WITH CHECK (app_bypass_rls() OR user_id = app_user_id());

ALTER TABLE IF EXISTS idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idempotency_keys_user ON idempotency_keys;
CREATE POLICY idempotency_keys_user ON idempotency_keys
  USING (app_bypass_rls() OR user_id = app_user_id())
  WITH CHECK (app_bypass_rls() OR user_id = app_user_id());

-- ── Org-scoped billing / audit (via team org) ────────────────────────────────

ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_team ON organizations;
CREATE POLICY organizations_team ON organizations
  USING (
    app_bypass_rls()
    OR id IN (SELECT organization_id FROM teams WHERE id = app_team_id())
  )
  WITH CHECK (
    app_bypass_rls()
    OR id IN (SELECT organization_id FROM teams WHERE id = app_team_id())
  );

ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_org ON audit_logs;
CREATE POLICY audit_logs_org ON audit_logs
  USING (
    app_bypass_rls()
    OR organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id())
  )
  WITH CHECK (
    app_bypass_rls()
    OR organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id())
  );

ALTER TABLE IF EXISTS outbox_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_events_org ON outbox_events;
CREATE POLICY outbox_events_org ON outbox_events
  USING (
    app_bypass_rls()
    OR organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id())
  )
  WITH CHECK (
    app_bypass_rls()
    OR organization_id IN (SELECT organization_id FROM teams WHERE id = app_team_id())
  );
