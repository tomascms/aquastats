-- Migration 007: heart-rate sessions from watches, attached to workouts.
create table if not exists hr_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  athlete_id uuid not null references athletes(id),
  workout_id uuid references workouts(id),
  source text not null check (source in ('file', 'polar', 'whoop')),
  external_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  avg_hr smallint,
  max_hr smallint,
  samples jsonb not null default '[]',
  laps jsonb not null default '[]',
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (athlete_id, source, external_id)
);
create index if not exists hr_sessions_team_started_idx on hr_sessions (team_id, started_at) where deleted_at is null;
