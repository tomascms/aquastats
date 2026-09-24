-- Performance indexes for frequent access patterns and snapshot queries.

create index if not exists idx_athletes_team_active
  on athletes (team_id, deleted_at)
  where deleted_at is null;

create index if not exists idx_workouts_team_date_active
  on workouts (team_id, workout_date desc)
  where deleted_at is null;

create index if not exists idx_competitions_team_date_active
  on competitions (team_id, meet_date desc)
  where deleted_at is null;

create index if not exists idx_meet_entries_competition_athlete
  on meet_entries (competition_id, athlete_id);

create index if not exists idx_meet_results_entry_id
  on meet_results (entry_id);

create index if not exists idx_race_sessions_team_date_active
  on race_sessions (team_id, session_date desc)
  where deleted_at is null;

create index if not exists idx_race_sessions_athlete_date_active
  on race_sessions (athlete_id, session_date desc)
  where deleted_at is null;

create index if not exists idx_attendance_team_date_active
  on attendance_sessions (team_id, session_date desc)
  where deleted_at is null;

create index if not exists idx_season_plans_team_date_active
  on season_plans (team_id, start_date desc)
  where deleted_at is null;

create index if not exists idx_team_members_user_team
  on team_members (user_id, team_id);
