from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..domain.models import IdempotencyKey

_STALE_SECONDS = 30


def request_hash(body: Any) -> str:
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def require_key(request: Request) -> str:
    key = (request.headers.get("idempotency-key") or request.headers.get("x-request-id") or "").strip()
    if not key:
        key = f"request-{secrets.token_urlsafe(24)}"
    return key[:128]


def run_idempotent(
    session: Session,
    *,
    user_id: UUID,
    operation: str,
    key: str,
    body: Any,
    producer: Callable[[], tuple[int, dict]],
) -> tuple[int, dict]:
    now = datetime.now(timezone.utc)
    digest = request_hash(body)
    existing = session.get(IdempotencyKey, {"key": key, "operation": operation})
    if existing:
        if existing.user_id != user_id:
            raise HTTPException(status_code=409, detail="Chave de idempotência já usada.")
        if existing.request_hash != digest:
            raise HTTPException(status_code=409, detail="O mesmo Idempotency-Key foi enviado com outro pedido.")
        if existing.status == "completed" and existing.response_body is not None:
            return int(existing.response_status or 200), existing.response_body
        age = (now - existing.created_at).total_seconds() if existing.created_at else 999
        if existing.status == "processing" and age < _STALE_SECONDS:
            raise HTTPException(status_code=409, detail="Pedido ainda a processar.")
        session.delete(existing)
        session.flush()

    row = IdempotencyKey(
        key=key,
        operation=operation,
        user_id=user_id,
        request_hash=digest,
        status="processing",
        expires_at=now + timedelta(hours=24),
        created_at=now,
    )
    try:
        with session.begin_nested():
            session.add(row)
            session.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Pedido ainda a processar.")

    try:
        status, payload = producer()
    except Exception:
        session.delete(row)
        raise
    row.status = "completed"
    row.response_status = status
    row.response_body = payload
    return status, payload
