-- Migration 006: athlete goals (set by the coach or by the athlete).
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  athlete_id uuid not null references athletes(id),
  author_role text not null check (author_role in ('coach', 'athlete')),
  author_user_id uuid not null references users(id),
  kind text not null default 'time' check (kind in ('time', 'technical', 'other')),
  stroke text,
  distance_m integer,
  course text,
  metric text,
  target_value double precision,
  target_date date,
  competition_id uuid references competitions(id),
  text text not null default '',
  response text not null default '',
  status text not null default 'active' check (status in ('active', 'achieved', 'dropped')),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists goals_team_athlete_idx on goals (team_id, athlete_id) where deleted_at is null;
