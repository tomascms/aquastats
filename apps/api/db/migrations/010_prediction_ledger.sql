-- Migration 010: immutable ledger of training predictions (docs/ml/README.md, "Aprendizagem contínua").
-- Every prediction is stored when it is made, before the time it predicts exists; the outcome is the
-- time_log entered later. A prediction is never edited or removed on its own: the trigger refuses
-- any direct UPDATE/DELETE for every role, unless an operator turns it off on purpose for one
-- transaction (SET LOCAL aquastats.ledger_maintenance = 'on'). Deleting the workout, the athlete,
-- the team or the account still works (the app hard-deletes them, and the right to erasure needs
-- it): the foreign keys cascade, and changes coming from a cascade are let through. The grants
-- below are a second layer; they only bite if aquastats_app does not inherit wider rights.
-- Tested against the production database inside transactions that were rolled back.

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

create or replace function prediction_ledger_immutable() returns trigger
language plpgsql as $$
begin
  -- pg_trigger_depth() > 1: the change comes from a foreign-key cascade (workout, athlete, team or
  -- account deleted), not from someone editing a prediction.
  if pg_trigger_depth() > 1 or coalesce(current_setting('aquastats.ledger_maintenance', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'prediction_ledger is append-only';
end;
$$;

drop trigger if exists prediction_ledger_no_change on prediction_ledger;
create trigger prediction_ledger_no_change
  before update or delete on prediction_ledger
  for each row execute function prediction_ledger_immutable();

alter table prediction_ledger enable row level security;
drop policy if exists prediction_ledger_team on prediction_ledger;
create policy prediction_ledger_team on prediction_ledger
  using (app_bypass_rls() or team_id = app_team_id())
  with check (app_bypass_rls() or team_id = app_team_id());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'aquastats_app') then
    -- Default privileges grant UPDATE/DELETE on new tables: take them back here.
    revoke update, delete, truncate on prediction_ledger from aquastats_app;
    grant select, insert on prediction_ledger to aquastats_app;
  end if;
end$$;
