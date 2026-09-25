"""Coach subscription endpoints. Stripe hosts checkout and card management."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_auth_session, get_session
from ..core.sessions import current_user_payload
from ..core.tenant import require_coach
from ..domain import billing
from ..domain.identity import issue_session, safe_app_path
from ..domain.models import User

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


def _session_user(request: Request, session: Session) -> User:
    payload = current_user_payload(request)
    try:
        user = session.get(User, UUID(str(payload["sub"])))
    except (KeyError, ValueError):
        user = None
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    return user


@router.get("/config")
def billing_config():
    if not billing.billing_ready():
        return {"enabled": False}
    try:
        return {"enabled": True, **billing.price_info()}
    except Exception:
        return {"enabled": False}


@router.post("/checkout")
def start_checkout(body: dict, request: Request, session: Session = Depends(get_auth_session)):
    user = _session_user(request, session)
    if user.password_hash and not user.is_verified:
        raise HTTPException(status_code=403, detail="Confirma o email antes de continuar.")
    team_name = " ".join(str(body.get("teamName") or "").split())[:80]
    if len(team_name) < 2:
        raise HTTPException(status_code=422, detail="Indica o nome da equipa.")
    if body.get("acceptTerms") is not True or body.get("immediateStart") is not True:
        raise HTTPException(status_code=422, detail="Tens de aceitar os Termos e pedir o início imediato do serviço.")
    stamp = datetime.now(timezone.utc).isoformat()
    consents = {"terms_accepted_at": stamp, "immediate_start_requested_at": stamp}
    return {"url": billing.create_checkout(user, team_name, consents)}


@router.post("/confirm")
def confirm_checkout(body: dict, request: Request, response: Response, session: Session = Depends(get_auth_session)):
    user = _session_user(request, session)
    checkout_id = str(body.get("sessionId") or "")
    if not checkout_id.startswith("cs_"):
        raise HTTPException(status_code=422, detail="Pagamento inválido.")
    if not billing.billing_ready():
        raise HTTPException(status_code=503, detail="Pagamentos indisponíveis.")
    updated = billing.activate_checkout(session, checkout_id, request, expected_user=user.id) or user
    if updated.role != "coach":
        return {"role": updated.role, "status": "pending"}
    next_path = issue_session(session, updated, request, response)
    return {"role": "coach", "status": "active", "next": safe_app_path(next_path)}


@router.get("/subscription")
def subscription_status(payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    org_id = payload["org_uuid"]
    sub = billing.org_subscription(session, org_id)
    return {
        "exempt": billing.org_is_exempt(session, org_id),
        "active": billing.org_has_access(session, org_id),
        "status": sub.status if sub else None,
        "amountCents": sub.amount_cents if sub else None,
        "currency": sub.currency if sub else None,
        "currentPeriodEnd": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        "cancelAtPeriodEnd": bool((sub.extra or {}).get("cancel_at_period_end")) if sub else False,
        "manageable": sub is not None and billing.billing_ready(),
    }


@router.post("/portal")
def open_portal(payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return {"url": billing.portal_url(session, payload["org_uuid"])}


@router.post("/webhook")
async def stripe_webhook(request: Request, session: Session = Depends(get_auth_session)):
    secret = get_settings().stripe_webhook_secret.strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook indisponível.")
    import stripe

    raw = await request.body()
    try:
        event = stripe.Webhook.construct_event(raw, request.headers.get("stripe-signature", ""), secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Assinatura inválida.")
    billing.handle_event(session, event, request)
    return {"received": True}
