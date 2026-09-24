from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_settings


def _set_local(session: Session, key: str, value: str) -> None:
    session.execute(text("SELECT set_config(:key, :value, true)"), {"key": key, "value": value})


def clear_rls_context(session: Session) -> None:
    for key in ("app.team_id", "app.user_id", "app.role", "app.bypass_rls"):
        _set_local(session, key, "")


def set_system_context(session: Session) -> None:
    """Auth/signup paths that must touch global tables (users, tokens)."""
    if not get_settings().database_enable_rls:
        return
    clear_rls_context(session)
    _set_local(session, "app.bypass_rls", "true")


def set_tenant_context(session: Session, *, team_id: UUID, user_id: UUID, role: str) -> None:
    if not get_settings().database_enable_rls:
        return
    _set_local(session, "app.bypass_rls", "")
    _set_local(session, "app.team_id", str(team_id))
    _set_local(session, "app.user_id", str(user_id))
    _set_local(session, "app.role", role)
