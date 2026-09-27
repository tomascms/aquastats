"""Polar AccessLink: the athlete links their Polar account once; new sessions then land on the workout.

Flow: /start → Polar consent → /callback (token + user registration) → sync pulls the last 30 days of
exercises, downloads each FIT and stores it through heart_rate.store_session (same path as uploads).
Tokens are long-lived and stored encrypted (AES-GCM keyed from SESSION_SECRET).
"""

from __future__ import annotations

import base64
import hashlib
import os
import time
import urllib.parse
from datetime import datetime, timedelta
from uuid import UUID

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.google_oauth import read_oauth_state, sign_oauth_state
from ..core.ssrf import assert_safe_url
from .commands import _now
from .heart_rate import HrFileError, parse_fit, store_session
from .models import Athlete, HrSession, PolarLink

AUTH_URL = "https://flow.polar.com/oauth2/authorization"
TOKEN_URL = "https://polarremote.com/v2/oauth2/token"
API = "https://www.polaraccesslink.com/v3"
SYNC_EVERY = timedelta(minutes=10)
MAX_PER_SYNC = 15
COACH_BATCH = 4


def enabled() -> bool:
    settings = get_settings()
    return bool(settings.polar_client_id and settings.polar_client_secret)


def redirect_uri() -> str:
    return f"{get_settings().app_url.rstrip('/')}/api/v1/integrations/polar/callback"


def _key() -> bytes:
    return hashlib.sha256(("polar:" + get_settings().session_secret).encode()).digest()


def _seal(token: str) -> str:
    nonce = os.urandom(12)
    return base64.urlsafe_b64encode(nonce + AESGCM(_key()).encrypt(nonce, token.encode(), None)).decode()


def _open(sealed: str) -> str:
    raw = base64.urlsafe_b64decode(sealed.encode())
    return AESGCM(_key()).decrypt(raw[:12], raw[12:], None).decode()


def authorize_url(payload: dict) -> str:
    if not enabled():
        raise HTTPException(status_code=503, detail="Ligação à Polar indisponível.")
    athlete_id = payload.get("athlete_uuid")
    if payload.get("role") != "swimmer" or not athlete_id:
        raise HTTPException(status_code=403, detail="Só o atleta pode ligar a sua conta Polar.")
    state = sign_oauth_state(
        {"k": "polar", "a": str(athlete_id), "u": str(payload["user_id"]), "t": str(payload["team_uuid"]), "exp": int(time.time()) + 600}
    )
    params = {"response_type": "code", "client_id": get_settings().polar_client_id, "redirect_uri": redirect_uri(), "state": state}
    return f"{AUTH_URL}?{urllib.parse.urlencode(params)}"


def _client() -> httpx.Client:
    return httpx.Client(timeout=30.0)


def _basic() -> str:
    settings = get_settings()
    return "Basic " + base64.b64encode(f"{settings.polar_client_id}:{settings.polar_client_secret}".encode()).decode()


