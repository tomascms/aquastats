-- SwimAnalytics — PostgreSQL portátil (Neon Free agora; qualquer Postgres depois).
-- Um clube = uma organization. O mesmo schema serve a tua equipa e, mais tarde, milhares de clubes.
-- Timestamps em UTC (timestamptz). País / fuso / idioma / moeda / região são por clube, não globais.
-- Operacional + análise de prova (voltas, SR, UWD, DPS), plano de época e presenças.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Operacional (actualizações no sítio: treinos, tempos, contas) ───────────

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'PT',
  timezone text not null default 'Europe/Lisbon',
  locale text not null default 'pt-PT',
  currency text not null default 'EUR',
  region text not null default 'eu',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists organizations_region_idx on organizations (region) where deleted_at is null;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  join_code text not null unique,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists teams_organization_idx on teams (organization_id) where deleted_at is null;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text not null check (role in ('pending', 'coach', 'swimmer')),
  is_active boolean not null default true,
  is_verified boolean not null default false,
  last_login_at timestamptz,
  failed_login_count smallint not null default 0,
  locked_until timestamptz,
  password_hash text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists users_email_lower_idx on users (lower(email)) where email is not null and deleted_at is null;

create table if not exists oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  provider text not null,
  provider_account_id text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_id)
);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  family_id uuid not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  reused_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_user_idx on refresh_tokens (user_id, expires_at);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_user_idx on password_reset_tokens (user_id, expires_at);

create table if not exists email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_tokens_user_idx on email_verification_tokens (user_id, expires_at);

create table if not exists profiles (
  user_id uuid primary key references users(id),
  full_name text not null,
  date_of_birth date,
  primary_stroke text,
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  user_id uuid not null references users(id),
  status text not null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create unique index if not exists team_members_user_idx on team_members (user_id);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  email text not null,
  role text not null check (role in ('coach', 'swimmer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  user_id uuid references users(id),
  name text not null,
  date_of_birth date,
  primary_stroke text not null default 'free',
  is_placeholder boolean not null default true,
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists athletes_team_idx on athletes (team_id) where deleted_at is null;

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  created_by uuid not null references users(id),
  title text not null,
  workout_date date not null,
  shift text not null,
  athlete_ids uuid[] not null default '{}',
  blocks jsonb not null default '[]',
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists workouts_team_date_idx on workouts (team_id, workout_date desc) where deleted_at is null;

create table if not exists time_logs (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id),
  block_id text not null,
  athlete_id uuid not null references athletes(id),
  rep_number smallint not null,
  mm smallint not null default 0,
  ss smallint not null default 0,
  cc smallint not null default 0,
  splits jsonb not null default '[]',
  stroke text not null default 'free',
  recorded_by uuid not null references users(id),
  recorded_at timestamptz not null default now(),
  unique (workout_id, block_id, athlete_id, rep_number)
);
create index if not exists time_logs_athlete_recorded_idx on time_logs (athlete_id, recorded_at);
create index if not exists time_logs_workout_idx on time_logs (workout_id);

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  created_by uuid not null references users(id),
  title text not null,
  meet_date date not null,
  course text not null,
  venue text not null default '',
  athlete_ids uuid[] not null default '{}',
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists competitions_team_date_idx on competitions (team_id, meet_date desc) where deleted_at is null;

create table if not exists meet_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  athlete_id uuid not null references athletes(id),
  stroke text not null,
  distance_m integer not null,
  extra jsonb not null default '{}',
  unique (competition_id, athlete_id, stroke, distance_m)
);

create table if not exists meet_results (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references meet_entries(id),
  mm smallint not null default 0,
  ss smallint not null default 0,
  cc smallint not null default 0,
  splits jsonb not null default '[]',
  extra jsonb not null default '{}',
  recorded_by uuid not null references users(id),
  recorded_at timestamptz not null default now(),
  unique (entry_id)
);

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

create table if not exists oauth_states (
  state text primary key,
  code_verifier text not null,
  nonce text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  key text not null,
  operation text not null,
  user_id uuid not null references users(id),
  request_hash text not null,
  status text not null,
  response_status smallint,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (key, operation)
);

create table if not exists outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts smallint not null default 0,
  max_attempts smallint not null default 5,
  next_retry_at timestamptz not null,
  error_log text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists outbox_pending_idx on outbox_events (status, next_retry_at);

create table if not exists saga_instances (
  id uuid primary key default gen_random_uuid(),
  saga_type text not null,
  status text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saga_logs (
  id uuid primary key default gen_random_uuid(),
  saga_id uuid not null references saga_instances(id),
  step text not null,
  status text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_org_created_idx on audit_logs (organization_id, created_at desc);

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'organizations','teams','users','oauth_accounts','profiles','athletes','workouts',
      'competitions','race_sessions','season_plans','attendance_sessions',
      'saga_instances'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format('create trigger set_updated_at before update on %I for each row execute procedure public.set_updated_at()', t);
  end loop;
end$$;

revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
grant usage on schema public to current_user;
grant all on all tables in schema public to current_user;
grant all on all sequences in schema public to current_user;

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

-- Migration 008: Polar AccessLink authorisations (one per athlete, token encrypted by the API).
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

-- Migration 010: append-only ledger of training predictions (RLS, grants and the immutability trigger live in the migration).
create table if not exists prediction_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  block_id text not null,
  rep_number smallint not null,
  target_date date not null,
  model text not null,
  model_version text not null,
  role text not null check (role in ('champion', 'challenger')),
  horizon text not null default 'day' check (horizon in ('rep', 'day', 'week', 'month', 'year')),
  mean_s double precision not null check (mean_s > 0),
  lo_s double precision,
  hi_s double precision,
  nominal double precision,
  sd_s double precision,
  confidence text,
  details jsonb not null default '{}',
  predicted_by uuid references users(id) on delete set null,
  predicted_at timestamptz not null default now(),
  unique (model, model_version, horizon, workout_id, block_id, athlete_id, rep_number)
);
create index if not exists prediction_ledger_team_athlete_idx on prediction_ledger (team_id, athlete_id, target_date desc);
create index if not exists prediction_ledger_rep_idx on prediction_ledger (workout_id, block_id, athlete_id, rep_number);
