from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_session
from .rls import set_system_context, set_tenant_context
from .sessions import current_user_payload
from ..domain.models import Athlete, Team, TeamMember, User


def require_user(request: Request, session: Session = Depends(get_session)) -> User:
    set_system_context(session)
    payload = current_user_payload(request)
    try:
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    user = session.get(User, user_id)
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    if user.password_hash and not user.is_verified:
        raise HTTPException(status_code=403, detail="Confirma o email antes de continuar.")
    return user


def _load_member(session: Session, user: User) -> tuple[TeamMember, Team]:
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user.id))
    team = session.get(Team, member.team_id) if member else None
    if not member or not team:
        raise HTTPException(status_code=403, detail="Entra numa equipa primeiro.")
    return member, team


def require_coach(request: Request, session: Session = Depends(get_session)) -> dict:
    user = require_user(request, session)
    if user.role == "pending":
        raise HTTPException(status_code=403, detail="Escolhe se és treinador ou atleta.")
    if user.role != "coach":
        raise HTTPException(status_code=403, detail="Só o treinador entra nesta área.")
    member, team = _load_member(session, user)
    if member.status not in {"owner", "coach"}:
        raise HTTPException(status_code=403, detail="Sem acesso a esta equipa.")
    set_tenant_context(session, team_id=team.id, user_id=user.id, role="coach")
    return {
        **current_user_payload(request),
        "role": "coach",
        "user_id": user.id,
        "team_uuid": team.id,
        "org_uuid": team.organization_id,
    }


def require_member(request: Request, session: Session = Depends(get_session)) -> dict:
    user = require_user(request, session)
    if user.role == "pending":
        raise HTTPException(status_code=403, detail="Escolhe se és treinador ou atleta.")
    if user.role not in {"coach", "swimmer"}:
        raise HTTPException(status_code=403, detail="Sem acesso.")
    member, team = _load_member(session, user)
    payload = {
        **current_user_payload(request),
        "role": user.role,
        "user_id": user.id,
        "team_uuid": team.id,
        "org_uuid": team.organization_id,
    }
    if user.role == "coach":
        if member.status not in {"owner", "coach"}:
            raise HTTPException(status_code=403, detail="Sem acesso a esta equipa.")
        set_tenant_context(session, team_id=team.id, user_id=user.id, role="coach")
        return payload
    if member.status != "swimmer":
        raise HTTPException(status_code=403, detail="Só o atleta entra nesta área.")
    athlete = session.scalar(
        select(Athlete).where(Athlete.user_id == user.id, Athlete.team_id == team.id, Athlete.deleted_at.is_(None))
    )
    payload["athlete_uuid"] = athlete.id if athlete else None
    set_tenant_context(session, team_id=team.id, user_id=user.id, role="swimmer")
    return payload
