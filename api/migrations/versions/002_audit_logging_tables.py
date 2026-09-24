"""Audit logging tables with partitioning.

Revision ID: 002
Revises: 001
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    """Create audit_logs table with monthly partitioning."""

    # Create parent table
    op.execute("""
    CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        organization_id UUID NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id UUID NOT NULL,
        old_value JSONB,
        new_value JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    ) PARTITION BY RANGE (created_at);
    """)

    # Create partitions for current and next 3 months
    op.execute("""
    CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs
        FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
    """)

    op.execute("""
    CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs
        FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
    """)

    op.execute("""
    CREATE TABLE audit_logs_2026_11 PARTITION OF audit_logs
        FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
    """)

    op.execute("""
    CREATE TABLE audit_logs_2026_12 PARTITION OF audit_logs
        FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
    """)

    # Create indexes
    op.execute("CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id, created_at DESC);")
    op.execute("CREATE INDEX idx_audit_logs_entity ON audit_logs (entity, entity_id, created_at DESC);")
    op.execute("CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at DESC);")

    # Enable RLS
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY audit_logs_org_access ON audit_logs
        USING (organization_id = current_setting('app.current_org_id')::uuid);
    """)

    # Create audit trigger function
    op.execute("""
    CREATE OR REPLACE FUNCTION audit_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
        INSERT INTO audit_logs (
            user_id, organization_id, action, entity, entity_id,
            old_value, new_value, ip_address, user_agent
        ) VALUES (
            current_setting('app.current_user_id')::uuid,
            current_setting('app.current_org_id')::uuid,
            TG_ARGV[0],
            TG_TABLE_NAME,
            CASE
                WHEN TG_OP = 'DELETE' THEN OLD.id
                ELSE NEW.id
            END,
            CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
            current_setting('app.client_ip')::inet,
            current_setting('app.user_agent')
        );
        RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    """Remove audit logging infrastructure."""

    op.execute("DROP FUNCTION IF EXISTS audit_trigger();")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE;")
