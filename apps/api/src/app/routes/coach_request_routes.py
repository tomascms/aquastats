"""Coach accounts are granted by hand: a pending user asks, the owner approves from an emailed link.

The link carries an HMAC-signed token (user id, nonce, expiry). The nonce is stored with the
request, so a link stops working once the request is approved, rejected or replaced.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_auth_session
from ..core.mail import send_mail
from ..core.passwords import clean_text
from ..core.sessions import current_user_payload, token_is_current
from ..domain.identity import provision_role
from ..domain.models import Profile, User

router = APIRouter(tags=["coach-requests"])

TOKEN_TTL_SECONDS = 30 * 24 * 3600
RESEND_AFTER_SECONDS = 24 * 3600


def _sign(data: bytes) -> str:
    key = get_settings().session_secret.encode()
    return base64.urlsafe_b64encode(hmac.new(key, b"coach-approval:" + data, hashlib.sha256).digest()).decode().rstrip("=")


def _make_token(user_id: UUID, nonce: str) -> str:
    body = json.dumps({"u": str(user_id), "n": nonce, "e": int(time.time()) + TOKEN_TTL_SECONDS}, separators=(",", ":"))
    data = base64.urlsafe_b64encode(body.encode()).decode().rstrip("=")
    return f"{data}.{_sign(data.encode())}"


def _read_token(session: Session, token: str) -> tuple[User, dict]:
    invalid = HTTPException(status_code=404, detail="Este link já não é válido.")
    try:
        data, signature = token.split(".", 1)
    except ValueError:
        raise invalid
    if not hmac.compare_digest(signature, _sign(data.encode())):
        raise invalid
    try:
        body = json.loads(base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)))
        user = session.get(User, UUID(body["u"]))
    except (ValueError, KeyError, TypeError):
        raise invalid
    request_info = ((user.settings or {}).get("coach_request") or {}) if user else {}
    if not user or body.get("e", 0) < time.time() or request_info.get("nonce") != body.get("n"):
        raise invalid
    return user, request_info


def _current_user(request: Request, session: Session) -> User:
    payload = current_user_payload(request)
    try:
        user = session.get(User, UUID(str(payload["sub"])))
    except (KeyError, ValueError):
        user = None
    if not user or not user.is_active or user.deleted_at or not token_is_current(payload, user):
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    return user


def _set_request(user: User, value: dict | None) -> None:
    settings = dict(user.settings or {})
    if value is None:
        settings.pop("coach_request", None)
    else:
        settings["coach_request"] = value
    user.settings = settings
    user.updated_at = datetime.now(timezone.utc)


@router.get("/api/v1/auth/coach-request")
def my_coach_request(request: Request, session: Session = Depends(get_auth_session)):
    user = _current_user(request, session)
    info = (user.settings or {}).get("coach_request") or {}
    return {"requested": bool(info), "requestedAt": info.get("requested_at"), "teamName": info.get("team_name")}


@router.post("/api/v1/auth/coach-request")
def request_coach_account(body: dict, request: Request, session: Session = Depends(get_auth_session)):
    user = _current_user(request, session)
    if user.role != "pending":
        raise HTTPException(status_code=409, detail="Esta conta já escolheu o tipo.")
    if user.password_hash and not user.is_verified:
        raise HTTPException(status_code=403, detail="Confirma o email antes de continuar.")
    name = clean_text(str(body.get("name") or ""), 80)
    contact = clean_text(str(body.get("contact") or ""), 80)
    team = clean_text(str(body.get("teamName") or ""), 80)
    message = clean_text(str(body.get("message") or ""), 600)
    if len(name) < 2 or len(team) < 2 or len(contact) < 6:
        raise HTTPException(status_code=422, detail="Preenche o nome, o contacto e a equipa.")

    previous = (user.settings or {}).get("coach_request") or {}
    if previous.get("requested_ts", 0) > time.time() - RESEND_AFTER_SECONDS:
        raise HTTPException(status_code=429, detail="O pedido já foi enviado. Responderemos por email.")

    nonce = secrets.token_urlsafe(12)
    stamp = datetime.now(timezone.utc)
    _set_request(
        user,
        {
            "nonce": nonce,
            "name": name,
            "contact": contact,
            "team_name": team,
            "message": message,
            "requested_at": stamp.isoformat(),
            "requested_ts": int(time.time()),
        },
    )
    session.flush()

    link = f"{get_settings().app_url.rstrip('/')}/aprovar-treinador?t={_make_token(user.id, nonce)}"
    sent = send_mail(
        get_settings().coach_request_email,
        # Unique tag per request so mail clients don't fold repeat requests into one conversation.
        f"Aquastats — pedido de conta de treinador #{nonce[:6]}: {team} — {name}",
        "Novo pedido de conta de treinador.\n\n"
        f"Nome: {name}\nEmail: {user.email}\nContacto: {contact}\nEquipa: {team}\n"
        f"Mensagem: {message or '—'}\n\n"
        f"Aprovar ou recusar:\n{link}\n\n"
        "O link vale 30 dias e só pode ser usado uma vez.\n",
    )
    if not sent:
        # HTTPException still commits: undo the request so the user can retry instead of waiting 24h.
        _set_request(user, previous or None)
        raise HTTPException(status_code=503, detail="Não foi possível enviar o pedido agora. Tenta mais tarde.")
    return {"requested": True, "requestedAt": stamp.isoformat()}


@router.get("/api/v1/coach-approval")
def approval_details(t: str, session: Session = Depends(get_auth_session)):
    user, info = _read_token(session, t)
    return {
        "name": info.get("name"),
        "email": user.email,
        "contact": info.get("contact"),
        "teamName": info.get("team_name"),
        "message": info.get("message"),
        "requestedAt": info.get("requested_at"),
        "role": user.role,
    }


@router.post("/api/v1/coach-approval")
def decide(body: dict, request: Request, session: Session = Depends(get_auth_session)):
    user, info = _read_token(session, str(body.get("t") or ""))
    action = str(body.get("action") or "")
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=422, detail="Ação inválida.")
    app_url = get_settings().app_url.rstrip("/")
    if action == "approve":
        if user.role != "pending":
            raise HTTPException(status_code=409, detail="Esta conta já tem um tipo definido.")
        team = info.get("team_name") or ""
        profile = session.get(Profile, user.id)
        if profile and info.get("name") and (not profile.full_name or profile.full_name == "Utilizador"):
            profile.full_name = info["name"]
        provision_role(session, user, "coach", request, team_name=team, approved=True)
        _set_request(user, None)
        if user.email:
            send_mail(
                user.email,
                "Aquastats — conta de treinador aprovada",
                f"A tua conta de treinador foi aprovada e a equipa \"{team}\" já está criada.\n\n"
                f"Entra em {app_url}/entrar para começar.\n",
            )
        return {"status": "approved"}
    _set_request(user, None)
    if user.email:
        send_mail(
            user.email,
            "Aquastats — pedido de conta de treinador",
            "Obrigado pelo interesse. De momento não conseguimos aprovar o teu pedido de conta de treinador.\n\n"
            f"Podes continuar a usar a Aquastats como atleta em {app_url}/entrar.\n",
        )
    return {"status": "rejected"}
