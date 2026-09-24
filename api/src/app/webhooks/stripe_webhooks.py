"""Stripe webhook handlers for subscription events."""
import stripe
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID
from datetime import datetime
import structlog
import json

from ..core.database import get_session
from ..core.config import get_settings
from ..core.caching import invalidate_team_cache
from ..domain.billing import Subscription, Invoice, SubscriptionStatus, PlanType
from ..domain.audit import audit_logger, AuditContext

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def verify_stripe_signature(request_body: bytes, signature: str) -> dict:
    """Verify Stripe webhook signature."""
    settings = get_settings()

    try:
        event = stripe.Webhook.construct_event(
            request_body,
            signature,
            settings.stripe_webhook_secret,
        )
        return event
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")


@router.post("/stripe")
async def handle_stripe_webhook(request: Request, session: Session = Depends(get_session)):
    """Handle Stripe webhooks."""
    request_body = await request.body()
    signature = request.headers.get("stripe-signature")

    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")

    event = verify_stripe_signature(request_body, signature)

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info('stripe_webhook_received', event_type=event_type, event_id=event["id"])

    try:
        if event_type == "charge.succeeded":
            await handle_charge_succeeded(data, session)

        elif event_type == "charge.failed":
            await handle_charge_failed(data, session)

        elif event_type == "customer.subscription.created":
            await handle_subscription_created(data, session)

        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(data, session)

        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(data, session)

        elif event_type == "invoice.payment_succeeded":
            await handle_invoice_payment_succeeded(data, session)

        elif event_type == "invoice.payment_failed":
            await handle_invoice_payment_failed(data, session)

        else:
            logger.debug('stripe_webhook_ignored', event_type=event_type)

        return {"status": "ok"}

    except Exception as e:
        logger.error('stripe_webhook_error', event_type=event_type, error=str(e))
        raise HTTPException(status_code=500, detail="Webhook processing failed")


async def handle_charge_succeeded(data: dict, session: Session):
    """Handle successful charge."""
    stripe_invoice_id = data.get("invoice")
    amount = data.get("amount")  # In cents
    customer_id = data.get("customer")

    if stripe_invoice_id:
        invoice = session.scalar(
            select(Invoice).where(Invoice.stripe_invoice_id == stripe_invoice_id)
        )
        if invoice:
            invoice.status = "paid"
            invoice.stripe_charge_id = data.get("id")
            invoice.paid_at = datetime.utcnow()
            session.add(invoice)
            session.commit()

            logger.info('charge_succeeded', invoice_id=stripe_invoice_id, amount=amount)


async def handle_charge_failed(data: dict, session: Session):
    """Handle failed charge."""
    stripe_invoice_id = data.get("invoice")
    error_message = data.get("failure_message")

    if stripe_invoice_id:
        invoice = session.scalar(
            select(Invoice).where(Invoice.stripe_invoice_id == stripe_invoice_id)
        )
        if invoice:
            invoice.status = "failed"
            session.add(invoice)
            session.commit()

            logger.error('charge_failed', invoice_id=stripe_invoice_id, error=error_message)


async def handle_subscription_created(data: dict, session: Session):
    """Handle subscription creation."""
    stripe_subscription_id = data.get("id")
    customer_id = data.get("customer")
    status = data.get("status")  # active, past_due, unpaid, canceled, paused

    # Get subscription items to find price
    items = data.get("items", {}).get("data", [])
    price_id = items[0].get("price", {}).get("id") if items else None

    # Map Stripe price ID to our plan type
    plan_type = map_price_to_plan(price_id)

    current_period_start = datetime.fromtimestamp(data.get("current_period_start"))
    current_period_end = datetime.fromtimestamp(data.get("current_period_end"))

    # Find subscription by Stripe customer ID
    # In real implementation, you'd have a Team <-> Customer relationship
    # For now, we create or update subscription record

    logger.info('subscription_created', stripe_subscription_id=stripe_subscription_id, plan=plan_type)


