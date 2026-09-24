"""Create billing tables (subscriptions, invoices)."""
from alembic import op
import sqlalchemy as sa


def upgrade():
    """Create billing schema."""

    # Create subscriptions table
    op.create_table(
        'subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('team_id', sa.UUID(), nullable=False),
        sa.Column('plan', sa.Enum('free', 'starter', 'professional', 'elite', name='plantype'), nullable=False),
        sa.Column('status', sa.Enum('active', 'past_due', 'canceled', 'paused', 'expired', name='subscriptionstatus'), nullable=False),
        sa.Column('stripe_customer_id', sa.String(255), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(255), nullable=True),
        sa.Column('stripe_price_id', sa.String(255), nullable=True),
        sa.Column('current_period_start', sa.DateTime(), nullable=True),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), default=False),
        sa.Column('amount_cents', sa.Integer(), nullable=True),
        sa.Column('currency', sa.String(3), default='EUR'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Indexes for subscriptions
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])
    op.create_index('ix_subscriptions_team_id', 'subscriptions', ['team_id'])
    op.create_index('ix_subscriptions_stripe_customer_id', 'subscriptions', ['stripe_customer_id'], unique=True)
    op.create_index('ix_subscriptions_stripe_subscription_id', 'subscriptions', ['stripe_subscription_id'], unique=True)

    # Create invoices table
    op.create_table(
        'invoices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('stripe_invoice_id', sa.String(255), nullable=True),
        sa.Column('stripe_charge_id', sa.String(255), nullable=True),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(3), default='EUR'),
        sa.Column('status', sa.String(50), default='draft'),
        sa.Column('invoice_number', sa.String(50), nullable=True),
        sa.Column('invoice_url', sa.String(500), nullable=True),
        sa.Column('pdf_url', sa.String(500), nullable=True),
        sa.Column('period_start', sa.DateTime(), nullable=True),
        sa.Column('period_end', sa.DateTime(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Indexes for invoices
    op.create_index('ix_invoices_subscription_id', 'invoices', ['subscription_id'])
    op.create_index('ix_invoices_user_id', 'invoices', ['user_id'])
    op.create_index('ix_invoices_stripe_invoice_id', 'invoices', ['stripe_invoice_id'], unique=True)
    op.create_index('ix_invoices_stripe_charge_id', 'invoices', ['stripe_charge_id'], unique=True)
    op.create_index('ix_invoices_invoice_number', 'invoices', ['invoice_number'], unique=True)


def downgrade():
    """Drop billing tables."""
    op.drop_index('ix_invoices_invoice_number', table_name='invoices')
    op.drop_index('ix_invoices_stripe_charge_id', table_name='invoices')
    op.drop_index('ix_invoices_stripe_invoice_id', table_name='invoices')
    op.drop_index('ix_invoices_user_id', table_name='invoices')
    op.drop_index('ix_invoices_subscription_id', table_name='invoices')
    op.drop_table('invoices')

    op.drop_index('ix_subscriptions_stripe_subscription_id', table_name='subscriptions')
    op.drop_index('ix_subscriptions_stripe_customer_id', table_name='subscriptions')
    op.drop_index('ix_subscriptions_team_id', table_name='subscriptions')
    op.drop_index('ix_subscriptions_user_id', table_name='subscriptions')
    op.drop_table('subscriptions')