def finish(session: Session, code: str, state: str) -> None:
    data = read_oauth_state(state)
    if not data or data.get("k") != "polar":
        raise HTTPException(status_code=400, detail="Ligação à Polar expirou. Tenta outra vez.")
    assert_safe_url(TOKEN_URL)
    with _client() as client:
        response = client.post(
            TOKEN_URL,
            data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri()},
            headers={"Authorization": _basic(), "Accept": "application/json"},
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="A Polar recusou a ligação.")
        body = response.json()
        token, polar_user = body.get("access_token"), str(body.get("x_user_id") or "")
        if not token or not polar_user:
            raise HTTPException(status_code=502, detail="A Polar recusou a ligação.")
        # Registering is required once per Polar user; 409 means it already is.
        registered = client.post(
            f"{API}/users",
            json={"member-id": data["a"]},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        if registered.status_code not in (200, 201, 409):
            raise HTTPException(status_code=502, detail="A Polar recusou a ligação.")

    athlete_id = UUID(data["a"])
    link = session.get(PolarLink, athlete_id)
    now = _now()
    if link is None:
        link = PolarLink(athlete_id=athlete_id, created_at=now)
        session.add(link)
    link.team_id = UUID(data["t"])
    link.user_id = UUID(data["u"])
    link.polar_user_id = polar_user
    link.token = _seal(token)
    link.last_sync_at = None
    link.deleted_at = None
    session.flush()


def status(session: Session, payload: dict) -> dict:
    out = {"available": enabled(), "linked": False, "lastSyncAt": None}
    athlete_id = payload.get("athlete_uuid")
    if athlete_id:
        link = session.get(PolarLink, athlete_id)
        if link and not link.deleted_at:
            out.update(linked=True, lastSyncAt=link.last_sync_at.isoformat() if link.last_sync_at else None)
    return out


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def sync_link(session: Session, link: PolarLink, force: bool = False) -> int:
    """Imports new exercises for one athlete. Returns how many sessions were stored."""
    if link.deleted_at or (not force and link.last_sync_at and _now() - link.last_sync_at < SYNC_EVERY):
        return 0
    athlete = session.get(Athlete, link.athlete_id)
    if not athlete or athlete.deleted_at:
        return 0
    # Claim the slot first so parallel requests (two tabs, coach + athlete) do not import twice.
    link.last_sync_at = _now()
    session.flush()
    token = _open(link.token)
    known = set(
        session.scalars(select(HrSession.external_id).where(HrSession.athlete_id == link.athlete_id, HrSession.source == "polar")).all()
    )
    stored = 0
    with _client() as client:
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        listing = client.get(f"{API}/exercises", headers=headers)
        if listing.status_code in (401, 403):
            link.deleted_at = _now()  # the athlete revoked access on Polar's side
            return 0
        listing.raise_for_status()
        for exercise in (listing.json() or [])[:60]:
            exercise_id = str(exercise.get("id") or "")
            if not exercise_id or exercise_id in known or stored >= MAX_PER_SYNC:
                continue
            fit = client.get(f"{API}/exercises/{exercise_id}/fit", headers={"Authorization": f"Bearer {token}", "Accept": "*/*"})
            if fit.status_code != 200:
                continue
            try:
                parsed = parse_fit(fit.content)
            except HrFileError:
                continue
            summary = {"sport": exercise.get("sport"), "device": exercise.get("device")}
            store_session(session, athlete.team_id, athlete.id, parsed, "polar", exercise_id, summary=summary)
            stored += 1
    link.last_sync_at = _now()
    return stored


def sync_for(session: Session, payload: dict, force: bool = False) -> dict:
    """Swimmer: own account. Coach: every linked athlete of the team (throttled per athlete)."""
    if not enabled():
        return {"imported": 0}
    if payload.get("role") == "swimmer":
        athlete_id = payload.get("athlete_uuid")
        links = [session.get(PolarLink, athlete_id)] if athlete_id else []
    else:
        # A coach page load refreshes at most a few athletes (oldest first) to keep the request short.
        links = session.scalars(
            select(PolarLink)
            .where(PolarLink.team_id == payload["team_uuid"], PolarLink.deleted_at.is_(None))
            .order_by(PolarLink.last_sync_at.asc().nulls_first())
            .limit(COACH_BATCH)
        ).all()
    imported = 0
    for link in links:
        if not link:
            continue
        # One athlete failing (Polar down, corrupt file, race on insert) never undoes the others.
        try:
            with session.begin_nested():
                imported += sync_link(session, link, force=force)
        except (httpx.HTTPError, ValueError, IntegrityError):
            continue
    return {"imported": imported}


def disconnect(session: Session, payload: dict) -> dict:
    athlete_id = payload.get("athlete_uuid")
    link = session.get(PolarLink, athlete_id) if athlete_id else None
    if not link or link.deleted_at:
        return {"linked": False}
    try:
        with _client() as client:
            client.delete(f"{API}/users/{link.polar_user_id}", headers={"Authorization": f"Bearer {_open(link.token)}"})
    except httpx.HTTPError:
        pass
    link.deleted_at = _now()
    link.token = ""
    return {"linked": False}
