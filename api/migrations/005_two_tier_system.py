"""Add two-tier system (Athlete/Coach) tables and columns."""
from alembic import op
import sqlalchemy as sa


def upgrade():
    """Create two-tier system tables."""

    # Add columns to users table
    op.add_column(
        'users',
        sa.Column('user_type', sa.String(20), nullable=False, server_default='athlete')
    )
    op.add_column(
        'users',
        sa.Column('preferred_language', sa.String(10), server_default='pt-PT')
    )
    op.add_column(
        'users',
        sa.Column('auth_providers', sa.ARRAY(sa.String), server_default='{"email"}')
    )
    op.add_column(
        'users',
        sa.Column('google_id', sa.String(255), nullable=True, unique=True)
    )
    op.add_column(
        'users',
        sa.Column('apple_id', sa.String(255), nullable=True, unique=True)
    )

    # Create user_profiles table
    op.create_table(
        'user_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('user_type', sa.Enum('athlete', 'coach', name='usertype'), nullable=False),
        sa.Column('is_verified_email', sa.Boolean(), default=False),
        sa.Column('is_verified_phone', sa.Boolean(), default=False),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('profile_image_url', sa.String(500), nullable=True),
        sa.Column('preferred_language', sa.String(10), default='pt-PT'),
        sa.Column('auth_providers', sa.ARRAY(sa.String), default=['email']),
        sa.Column('google_id', sa.String(255), nullable=True),
        sa.Column('apple_id', sa.String(255), nullable=True),
        sa.Column('accepted_terms_at', sa.DateTime(), nullable=True),
        sa.Column('accepted_privacy_at', sa.DateTime(), nullable=True),
        sa.Column('accepted_marketing_at', sa.DateTime(), nullable=True),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('last_login_provider', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_profiles_user_id', 'user_profiles', ['user_id'], unique=True)
    op.create_index('ix_user_profiles_google_id', 'user_profiles', ['google_id'], unique=True)
    op.create_index('ix_user_profiles_apple_id', 'user_profiles', ['apple_id'], unique=True)

    # Create coach_profiles table
    op.create_table(
        'coach_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('coach_name', sa.String(255), nullable=False),
        sa.Column('coach_bio', sa.Text(), nullable=True),
        sa.Column('coach_image_url', sa.String(500), nullable=True),
        sa.Column('specialties', sa.ARRAY(sa.String), default=[]),
        sa.Column('certifications', sa.ARRAY(sa.String), default=[]),
        sa.Column('experience_years', sa.Integer(), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('website', sa.String(500), nullable=True),
        sa.Column('social_media', sa.Text(), nullable=True),
        sa.Column('is_verified_coach', sa.Boolean(), default=False),
        sa.Column('verification_date', sa.DateTime(), nullable=True),
        sa.Column('verification_badge', sa.Boolean(), default=False),
        sa.Column('total_athletes', sa.Integer(), default=0),
        sa.Column('total_teams', sa.Integer(), default=0),
        sa.Column('avg_rating', sa.Float(), nullable=True),
        sa.Column('total_reviews', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coach_profiles_user_id', 'coach_profiles', ['user_id'], unique=True)

    # Create athlete_profiles table
    op.create_table(
        'athlete_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('athlete_name', sa.String(255), nullable=False),
        sa.Column('date_of_birth', sa.DateTime(), nullable=True),
        sa.Column('gender', sa.String(1), nullable=True),
        sa.Column('primary_strokes', sa.ARRAY(sa.String), default=[]),
        sa.Column('primary_distances', sa.ARRAY(sa.Integer), default=[]),
        sa.Column('current_best_times', sa.Text(), nullable=True),
        sa.Column('coach_id', sa.UUID(), nullable=True),
        sa.Column('total_workouts', sa.Integer(), default=0),
        sa.Column('total_times_logged', sa.Integer(), default=0),
        sa.Column('last_workout_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_athlete_profiles_user_id', 'athlete_profiles', ['user_id'], unique=True)
    op.create_index('ix_athlete_profiles_coach_id', 'athlete_profiles', ['coach_id'])


def downgrade():
    """Drop two-tier system tables."""
    op.drop_index('ix_athlete_profiles_coach_id', table_name='athlete_profiles')
    op.drop_index('ix_athlete_profiles_user_id', table_name='athlete_profiles')
    op.drop_table('athlete_profiles')

    op.drop_index('ix_coach_profiles_user_id', table_name='coach_profiles')
    op.drop_table('coach_profiles')

    op.drop_index('ix_user_profiles_apple_id', table_name='user_profiles')
    op.drop_index('ix_user_profiles_google_id', table_name='user_profiles')
    op.drop_index('ix_user_profiles_user_id', table_name='user_profiles')
    op.drop_table('user_profiles')

    # Drop columns from users table
    op.drop_column('users', 'apple_id')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'auth_providers')
    op.drop_column('users', 'preferred_language')
    op.drop_column('users', 'user_type')
