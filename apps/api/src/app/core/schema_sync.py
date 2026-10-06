from __future__ import annotations

from sqlalchemy import text

from .config import get_settings
from .db import can_change_schema, engine

ANALYSIS_DDL = """
create table if not exists race_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  athlete_id uuid not null references athletes(id),
  competition_id uuid references competitions(id),
  session_date date not null,
  tournament text not null default '',
  course text not null,
  distance_m integer not null,
  stroke text not null,
  day_part text not null default 'am',
  reaction_s double precision not null default 0,
  flight_s double precision not null default 0,
  laps jsonb not null default '[]',
  extra jsonb not null default '{}',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists race_sessions_team_date_idx on race_sessions (team_id, session_date desc) where deleted_at is null;
create index if not exists race_sessions_athlete_idx on race_sessions (athlete_id, session_date desc) where deleted_at is null;

create table if not exists season_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  name text not null,
  start_date date not null,
  end_date date not null,
  description text not null default '',
  payload jsonb not null default '{}',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists season_plans_team_idx on season_plans (team_id) where deleted_at is null;

create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  workout_id uuid references workouts(id),
  session_date date not null,
  group_name text not null default '',
  marks jsonb not null default '[]',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists attendance_sessions_team_date_idx on attendance_sessions (team_id, session_date desc) where deleted_at is null;

alter table if exists athletes add column if not exists extra jsonb not null default '{}';
alter table if exists profiles add column if not exists date_of_birth date;
alter table if exists profiles add column if not exists primary_stroke text;
alter table if exists profiles add column if not exists extra jsonb not null default '{}';
create table if not exists personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id),
  stroke text not null,
  distance_m integer not null,
  course text not null,
  mm smallint not null,
  ss smallint not null,
  cc smallint not null,
  competition_id uuid references competitions(id),
  result_id uuid,
  meet_date date not null,
  source text not null default 'meet',
  splits jsonb not null default '[]',
  unique (athlete_id, stroke, distance_m, course)
);
alter table if exists personal_records alter column competition_id drop not null;
alter table if exists personal_records alter column result_id drop not null;
alter table if exists personal_records add column if not exists source text not null default 'meet';
alter table if exists personal_records add column if not exists splits jsonb not null default '[]';
alter table if exists meet_results add column if not exists extra jsonb not null default '{}';
alter table if exists meet_entries add column if not exists extra jsonb not null default '{}';
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
create table if not exists polar_links (
  athlete_id uuid primary key references athletes(id),
  team_id uuid not null references teams(id),
  user_id uuid not null references users(id),
  polar_user_id text not null,
  token text not null default '',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists polar_links_team_idx on polar_links (team_id) where deleted_at is null;
"""


AUTH_DDL = """
create table if not exists email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_tokens_user_idx on email_verification_tokens (user_id, expires_at);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_user_idx on password_reset_tokens (user_id, expires_at);
"""


def _run_ddl(ddl: str) -> None:
    settings = get_settings()
    if engine is None or settings.is_production or settings.database_is_production or not can_change_schema():
        return
    with engine.begin() as conn:
        for statement in [part.strip() for part in ddl.split(";") if part.strip()]:
            conn.execute(text(statement))


def ensure_auth_schema() -> None:
    _run_ddl(AUTH_DDL)


def ensure_analysis_schema() -> None:
    _run_ddl(ANALYSIS_DDL)
