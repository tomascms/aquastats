from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import OutboxEvent


def claim_outbox(session: Session, limit: int = 20) -> list[OutboxEvent]:
    """Claims due events so only one worker instance processes each event."""
    now = datetime.now(timezone.utc)
    rows = session.scalars(
        select(OutboxEvent)
        .where(
            OutboxEvent.status.in_(("pending", "processing")),
            OutboxEvent.next_retry_at <= now,
        )
        .order_by(OutboxEvent.created_at)
        .with_for_update(skip_locked=True)
        .limit(limit)
    ).all()
    for row in rows:
        row.status = "processing"
        row.attempts = (row.attempts or 0) + 1
    return rows


def complete_outbox(session: Session, row: OutboxEvent) -> None:
    row.status = "processed"
    row.next_retry_at = datetime.now(timezone.utc)


def fail_outbox(session: Session, row: OutboxEvent, error: Exception) -> None:
    now = datetime.now(timezone.utc)
    attempts = row.attempts or 0
    row.error_log = [*(row.error_log or [])[-4:], str(error)[:500]]
    if attempts >= (row.max_attempts or 5):
        row.status = "dead_letter"
        row.next_retry_at = now
        return
    row.status = "pending"
    row.next_retry_at = now + timedelta(seconds=min(3600, 2**attempts * 30))


def drain_outbox(
    session: Session,
    handler: Callable[[str, dict[str, Any]], None],
    limit: int = 20,
) -> int:
    """Processes claimed events and retries failures with bounded backoff."""
    rows = claim_outbox(session, limit)
    for row in rows:
        try:
            handler(row.event_type, row.payload)
        except Exception as exc:
            fail_outbox(session, row, exc)
        else:
            complete_outbox(session, row)
    return len(rows)
