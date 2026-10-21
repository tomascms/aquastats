from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_auth_session, get_session
from ..core.tenant import require_member
from ..domain import polar
from ..domain.models import Athlete
from ..domain.privacy import consent_state

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


def _back(result: str) -> RedirectResponse:
    return RedirectResponse(f"{get_settings().app_url.rstrip('/')}/swimmer/definicoes?polar={result}", status_code=303)


@router.get("/status")
def integrations_status(payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return {"polar": polar.status(session, payload)}


NONCE_COOKIE = "polar_nonce"
NONCE_PATH = "/api/v1/integrations/polar"


@router.get("/polar/start")
def polar_start(payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    athlete = session.get(Athlete, payload["athlete_uuid"]) if payload.get("athlete_uuid") else None
    if athlete and consent_state(session, athlete.user_id, athlete.date_of_birth) not in {"not_required", "granted"}:
        return _back("consent")
    nonce = secrets.token_urlsafe(32)
    response = RedirectResponse(polar.authorize_url(payload, nonce), status_code=303)
    settings = get_settings()
    response.set_cookie(
        NONCE_COOKIE,
        nonce,
        max_age=600,
        httponly=True,
        secure=settings.is_production or settings.app_url.startswith("https://"),
        samesite="lax",
        path=NONCE_PATH,
    )
    return response


@router.get("/polar/callback")
def polar_callback(request: Request, session: Session = Depends(get_auth_session)):
    """Polar's redirect carries no session cookie of ours: the signed state names the athlete (auth role)."""
    code, state = request.query_params.get("code"), request.query_params.get("state")
    if request.query_params.get("error") or not code or not state:
        response = _back("cancelled")
    else:
        try:
            polar.finish(session, code, state, request.cookies.get(NONCE_COOKIE))
            response = _back("ok")
        except HTTPException:
            response = _back("error")
    response.delete_cookie(NONCE_COOKIE, path=NONCE_PATH)
    return response


@router.post("/polar/sync")
def polar_sync(request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return polar.sync_for(session, payload, force=request.query_params.get("force") == "1")


@router.delete("/polar")
def polar_disconnect(payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return polar.disconnect(session, payload)