async def handle_subscription_updated(data: dict, session: Session):
    """Handle subscription update."""
    stripe_subscription_id = data.get("id")
    status = data.get("status")
    cancel_at_period_end = data.get("cancel_at_period_end", False)

    sub = session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    )

    if not sub:
        logger.warning('subscription_update_not_found', stripe_subscription_id=stripe_subscription_id)
        return

    # Map Stripe status to our status
    status_map = {
        "active": SubscriptionStatus.ACTIVE,
        "past_due": SubscriptionStatus.PAST_DUE,
        "unpaid": SubscriptionStatus.PAST_DUE,
        "paused": SubscriptionStatus.PAUSED,
        "canceled": SubscriptionStatus.CANCELED,
    }

    sub.status = status_map.get(status, SubscriptionStatus.ACTIVE)
    sub.cancel_at_period_end = cancel_at_period_end
    sub.updated_at = datetime.utcnow()
    session.add(sub)
    session.commit()

    await invalidate_team_cache(str(sub.team_id))

    logger.info('subscription_updated', stripe_subscription_id=stripe_subscription_id, status=status)


async def handle_subscription_deleted(data: dict, session: Session):
    """Handle subscription cancellation."""
    stripe_subscription_id = data.get("id")

    sub = session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    )

    if not sub:
        logger.warning('subscription_delete_not_found', stripe_subscription_id=stripe_subscription_id)
        return

    sub.status = SubscriptionStatus.CANCELED
    sub.plan = PlanType.FREE
    sub.canceled_at = datetime.utcnow()
    sub.updated_at = datetime.utcnow()
    session.add(sub)
    session.commit()

    await invalidate_team_cache(str(sub.team_id))

    logger.info('subscription_deleted', stripe_subscription_id=stripe_subscription_id)


async def handle_invoice_payment_succeeded(data: dict, session: Session):
    """Handle successful invoice payment."""
    stripe_invoice_id = data.get("id")
    amount = data.get("amount_paid")  # In cents
    stripe_customer_id = data.get("customer")

    invoice = session.scalar(
        select(Invoice).where(Invoice.stripe_invoice_id == stripe_invoice_id)
    )

    if invoice:
        invoice.status = "paid"
        invoice.paid_at = datetime.utcnow()
        session.add(invoice)
    else:
        # Create invoice if doesn't exist
        stripe_charge_id = data.get("charge", data.get("payment_intent"))
        invoice = Invoice(
            id=__import__("uuid").uuid4(),
            stripe_invoice_id=stripe_invoice_id,
            stripe_charge_id=stripe_charge_id,
            amount_cents=amount,
            currency=data.get("currency", "eur").upper(),
            status="paid",
            invoice_number=data.get("number"),
            invoice_url=data.get("hosted_invoice_url"),
            pdf_url=data.get("invoice_pdf"),
            paid_at=datetime.utcnow(),
        )
        session.add(invoice)

    session.commit()

    logger.info('invoice_payment_succeeded', stripe_invoice_id=stripe_invoice_id, amount=amount)


async def handle_invoice_payment_failed(data: dict, session: Session):
    """Handle failed invoice payment."""
    stripe_invoice_id = data.get("id")
    error_message = data.get("last_payment_error", {}).get("message")

    invoice = session.scalar(
        select(Invoice).where(Invoice.stripe_invoice_id == stripe_invoice_id)
    )

    if invoice:
        invoice.status = "open"  # Will retry
        session.add(invoice)
        session.commit()

    logger.error('invoice_payment_failed', stripe_invoice_id=stripe_invoice_id, error=error_message)


def map_price_to_plan(stripe_price_id: str) -> str:
    """Map Stripe price ID to plan type."""
    price_map = {
        "price_starter_eur": PlanType.STARTER.value,
        "price_professional_eur": PlanType.PROFESSIONAL.value,
        "price_elite_eur": PlanType.ELITE.value,
    }
    return price_map.get(stripe_price_id, PlanType.FREE.value)
