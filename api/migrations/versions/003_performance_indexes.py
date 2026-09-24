"""Add performance optimization indexes.

Revision ID: 003
Revises: 002
Create Date: 2026-09-24

"""
from alembic import op


def upgrade() -> None:
    """Add critical performance indexes."""

    # Users
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE deleted_at IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);")

    # Teams
    op.execute("CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams (organization_id) WHERE deleted_at IS NULL;")

    # Team Members
    op.execute("CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members (team_id, user_id);")

    # Athletes
    op.execute("CREATE INDEX IF NOT EXISTS idx_athletes_team_id ON athletes (team_id) WHERE deleted_at IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_athletes_user_id ON athletes (user_id) WHERE deleted_at IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_athletes_name ON athletes (team_id, name) WHERE deleted_at IS NULL;")

    # Workouts
    op.execute("CREATE INDEX IF NOT EXISTS idx_workouts_team_date ON workouts (team_id, workout_date DESC) WHERE deleted_at IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_workouts_created_by ON workouts (created_by, workout_date DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_workouts_athlete_ids ON workouts USING GIN (athlete_ids) WHERE deleted_at IS NULL;")

    # Time Logs (CRITICAL for matrix queries)
    op.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS idx_time_logs_upsert
    ON time_logs (workout_id, block_id, athlete_id, rep_number);
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_time_logs_athlete_date ON time_logs (athlete_id, recorded_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_time_logs_workout ON time_logs (workout_id, block_id);")

    # OAuth Accounts
    op.execute("CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts (provider, provider_account_id);")

    # Competitions
    op.execute("CREATE INDEX IF NOT EXISTS idx_competitions_team_date ON competitions (team_id, meet_date DESC) WHERE deleted_at IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_competitions_athlete_ids ON competitions USING GIN (athlete_ids);")

    # Meet Results & Entries
    op.execute("CREATE INDEX IF NOT EXISTS idx_meet_entries_competition ON meet_entries (competition_id, athlete_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_meet_results_entry ON meet_results (meet_entry_id);")

    # Profiles
    op.execute("CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);")

    # Session tokens & reset tokens
    op.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id, expires_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens (expires_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_email_verify_expires ON email_verification_tokens (expires_at DESC);")

    # Audit logs indexes (after partitioning)
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org ON audit_logs (user_id, organization_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);")


def downgrade() -> None:
    """Drop performance indexes."""

    indexes = [
        'idx_users_email', 'idx_users_created_at',
        'idx_teams_org_id',
        'idx_team_members_user_id', 'idx_team_members_team_id',
        'idx_athletes_team_id', 'idx_athletes_user_id', 'idx_athletes_name',
        'idx_workouts_team_date', 'idx_workouts_created_by', 'idx_workouts_athlete_ids',
        'idx_time_logs_upsert', 'idx_time_logs_athlete_date', 'idx_time_logs_workout',
        'idx_oauth_provider',
        'idx_competitions_team_date', 'idx_competitions_athlete_ids',
        'idx_meet_entries_competition', 'idx_meet_results_entry',
        'idx_profiles_user_id',
        'idx_refresh_tokens_user', 'idx_refresh_tokens_expires',
        'idx_password_reset_expires', 'idx_email_verify_expires',
        'idx_audit_logs_user_org', 'idx_audit_logs_entity', 'idx_audit_logs_action',
    ]

    for idx in indexes:
        op.execute(f"DROP INDEX IF EXISTS {idx};")
