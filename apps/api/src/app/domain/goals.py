"""Goals: the coach says what they expect, the athlete says what they want; each can answer the other."""

from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .commands import COURSES, STROKES, _audit, _now, _owned_athlete
from .models import Competition, Goal
from .serializers import as_uuid

KINDS = {"time", "technical", "other"}
STATUSES = {"active", "achieved", "dropped"}
# Race metrics a technical goal can point at (computed from "Adicionar informação").
METRICS = {"reaction", "at15", "dps", "sr", "underwater"}


def goal_out(row: Goal) -> dict:
    return {
        "id": str(row.id),
        "athleteId": str(row.athlete_id),
        "author": row.author_role,
        "kind": row.kind,
        "stroke": row.stroke,
        "distanceM": row.distance_m,
        "course": row.course,
        "metric": row.metric,
        "targetValue": row.target_value,
        "targetDate": row.target_date.isoformat() if row.target_date else None,
        "competitionId": str(row.competition_id) if row.competition_id else None,
        "text": row.text or "",
        "response": row.response or "",
        "status": row.status,
        "achievedAt": row.achieved_at.isoformat() if row.achieved_at else None,
        "createdAt": row.created_at.isoformat() if row.created_at else "",
    }


def team_goals(session: Session, team_id: UUID) -> list[dict]:
    rows = session.scalars(
        select(Goal).where(Goal.team_id == team_id, Goal.deleted_at.is_(None)).order_by(Goal.created_at.desc())
    ).all()
    return [goal_out(row) for row in rows]


def _role(payload: dict) -> str:
    return "coach" if payload.get("role") == "coach" else "athlete"


def _athlete_for(session: Session, payload: dict, athlete_id) -> UUID:
    target = as_uuid(athlete_id, "athleteId")
    if _role(payload) == "athlete":
        own = payload.get("athlete_uuid")
        if not own or UUID(str(own)) != target:
            raise HTTPException(status_code=403, detail="Só podes editar os teus objetivos.")
    _owned_athlete(session, payload["team_uuid"], target)
    return target


def _text(value, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def save_goal(session: Session, payload: dict, body: dict, request) -> dict:
    role = _role(payload)
    now = _now()
    row = None
    if body.get("id"):
        row = session.get(Goal, as_uuid(body.get("id"), "id"))
        if not row or row.team_id != payload["team_uuid"] or row.deleted_at:
            raise HTTPException(status_code=404, detail="Objetivo não encontrado.")
        _athlete_for(session, payload, row.athlete_id)
    athlete_id = row.athlete_id if row else _athlete_for(session, payload, body.get("athleteId"))

    if row and row.author_role != role and set(body) <= {"id", "athleteId", "response", "status"}:
        # Answering or confirming a goal written by the other side.
        if "response" in body:
            row.response = _text(body.get("response"), 400)
        if role == "coach" and body.get("status") in STATUSES:
            _set_status(row, body["status"], now)
        row.updated_at = now
        _audit(session, payload, "goal.respond", "goal", row.id, request)
        return goal_out(row)

    # Goals are final race times only; splits and technique live in "Adicionar informação".
    kind = "time"
    stroke = body.get("stroke") if body.get("stroke") in STROKES else None
    course = body.get("course") if body.get("course") in COURSES else None
    metric = None
    try:
        distance = int(body["distanceM"]) if body.get("distanceM") else None
        target = float(body["targetValue"]) if body.get("targetValue") not in (None, "") else None
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Objetivo inválido.")
    if kind == "time" and (not stroke or not distance or not target or target <= 0):
        raise HTTPException(status_code=400, detail="Um objetivo de tempo precisa de prova e tempo.")
    if kind == "technical" and (not metric or target is None):
        raise HTTPException(status_code=400, detail="Um objetivo técnico precisa de métrica e valor.")
    text = _text(body.get("text"), 400)
    if kind == "other" and not text:
        raise HTTPException(status_code=400, detail="Escreve o objetivo.")
    target_date = None
    if body.get("targetDate"):
        try:
            target_date = date.fromisoformat(str(body["targetDate"])[:10])
        except ValueError:
            raise HTTPException(status_code=400, detail="Data inválida.")
    competition_id = None
    if body.get("competitionId"):
        meet = session.get(Competition, as_uuid(body["competitionId"], "competitionId"))
        if not meet or meet.team_id != payload["team_uuid"] or meet.deleted_at:
            raise HTTPException(status_code=404, detail="Competição não encontrada.")
        competition_id = meet.id

    if row is None:
        row = Goal(
            id=uuid4(),
            team_id=payload["team_uuid"],
            athlete_id=athlete_id,
            author_role=role,
            author_user_id=payload["user_id"],
            created_at=now,
            status="active",
            response="",
        )
        session.add(row)
    row.kind, row.stroke, row.distance_m, row.course = kind, stroke, distance, course
    row.metric, row.target_value, row.target_date = metric, target, target_date
    row.competition_id, row.text = competition_id, text
    if body.get("status") in STATUSES:
        _set_status(row, body["status"], now)
    row.updated_at = now
    session.flush()
    _audit(session, payload, "goal.save", "goal", row.id, request)
    return goal_out(row)


def _set_status(row: Goal, status: str, now) -> None:
    row.status = status
    row.achieved_at = now if status == "achieved" else None


def delete_goal(session: Session, payload: dict, goal_id: str, request) -> dict:
    row = session.get(Goal, as_uuid(goal_id, "id"))
    if not row or row.team_id != payload["team_uuid"] or row.deleted_at:
        raise HTTPException(status_code=404, detail="Objetivo não encontrado.")
    _athlete_for(session, payload, row.athlete_id)
    _audit(session, payload, "goal.delete", "goal", row.id, request)
    session.delete(row)
    session.flush()
    return {"deleted": True, "id": str(row.id)}
