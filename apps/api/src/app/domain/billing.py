"""Coach subscription billing on Stripe.

Card data never reaches this service: payment happens on Stripe-hosted Checkout, and card or
bank changes happen on the Stripe-hosted customer portal. This module only stores Stripe ids,
subscription status and period end.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from .identity import provision_role
from .models import AuditLog, BillingCustomer, BillingEvent, BillingSubscription, Organization, Team, TeamMember, User

PROVIDER = "stripe"
PLAN_CODE = "coach_monthly"
# past_due keeps access while Stripe retries the card; it ends when Stripe marks it unpaid/canceled.
ACCESS_STATUSES = {"active", "trialing", "past_due"}

_price_cache: dict[str, tuple[float, dict]] = {}


def billing_ready() -> bool:
    s = get_settings()
    return bool(
        s.billing_enabled
        and s.stripe_secret_key.strip()
        and s.stripe_webhook_secret.strip()
        and s.stripe_price_coach_monthly.strip()
    )


def _stripe():
    import stripe

    stripe.api_key = get_settings().stripe_secret_key.strip()
    stripe.max_network_retries = 2
    return stripe


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ts(value) -> datetime | None:
    return datetime.fromtimestamp(int(value), tz=timezone.utc) if value else None


def price_info() -> dict:
    """Price shown to users comes from Stripe, so the page can never disagree with the charge."""
    price_id = get_settings().stripe_price_coach_monthly.strip()
    cached = _price_cache.get(price_id)
    if cached and time.time() - cached[0] < 600:
        return cached[1]
    price = _stripe().Price.retrieve(price_id)
    info = {
        "amountCents": int(price["unit_amount"] or 0),
        "currency": str(price["currency"]),
        "interval": str((price.get("recurring") or {}).get("interval") or "month"),
    }
    _price_cache[price_id] = (time.time(), info)
    return info


def _enforced_from() -> datetime | None:
    raw = get_settings().billing_enforced_from.strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def org_subscription(session: Session, org_id: UUID) -> BillingSubscription | None:
    return session.scalar(
        select(BillingSubscription)
        .join(BillingCustomer, BillingCustomer.id == BillingSubscription.customer_id)
        .where(BillingCustomer.organization_id == org_id, BillingCustomer.provider == PROVIDER)
        .order_by(BillingSubscription.updated_at.desc())
    )


def org_is_exempt(session: Session, org_id: UUID) -> bool:
    enforced = _enforced_from()
    if enforced is None:
        return True
    org = session.get(Organization, org_id)
    return bool(org and org.created_at and org.created_at < enforced)


def org_has_access(session: Session, org_id: UUID) -> bool:
    if org_is_exempt(session, org_id):
        return True
    sub = org_subscription(session, org_id)
    return bool(sub and sub.status in ACCESS_STATUSES)


def create_checkout(user: User, team_name: str, consents: dict) -> str:
    if not billing_ready():
        raise HTTPException(status_code=503, detail="As subscrições de treinador ainda não estão disponíveis.")
    if user.role != "pending":
        raise HTTPException(status_code=409, detail="Esta conta já escolheu o tipo.")
    app_url = get_settings().app_url.rstrip("/")
    checkout = _stripe().checkout.Session.create(
        mode="subscription",
        line_items=[{"price": get_settings().stripe_price_coach_monthly.strip(), "quantity": 1}],
        customer_email=user.email or None,
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id), "team_name": team_name[:80], **consents},
        subscription_data={"metadata": {"user_id": str(user.id)}},
        billing_address_collection="required",
        tax_id_collection={"enabled": True},
        locale="pt",
        custom_text={
            "submit": {
                "message": "A subscrição renova todos os meses até cancelares. Podes cancelar a qualquer momento na área de treinador."
            }
        },
        success_url=f"{app_url}/escolher/pagamento?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{app_url}/escolher?pagamento=cancelado",
    )
    return str(checkout["url"])


def _upsert_billing(session: Session, org_id: UUID, user_id: UUID, customer_id: str, subscription) -> None:
    stamp = _now()
    customer = session.scalar(
        select(BillingCustomer).where(
            BillingCustomer.provider == PROVIDER, BillingCustomer.provider_customer_id == customer_id
        )
    )
    if not customer:
        customer = BillingCustomer(
            id=uuid4(),
            organization_id=org_id,
            user_id=user_id,
            provider=PROVIDER,
            provider_customer_id=customer_id,
            extra={},
            created_at=stamp,
            updated_at=stamp,
        )
        session.add(customer)
        session.flush()
    _write_subscription(session, customer.id, subscription)


def _write_subscription(session: Session, customer_id: UUID, sub) -> BillingSubscription:
    stamp = _now()
    row = session.scalar(
        select(BillingSubscription).where(BillingSubscription.provider_subscription_id == str(sub["id"]))
    )
    items = (sub.get("items") or {}).get("data") or []
    price = items[0]["price"] if items else {}
    period_end = sub.get("current_period_end") or (items[0].get("current_period_end") if items else None)
    values = {
        "status": str(sub["status"]),
        "plan_code": PLAN_CODE,
        "amount_cents": int(price.get("unit_amount") or 0),
        "currency": str(price.get("currency") or "eur"),
        "current_period_end": _ts(period_end),
        "extra": {"cancel_at_period_end": bool(sub.get("cancel_at_period_end"))},
        "updated_at": stamp,
    }
    if row:
        for key, value in values.items():
            setattr(row, key, value)
    else:
        row = BillingSubscription(
            id=uuid4(),
            customer_id=customer_id,
            provider=PROVIDER,
            provider_subscription_id=str(sub["id"]),
            created_at=stamp,
            **values,
        )
        session.add(row)
    session.flush()
    return row


def activate_checkout(session: Session, checkout_id: str, request: Request, expected_user: UUID | None = None) -> User | None:
    """Idempotent: safe to run from both the webhook and the success page."""
    stripe = _stripe()
    checkout = stripe.checkout.Session.retrieve(checkout_id, expand=["subscription"])
    if checkout["mode"] != "subscription" or checkout["status"] != "complete":
        return None
    if checkout["payment_status"] not in {"paid", "no_payment_required"}:
        return None
    try:
        user_id = UUID(str(checkout["client_reference_id"]))
    except (TypeError, ValueError):
        return None
    if expected_user and user_id != expected_user:
        raise HTTPException(status_code=403, detail="Este pagamento não pertence a esta conta.")
    user = session.get(User, user_id)
    if not user:
        return None
    if user.role == "pending":
        team_name = str((checkout.get("metadata") or {}).get("team_name") or "")
        provision_role(session, user, "coach", request, team_name=team_name, paid=True)
    if user.role != "coach":
        return user
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user.id))
    team = session.get(Team, member.team_id) if member else None
    if team and checkout.get("subscription"):
        _upsert_billing(session, team.organization_id, user.id, str(checkout["customer"]), checkout["subscription"])
        session.add(
            AuditLog(
                id=uuid4(),
                organization_id=team.organization_id,
                user_id=user.id,
                action="billing.subscription_started",
                resource_type="billing_subscription",
                resource_id=None,
                ip_address=request.client.host if request.client else None,
                request_id=getattr(request.state, "request_id", None),
                created_at=_now(),
            )
        )
    return user


def sync_subscription(session: Session, sub) -> None:
    customer = session.scalar(
        select(BillingCustomer).where(
            BillingCustomer.provider == PROVIDER, BillingCustomer.provider_customer_id == str(sub["customer"])
        )
    )
    if customer:
        _write_subscription(session, customer.id, sub)


def portal_url(session: Session, org_id: UUID) -> str:
    if not billing_ready():
        raise HTTPException(status_code=503, detail="Gestão de subscrição indisponível.")
    customer = session.scalar(
        select(BillingCustomer).where(BillingCustomer.organization_id == org_id, BillingCustomer.provider == PROVIDER)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Esta equipa não tem subscrição.")
    portal = _stripe().billing_portal.Session.create(
        customer=customer.provider_customer_id,
        return_url=f"{get_settings().app_url.rstrip('/')}/coach/definicoes",
        locale="pt",
    )
    return str(portal["url"])


def handle_event(session: Session, event, request: Request) -> None:
    """Webhook entry point. Each Stripe event id is processed once (billing_events is unique on it)."""
    existing = session.scalar(
        select(BillingEvent).where(BillingEvent.provider == PROVIDER, BillingEvent.provider_event_id == str(event["id"]))
    )
    if existing and existing.processed_at:
        return
    if not existing:
        existing = BillingEvent(
            id=uuid4(),
            provider=PROVIDER,
            provider_event_id=str(event["id"]),
            event_type=str(event["type"]),
            payload={"type": str(event["type"]), "object_id": str(event["data"]["object"].get("id"))},
            created_at=_now(),
        )
        session.add(existing)
        session.flush()

    kind = str(event["type"])
    obj = event["data"]["object"]
    if kind == "checkout.session.completed":
        activate_checkout(session, str(obj["id"]), request)
    elif kind in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        sync_subscription(session, obj)
    elif kind in {"invoice.paid", "invoice.payment_failed"} and obj.get("subscription"):
        sync_subscription(session, _stripe().Subscription.retrieve(str(obj["subscription"])))
    existing.processed_at = _now()
