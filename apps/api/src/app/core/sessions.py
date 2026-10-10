from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .config import get_settings
from .client import stored_ip
from .http_security import compare, new_token, sha256
from ..domain.models import RefreshToken, User

ACCESS_COOKIE = "sa_access"
REFRESH_COOKIE = "sa_refresh"


def _secret() -> bytes:
    raw = get_settings().session_secret.strip()
    if len(raw) < 32:
        raise RuntimeError("SESSION_SECRET (>=32 caracteres) é obrigatório")
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _b64(data: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64d(data: str) -> bytes:
    import base64

    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sign_access(user_id: str, role: str, team_id: str, org_id: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "team_id": team_id,
        "org_id": org_id,
        "exp": int(time.time()) + get_settings().access_ttl_seconds,
        "iat": int(time.time()),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_access(token: str | None) -> dict | None:
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    expected = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    if not compare(sig, expected):
        return None
    try:
        payload = json.loads(_b64d(body).decode())
    except Exception:
        return None
    if int(payload.get("exp") or 0) < int(time.time()):
        return None
    return payload


def cookie_kwargs() -> dict:
    settings = get_settings()
    secure = settings.is_production or settings.app_url.startswith("https://")
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "lax",
        "path": "/",
    }


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    settings = get_settings()
    base = cookie_kwargs()
    response.set_cookie(ACCESS_COOKIE, access, max_age=settings.access_ttl_seconds, **base)
    response.set_cookie(REFRESH_COOKIE, refresh, max_age=settings.refresh_ttl_seconds, **base)


def clear_auth_cookies(response: Response) -> None:
    base = cookie_kwargs()
    response.delete_cookie(ACCESS_COOKIE, path=base["path"])
    response.delete_cookie(REFRESH_COOKIE, path=base["path"])


def issue_refresh(session: Session, user_id: UUID, family_id: UUID | None, request: Request) -> str:
    token = new_token(48)
    now = datetime.now(timezone.utc)
    row = RefreshToken(
        id=uuid4(),
        user_id=user_id,
        token_hash=sha256(token),
        family_id=family_id or uuid4(),
        expires_at=now + timedelta(seconds=get_settings().refresh_ttl_seconds),
        ip_address=stored_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        created_at=now,
    )
    session.add(row)
    return token


def rotate_refresh(session: Session, presented: str, request: Request) -> tuple[User, str]:
    now = datetime.now(timezone.utc)
    digest = sha256(presented)
    row = session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == digest)
        .with_for_update()
    )
    if not row or row.revoked_at or row.expires_at < now:
        if row:
            session.query(RefreshToken).filter(
                RefreshToken.family_id == row.family_id,
                RefreshToken.revoked_at.is_(None),
            ).update(
                {"revoked_at": now, "reused_at": now},
                synchronize_session=False,
            )
            if row.revoked_at is None:
                row.reused_at = now
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    row.revoked_at = now
    user = session.get(User, row.user_id)
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(status_code=401, detail="Conta inactiva.")
    new = issue_refresh(session, user.id, row.family_id, request)
    return user, new


def revoke_user_sessions(session: Session, user_id: UUID) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )


def current_user_payload(request: Request) -> dict:
    payload = read_access(request.cookies.get(ACCESS_COOKIE))
    if not payload:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return payload
