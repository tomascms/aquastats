-- Migration 015: only a coach may write the team's plans (audit 2026-10-17, #11).
-- Reading stays team-wide; until now only require_coach kept a swimmer from writing these rows.
-- WITH CHECK alone would leave DELETE open (it only uses USING), so reads and writes get separate policies:
-- permissive policies are OR'ed, so SELECT still sees the team, while INSERT/UPDATE/DELETE need the coach one.
DO $$
DECLARE
  t text;
  col text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workouts', 'competitions', 'season_plans', 'attendance_sessions', 'teams'] LOOP
    col := CASE WHEN t = 'teams' THEN 'id' ELSE 'team_id' END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', CASE WHEN t = 'teams' THEN 'teams_self' ELSE t || '_team' END, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_coach_write', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (app_bypass_rls() OR %I = app_team_id())', t || '_read', t, col);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_bypass_rls() OR (app_role() = ''coach'' AND %I = app_team_id())) '
      'WITH CHECK (app_bypass_rls() OR (app_role() = ''coach'' AND %I = app_team_id()))',
      t || '_coach_write', t, col, col);
  END LOOP;
END$$;
