-- Migration 014: drop the indexes 004 added on top of identical (or covering) ones from schema.sql.
-- Each write paid for both; no query plan used the second copy. Kept: the original of each pair.
DROP INDEX IF EXISTS idx_athletes_team_active;            -- = athletes_team_idx
DROP INDEX IF EXISTS idx_workouts_team_date_active;       -- = workouts_team_date_idx
DROP INDEX IF EXISTS idx_competitions_team_date_active;   -- = competitions_team_date_idx
DROP INDEX IF EXISTS idx_race_sessions_team_date_active;  -- = race_sessions_team_date_idx
DROP INDEX IF EXISTS idx_race_sessions_athlete_date_active; -- = race_sessions_athlete_idx
DROP INDEX IF EXISTS idx_attendance_team_date_active;     -- = attendance_sessions_team_date_idx
DROP INDEX IF EXISTS season_plans_team_idx;               -- covered by idx_season_plans_team_date_active (team_id, start_date desc)
DROP INDEX IF EXISTS idx_meet_results_entry_id;           -- = unique meet_results_entry_id_key
DROP INDEX IF EXISTS idx_team_members_user_team;          -- covered by unique team_members_user_idx (user_id)
DROP INDEX IF EXISTS idx_meet_entries_competition_athlete; -- prefix of unique (competition_id, athlete_id, stroke, distance_m)
