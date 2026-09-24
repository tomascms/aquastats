"""Initial RLS setup and security policies.

Revision ID: 001
Revises: None
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    """Enable RLS on all user-data tables."""

    # Enable RLS on organizations
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY org_isolation ON organizations
        USING (id = current_setting('app.current_org_id')::uuid);
    """)

    # Enable RLS on teams
    op.execute("ALTER TABLE teams ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY team_isolation ON teams
        USING (organization_id = current_setting('app.current_org_id')::uuid);
    """)

    # Enable RLS on users
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY user_self ON users
        USING (id = current_setting('app.current_user_id')::uuid);
    """)

    # Enable RLS on team members
    op.execute("ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY team_member_access ON team_members
        USING (team_id IN (
            SELECT id FROM teams
            WHERE organization_id = current_setting('app.current_org_id')::uuid
        ));
    """)

    # Enable RLS on athletes
    op.execute("ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY athlete_team_access ON athletes
        USING (team_id IN (
            SELECT id FROM teams
            WHERE organization_id = current_setting('app.current_org_id')::uuid
        ));
    """)

    # Enable RLS on workouts
    op.execute("ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY workout_team_access ON workouts
        USING (team_id IN (
            SELECT id FROM teams
            WHERE organization_id = current_setting('app.current_org_id')::uuid
        ));
    """)

    # Enable RLS on time_logs
    op.execute("ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY time_log_access ON time_logs
        USING (workout_id IN (
            SELECT id FROM workouts
            WHERE team_id IN (
                SELECT id FROM teams
                WHERE organization_id = current_setting('app.current_org_id')::uuid
            )
        ));
    """)

    # Enable RLS on competitions
    op.execute("ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY competition_access ON competitions
        USING (team_id IN (
            SELECT id FROM teams
            WHERE organization_id = current_setting('app.current_org_id')::uuid
        ));
    """)


def downgrade() -> None:
    """Disable RLS policies."""

    op.execute("DROP POLICY IF EXISTS org_isolation ON organizations;")
    op.execute("ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS team_isolation ON teams;")
    op.execute("ALTER TABLE teams DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS user_self ON users;")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS team_member_access ON team_members;")
    op.execute("ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS athlete_team_access ON athletes;")
    op.execute("ALTER TABLE athletes DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS workout_team_access ON workouts;")
    op.execute("ALTER TABLE workouts DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS time_log_access ON time_logs;")
    op.execute("ALTER TABLE time_logs DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS competition_access ON competitions;")
    op.execute("ALTER TABLE competitions DISABLE ROW LEVEL SECURITY;")
