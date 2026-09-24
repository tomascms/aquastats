"""Stripe API client with resilience patterns."""
import stripe
import structlog
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from .config import get_settings
from .resilience import stripe_breaker, stripe_bulkhead, default_retry

logger = structlog.get_logger(__name__)


class StripeClient:
    """Stripe API client with circuit breaker and retry logic."""

    def __init__(self):
        settings = get_settings()
        stripe.api_key = settings.stripe_secret_key
        self.publishable_key = settings.stripe_publishable_key

    async def create_customer(
        self,
        email: str,
        name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Create Stripe customer."""
        async def _create():
            async with stripe_bulkhead.semaphore:
                result = await stripe_breaker.call(
                    stripe.Customer.create_async,
                    email=email,
                    name=name,
                    metadata=metadata or {},
                )
                return result.id if result else None

        try:
            return await default_retry.execute(_create)
        except Exception as e:
            logger.error('stripe_customer_create_failed', email=email, error=str(e))
            return None

    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
        trial_days: int = 0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict]:
        """Create Stripe subscription."""
        async def _create():
            async with stripe_bulkhead.semaphore:
                params = {
                    "customer": customer_id,
                    "items": [{"price": price_id}],
                    "payment_behavior": "default_incomplete",
                    "expand": ["latest_invoice.payment_intent"],
                    "metadata": metadata or {},
                }
                if trial_days > 0:
                    params["trial_period_days"] = trial_days

                result = await stripe_breaker.call(
                    stripe.Subscription.create_async,
                    **params
                )
                return result

        try:
            sub = await default_retry.execute(_create)
            if sub:
                return {
                    "id": sub.id,
                    "status": sub.status,
                    "current_period_start": datetime.fromtimestamp(sub.current_period_start),
                    "current_period_end": datetime.fromtimestamp(sub.current_period_end),
                    "items": [{"price_id": item.price.id} for item in sub.items.data],
                }
            return None
        except Exception as e:
            logger.error('stripe_subscription_create_failed', customer_id=customer_id, error=str(e))
            return None

    async def update_subscription(
        self,
        subscription_id: str,
        price_id: str,
        proration_behavior: str = "create_prorations"
    ) -> Optional[Dict]:
        """Update subscription (change plan)."""
        async def _update():
            async with stripe_bulkhead.semaphore:
                sub = await stripe_breaker.call(
                    stripe.Subscription.retrieve_async,
                    subscription_id,
                    expand=["items.data.price"]
                )

                # Get current item
                current_item = sub.items.data[0] if sub.items.data else None

                if not current_item:
                    return None

                # Update with new price
                result = await stripe_breaker.call(
                    stripe.Subscription.modify_async,
                    subscription_id,
                    items=[{
                        "id": current_item.id,
                        "price": price_id,
                    }],
                    proration_behavior=proration_behavior,
                    expand=["latest_invoice.payment_intent"],
                )

                return result

        try:
            sub = await default_retry.execute(_update)
            if sub:
                return {
                    "id": sub.id,
                    "status": sub.status,
                    "current_period_end": datetime.fromtimestamp(sub.current_period_end),
                }
            return None
        except Exception as e:
            logger.error('stripe_subscription_update_failed', subscription_id=subscription_id, error=str(e))
            return None

    async def cancel_subscription(
        self,
        subscription_id: str,
        at_period_end: bool = True
    ) -> Optional[Dict]:
        """Cancel subscription."""
        async def _cancel():
            async with stripe_bulkhead.semaphore:
                result = await stripe_breaker.call(
                    stripe.Subscription.delete_async,
                    subscription_id,
                    **{"at_period_end": at_period_end} if at_period_end else {}
                )
                return result

        try:
            sub = await default_retry.execute(_cancel)
            if sub:
                return {
                    "id": sub.id,
                    "status": sub.status,
                    "cancel_at_period_end": sub.cancel_at_period_end,
                    "canceled_at": datetime.fromtimestamp(sub.canceled_at) if sub.canceled_at else None,
                }
            return None
        except Exception as e:
            logger.error('stripe_subscription_cancel_failed', subscription_id=subscription_id, error=str(e))
            return None

    async def get_invoices(
        self,
        customer_id: str,
        limit: int = 10
    ) -> Optional[list]:
        """Get customer invoices."""
        async def _get():
            async with stripe_bulkhead.semaphore:
                result = await stripe_breaker.call(
                    stripe.Invoice.list_async,
                    customer=customer_id,
                    limit=limit,
                    expand=["data.charge"],
                )
                return result

        try:
            invoices = await default_retry.execute(_get)
            if invoices:
                return [
                    {
                        "id": inv.id,
                        "number": inv.number,
                        "amount": inv.amount_paid / 100,  # Convert from cents
                        "currency": inv.currency.upper(),
                        "status": inv.status,
                        "paid": inv.paid,
                        "paid_at": datetime.fromtimestamp(inv.paid_at) if inv.paid_at else None,
                        "due_date": datetime.fromtimestamp(inv.due_date) if inv.due_date else None,
                        "invoice_pdf": inv.invoice_pdf,
                        "hosted_invoice_url": inv.hosted_invoice_url,
                    }
                    for inv in invoices.data
                ]
            return []
        except Exception as e:
            logger.error('stripe_invoices_list_failed', customer_id=customer_id, error=str(e))
            return []

    async def create_checkout_session(
        self,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        trial_days: int = 0
    ) -> Optional[Dict]:
        """Create checkout session."""
        async def _create():
            async with stripe_bulkhead.semaphore:
                params = {
                    "mode": "subscription",
                    "customer": customer_id,
                    "line_items": [{"price": price_id, "quantity": 1}],
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "billing_address_collection": "required",
                }
                if trial_days > 0:
                    params["subscription_data"] = {"trial_period_days": trial_days}

                result = await stripe_breaker.call(
                    stripe.checkout.Session.create_async,
                    **params
                )
                return result

        try:
            session = await default_retry.execute(_create)
            if session:
                return {
                    "id": session.id,
                    "url": session.url,
                    "client_secret": session.client_secret,
                }
            return None
        except Exception as e:
            logger.error('stripe_checkout_create_failed', customer_id=customer_id, error=str(e))
            return None

    async def create_portal_session(
        self,
        customer_id: str,
        return_url: str
    ) -> Optional[str]:
        """Create customer portal session."""
        async def _create():
            async with stripe_bulkhead.semaphore:
                result = await stripe_breaker.call(
                    stripe.billing.Portal.Session.create_async,
                    customer=customer_id,
                    return_url=return_url,
                )
                return result

        try:
            session = await default_retry.execute(_create)
            return session.url if session else None
        except Exception as e:
            logger.error('stripe_portal_create_failed', customer_id=customer_id, error=str(e))
            return None

    async def retrieve_subscription(self, subscription_id: str) -> Optional[Dict]:
        """Get subscription details."""
        async def _retrieve():
            async with stripe_bulkhead.semaphore:
                result = await stripe_breaker.call(
                    stripe.Subscription.retrieve_async,
                    subscription_id,
                    expand=["items.data.price", "customer"]
                )
                return result

        try:
            sub = await default_retry.execute(_retrieve)
            if sub:
                return {
                    "id": sub.id,
                    "customer_id": sub.customer,
                    "status": sub.status,
                    "current_period_start": datetime.fromtimestamp(sub.current_period_start),
                    "current_period_end": datetime.fromtimestamp(sub.current_period_end),
                    "cancel_at_period_end": sub.cancel_at_period_end,
                    "items": [
                        {
                            "id": item.id,
                            "price_id": item.price.id,
                            "amount": item.price.unit_amount / 100 if item.price.unit_amount else 0,
                        }
                        for item in sub.items.data
                    ],
                }
            return None
        except Exception as e:
            logger.error('stripe_subscription_retrieve_failed', subscription_id=subscription_id, error=str(e))
            return None


# Singleton instance
_stripe_client: Optional[StripeClient] = None


def get_stripe_client() -> StripeClient:
    """Get or create Stripe client."""
    global _stripe_client
    if _stripe_client is None:
        _stripe_client = StripeClient()
    return _stripe_client
