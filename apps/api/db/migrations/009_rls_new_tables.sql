-- Migration 009: tenant isolation and grants for tables added in 006–008 (same pattern as 002/003).

ALTER TABLE IF EXISTS goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS goals_team ON goals;
CREATE POLICY goals_team ON goals
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS hr_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hr_sessions_team ON hr_sessions;
CREATE POLICY hr_sessions_team ON hr_sessions
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

ALTER TABLE IF EXISTS polar_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS polar_links_team ON polar_links;
CREATE POLICY polar_links_team ON polar_links
  USING (app_bypass_rls() OR team_id = app_team_id())
  WITH CHECK (app_bypass_rls() OR team_id = app_team_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aquastats_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON goals, hr_sessions, polar_links TO aquastats_app;
  END IF;
END$$;
