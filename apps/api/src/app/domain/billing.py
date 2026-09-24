"""Billing domain models."""
from enum import Enum
from datetime import datetime
from uuid import UUID
from sqlalchemy import Column, String, Integer, DateTime, UUID as UUIDType, Enum as SQLEnum, Boolean, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class PlanType(str, Enum):
    """Subscription plan types."""
    FREE = "free"
    STARTER = "starter"  # €9/month
    PROFESSIONAL = "professional"  # €29/month
    ELITE = "elite"  # €99/month


class SubscriptionStatus(str, Enum):
    """Subscription statuses."""
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    PAUSED = "paused"
    EXPIRED = "expired"


class Subscription(Base):
    """User subscription."""
    __tablename__ = "subscriptions"

    id = Column(UUIDType(as_uuid=True), primary_key=True)
    user_id = Column(UUIDType(as_uuid=True), nullable=False, index=True)
    team_id = Column(UUIDType(as_uuid=True), nullable=False, index=True)

    plan = Column(SQLEnum(PlanType), default=PlanType.FREE, nullable=False)
    status = Column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False)

    stripe_customer_id = Column(String(255), unique=True, index=True)
    stripe_subscription_id = Column(String(255), unique=True, index=True)
    stripe_price_id = Column(String(255))

    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)

    amount_cents = Column(Integer)  # In cents (€ cents)
    currency = Column(String(3), default="EUR")

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    canceled_at = Column(DateTime, nullable=True)


class Invoice(Base):
    """Invoice for subscription payment."""
    __tablename__ = "invoices"

    id = Column(UUIDType(as_uuid=True), primary_key=True)
    subscription_id = Column(UUIDType(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUIDType(as_uuid=True), nullable=False, index=True)

    stripe_invoice_id = Column(String(255), unique=True, index=True)
    stripe_charge_id = Column(String(255), unique=True, index=True)

    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), default="EUR")
    status = Column(String(50), default="draft")  # draft, open, paid, void, uncollectible

    invoice_number = Column(String(50), unique=True, index=True)
    invoice_url = Column(String(500))
    pdf_url = Column(String(500))

    period_start = Column(DateTime)
    period_end = Column(DateTime)
    due_date = Column(DateTime)
    paid_at = Column(DateTime, nullable=True)

    description = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Plan:
    """Subscription plan details (not in DB)."""

    PLANS = {
        PlanType.FREE: {
            "name": "Free",
            "price_eur": 0,
            "price_cents": 0,
            "features": {
                "athletes": 2,
                "workouts_per_month": 50,
                "storage_gb": 1,
                "api_calls_per_day": 1000,
                "reports_per_month": 5,
                "support": "email",
            },
            "stripe_price_id": None,
        },
        PlanType.STARTER: {
            "name": "Starter",
            "price_eur": 9,
            "price_cents": 900,
            "features": {
                "athletes": 10,
                "workouts_per_month": 500,
                "storage_gb": 10,
                "api_calls_per_day": 10000,
                "reports_per_month": 50,
                "support": "email",
                "custom_branding": False,
                "team_collaboration": False,
            },
            "stripe_price_id": "price_starter_eur",  # Replace with real Stripe ID
        },
        PlanType.PROFESSIONAL: {
            "name": "Professional",
            "price_eur": 29,
            "price_cents": 2900,
            "features": {
                "athletes": 50,
                "workouts_per_month": 5000,
                "storage_gb": 100,
                "api_calls_per_day": 100000,
                "reports_per_month": "unlimited",
                "support": "priority_email",
                "custom_branding": True,
                "team_collaboration": True,
                "advanced_analytics": True,
                "api_access": True,
            },
            "stripe_price_id": "price_professional_eur",  # Replace with real Stripe ID
        },
        PlanType.ELITE: {
            "name": "Elite",
            "price_eur": 99,
            "price_cents": 9900,
            "features": {
                "athletes": "unlimited",
                "workouts_per_month": "unlimited",
                "storage_gb": 1000,
                "api_calls_per_day": "unlimited",
                "reports_per_month": "unlimited",
                "support": "24/7_phone",
                "custom_branding": True,
                "team_collaboration": True,
                "advanced_analytics": True,
                "api_access": True,
                "dedicated_account_manager": True,
                "sso": True,
            },
            "stripe_price_id": "price_elite_eur",  # Replace with real Stripe ID
        },
    }

    @classmethod
    def get_plan(cls, plan_type: PlanType) -> dict:
        """Get plan details."""
        return cls.PLANS.get(plan_type, {})

    @classmethod
    def get_feature(cls, plan_type: PlanType, feature: str):
        """Get feature value for plan."""
        plan = cls.get_plan(plan_type)
        return plan.get("features", {}).get(feature)

    @classmethod
    def has_feature(cls, plan_type: PlanType, feature: str) -> bool:
        """Check if plan has feature."""
        plan = cls.get_plan(plan_type)
        features = plan.get("features", {})

        if feature not in features:
            return False

        value = features[feature]
        # Handle unlimited features
        if value == "unlimited" or value == "unlimited":
            return True

        # Return truthy value
        return bool(value)
