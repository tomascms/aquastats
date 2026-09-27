from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_session
from ..core.rls import set_system_context
from ..core.tenant import require_member
from ..domain import polar

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


def _back(result: str) -> RedirectResponse:
    return RedirectResponse(f"{get_settings().app_url.rstrip('/')}/swimmer/definicoes?polar={result}", status_code=303)


@router.get("/status")
def integrations_status(payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return {"polar": polar.status(session, payload)}


@router.get("/polar/start")
def polar_start(payload: dict = Depends(require_member)):
    return RedirectResponse(polar.authorize_url(payload), status_code=303)


@router.get("/polar/callback")
def polar_callback(request: Request, session: Session = Depends(get_session)):
    code, state = request.query_params.get("code"), request.query_params.get("state")
    if request.query_params.get("error") or not code or not state:
        return _back("cancelled")
    set_system_context(session)
    try:
        polar.finish(session, code, state)
    except HTTPException:
        return _back("error")
    return _back("ok")


@router.post("/polar/sync")
def polar_sync(request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return polar.sync_for(session, payload, force=request.query_params.get("force") == "1")


@router.delete("/polar")
def polar_disconnect(payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return polar.disconnect(session, payload)
