"""Billing API routes (payment integration)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID, uuid4
from datetime import datetime
import structlog

from ..core.database import get_session
from ..core.auth import require_coach
from ..core.stripe_client import get_stripe_client
from ..core.caching import invalidate_team_cache
from ..domain.billing import Subscription, Invoice, Plan, PlanType, SubscriptionStatus
from ..domain.models import User, Team

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# Feature flag to enable/disable billing (keep hidden from public)
BILLING_FEATURE_ENABLED = True  # Can be set via environment variable


@router.get("/plans")
async def list_plans():
    """Get all subscription plans."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    plans = []
    for plan_type in PlanType:
        plan_data = Plan.get_plan(plan_type)
        plans.append({
            "id": plan_type.value,
            "name": plan_data["name"],
            "price_eur": plan_data["price_eur"],
            "price_cents": plan_data["price_cents"],
            "features": plan_data["features"],
            "stripe_price_id": plan_data.get("stripe_price_id"),
        })

    return {"plans": plans}


@router.get("/subscription")
async def get_subscription(
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Get current subscription."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    team_id = UUID(payload.get("team_uuid"))

    sub = session.scalar(
        select(Subscription).where(Subscription.team_id == team_id)
    )

    if not sub:
        return {
            "plan": PlanType.FREE.value,
            "status": SubscriptionStatus.ACTIVE.value,
            "features": Plan.get_plan(PlanType.FREE).get("features", {}),
        }

    return {
        "id": str(sub.id),
        "plan": sub.plan.value,
        "status": sub.status.value,
        "stripe_customer_id": sub.stripe_customer_id,
        "stripe_subscription_id": sub.stripe_subscription_id,
        "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "cancel_at_period_end": sub.cancel_at_period_end,
        "features": Plan.get_plan(sub.plan).get("features", {}),
    }


@router.post("/checkout")
async def create_checkout(
    body: dict,
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Create checkout session for plan upgrade."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    plan_id = body.get("plan_id")
    success_url = body.get("success_url", "https://aquastats.net/billing/success")
    cancel_url = body.get("cancel_url", "https://aquastats.net/billing/cancel")

    if plan_id not in [p.value for p in PlanType]:
        raise HTTPException(status_code=400, detail="Invalid plan")

    if plan_id == PlanType.FREE.value:
        raise HTTPException(status_code=400, detail="Cannot checkout to free plan")

    user_id = UUID(payload.get("user_id"))
    team_id = UUID(payload.get("team_uuid"))

    user = session.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stripe_client = get_stripe_client()
    plan = PlanType(plan_id)
    plan_data = Plan.get_plan(plan)

    # Get or create Stripe customer
    sub = session.scalar(select(Subscription).where(Subscription.team_id == team_id))

    if sub and sub.stripe_customer_id:
        customer_id = sub.stripe_customer_id
    else:
        customer_id = await stripe_client.create_customer(
            email=user.email,
            name=user.name,
            metadata={"team_id": str(team_id), "organization_id": str(user.organization_id)}
        )

        if not customer_id:
            logger.error('stripe_customer_creation_failed', team_id=str(team_id))
            raise HTTPException(status_code=500, detail="Failed to create payment account")

    # Create checkout session
    checkout = await stripe_client.create_checkout_session(
        customer_id=customer_id,
        price_id=plan_data["stripe_price_id"],
        success_url=success_url,
        cancel_url=cancel_url,
        trial_days=14 if plan_id == PlanType.STARTER.value else 0,  # 14-day trial for Starter
    )

    if not checkout:
        logger.error('stripe_checkout_creation_failed', team_id=str(team_id))
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

    logger.info('checkout_session_created', team_id=str(team_id), plan=plan_id)

    return {
        "session_id": checkout["id"],
        "url": checkout["url"],
        "client_secret": checkout.get("client_secret"),
    }


@router.post("/change-plan")
async def change_plan(
    body: dict,
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Change subscription plan."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    plan_id = body.get("plan_id")
    team_id = UUID(payload.get("team_uuid"))

    if plan_id not in [p.value for p in PlanType]:
        raise HTTPException(status_code=400, detail="Invalid plan")

    sub = session.scalar(select(Subscription).where(Subscription.team_id == team_id))

    if not sub or not sub.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    if sub.plan.value == plan_id:
        raise HTTPException(status_code=400, detail="Already on this plan")

    stripe_client = get_stripe_client()
    plan = PlanType(plan_id)
    plan_data = Plan.get_plan(plan)

    result = await stripe_client.update_subscription(
        subscription_id=sub.stripe_subscription_id,
        price_id=plan_data["stripe_price_id"],
    )

    if not result:
        logger.error('plan_change_failed', team_id=str(team_id), plan=plan_id)
        raise HTTPException(status_code=500, detail="Failed to change plan")

    # Update local subscription
    sub.plan = plan
    sub.updated_at = datetime.utcnow()
    session.add(sub)
    session.commit()

    await invalidate_team_cache(str(team_id))
    logger.info('plan_changed', team_id=str(team_id), plan=plan_id)

    return {"plan": plan_id, "status": result["status"]}


@router.post("/cancel")
async def cancel_subscription(
    body: dict,
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Cancel subscription (at period end)."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    team_id = UUID(payload.get("team_uuid"))
    at_period_end = body.get("at_period_end", True)

    sub = session.scalar(select(Subscription).where(Subscription.team_id == team_id))

    if not sub or not sub.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    stripe_client = get_stripe_client()
    result = await stripe_client.cancel_subscription(
        subscription_id=sub.stripe_subscription_id,
        at_period_end=at_period_end,
    )

    if not result:
        logger.error('subscription_cancel_failed', team_id=str(team_id))
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

    # Update local subscription
    if not at_period_end:
        sub.plan = PlanType.FREE
        sub.status = SubscriptionStatus.CANCELED

    sub.cancel_at_period_end = at_period_end
    sub.canceled_at = datetime.utcnow()
    sub.updated_at = datetime.utcnow()
    session.add(sub)
    session.commit()

    await invalidate_team_cache(str(team_id))
    logger.info('subscription_canceled', team_id=str(team_id), at_period_end=at_period_end)

    return {"status": "canceled"}


@router.get("/invoices")
async def list_invoices(
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Get team invoices."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    user_id = UUID(payload.get("user_id"))

    invoices = session.scalars(
        select(Invoice).where(Invoice.user_id == user_id).order_by(Invoice.created_at.desc()).limit(20)
    ).all()

    return {
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "amount_eur": inv.amount_cents / 100,
                "status": inv.status,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                "invoice_url": inv.invoice_url,
                "pdf_url": inv.pdf_url,
            }
            for inv in invoices
        ]
    }


@router.get("/portal")
async def create_portal_link(
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Create customer portal session."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    team_id = UUID(payload.get("team_uuid"))
    return_url = payload.get("return_url", "https://aquastats.net/dashboard")

    sub = session.scalar(select(Subscription).where(Subscription.team_id == team_id))

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No payment account")

    stripe_client = get_stripe_client()
    portal_url = await stripe_client.create_portal_session(
        customer_id=sub.stripe_customer_id,
        return_url=return_url,
    )

    if not portal_url:
        logger.error('portal_creation_failed', team_id=str(team_id))
        raise HTTPException(status_code=500, detail="Failed to create portal")

    return {"url": portal_url}


@router.get("/usage")
async def get_team_usage(
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """Get team usage (for rate limiting based on plan)."""
    if not BILLING_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="Billing not available")

    team_id_uuid = UUID(payload.get("team_uuid"))
    sub = session.scalar(select(Subscription).where(Subscription.team_id == team_id_uuid))

    if not sub:
        plan = PlanType.FREE
    else:
        plan = sub.plan

    plan_data = Plan.get_plan(plan)

    return {
        "plan": plan.value,
        "limits": plan_data.get("features", {}),
        "current_usage": {
            "api_calls_today": 0,  # Would be fetched from Redis rate limit counter
            "storage_used_gb": 0,  # Would be fetched from S3
            "workouts_this_month": 0,  # Would be counted from DB
        }
    }
