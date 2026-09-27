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
