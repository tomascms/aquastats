from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_session
from ..core.idempotency import require_key, run_idempotent
from ..core.tenant import require_coach, require_member, require_user
from ..domain import commands
from ..domain.models import Profile, TeamMember, User
from ..domain.queries import filter_swimmer_snapshot, team_snapshot
from ..domain.serializers import profile_out
from ..schemas import (
    CompetitionCreateBody,
    ProfilePatchBody,
    SaveTimeBody,
    SwimmerProfilePatch,
    TeamPatchBody,
    UpdateAthleteBody,
    WorkoutCreateBody,
    WorkoutPatchBody,
    parse_body,
)

router = APIRouter(prefix="/api/v1", tags=["data"])


def _command(session: Session, payload: dict, request: Request, operation: str, body: dict, producer):
    key = require_key(request)
    status, data = run_idempotent(
        session,
        user_id=payload["user_id"],
        operation=operation,
        key=key,
        body=body,
        producer=producer,
    )
    return JSONResponse(data, status_code=status)


@router.get("/swimmer/profile")
def get_swimmer_profile(user: User = Depends(require_user), session: Session = Depends(get_session)):
    if user.role not in {"swimmer", "pending"}:
        raise HTTPException(status_code=403, detail="Só atletas.")
    if session.scalar(select(TeamMember).where(TeamMember.user_id == user.id)):
        raise HTTPException(status_code=409, detail="Já estás numa equipa.")
    profile = session.get(Profile, user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    return profile_out(profile)


@router.patch("/swimmer/profile")
def patch_swimmer_profile(body: dict, request: Request, user: User = Depends(require_user), session: Session = Depends(get_session)):
    if user.role not in {"swimmer", "pending"}:
        raise HTTPException(status_code=403, detail="Só atletas.")
    if session.scalar(select(TeamMember).where(TeamMember.user_id == user.id)):
        raise HTTPException(status_code=409, detail="Já estás numa equipa.")
    parsed = parse_body(SwimmerProfilePatch, body)
    return commands.update_swimmer_profile(session, user.id, parsed.model_dump(exclude_none=True), request)


@router.get("/snapshot")
def snapshot(payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    data = team_snapshot(session, payload["team_uuid"])
    if payload.get("role") == "swimmer":
        athlete_id = str(payload.get("athlete_uuid") or "")
        return filter_swimmer_snapshot(data, athlete_id)
    return data


@router.post("/athletes")
def create_athlete():
    raise HTTPException(
        status_code=410,
        detail="O treinador não cria atletas. Envia o link de convite da equipa.",
    )


@router.patch("/athletes/{athlete_id}")
def update_athlete(athlete_id: str, body: dict, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    parsed = parse_body(UpdateAthleteBody, body)
    payload_body = {"id": athlete_id, **parsed.model_dump(exclude_none=True)}
    return _command(
        session,
        payload,
        request,
        "athlete.update",
        payload_body,
        lambda: (200, commands.update_athlete(session, payload, athlete_id, payload_body, request)),
    )


@router.delete("/athletes/{athlete_id}")
def delete_athlete(athlete_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "athlete.delete", {"id": athlete_id}, lambda: (200, commands.delete_athlete(session, payload, athlete_id, request)))


@router.post("/workouts")
def create_workout(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    parsed = parse_body(WorkoutCreateBody, body)
    payload_body = parsed.model_dump(mode="json")
    return _command(session, payload, request, "workout.create", payload_body, lambda: (201, commands.create_workout(session, payload, payload_body, request)))


@router.patch("/workouts/{workout_id}")
def update_workout(workout_id: str, body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    parsed = parse_body(WorkoutPatchBody, body)
    payload_body = {"id": workout_id, **parsed.model_dump(exclude_none=True, mode="json")}
    return _command(session, payload, request, "workout.update", payload_body, lambda: (200, commands.update_workout(session, payload, workout_id, payload_body, request)))


@router.delete("/workouts/{workout_id}")
def delete_workout(workout_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "workout.delete", {"id": workout_id}, lambda: (200, commands.delete_workout(session, payload, workout_id, request)))


@router.put("/times")
def save_time(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    parsed = parse_body(SaveTimeBody, body)
    payload_body = parsed.model_dump(mode="json")
    return _command(
        session,
        payload,
        request,
        "time.save",
        payload_body,
        lambda: (200, commands.save_time(session, payload, payload_body, request)),
    )


@router.post("/competitions")
def create_competition(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    parsed = parse_body(CompetitionCreateBody, body)
    payload_body = parsed.model_dump(mode="json")
    return _command(session, payload, request, "meet.create", payload_body, lambda: (201, commands.create_competition(session, payload, payload_body, request)))


@router.patch("/competitions/{meet_id}")
def update_competition(meet_id: str, body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.update", {"id": meet_id, **body}, lambda: (200, commands.update_competition(session, payload, meet_id, body, request)))


@router.delete("/competitions/{meet_id}")
def delete_competition(meet_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.delete", {"id": meet_id}, lambda: (200, commands.delete_competition(session, payload, meet_id, request)))


@router.post("/meet-entries/toggle")
def toggle_entry(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.entry.toggle", body, lambda: (200, commands.toggle_meet_entry(session, payload, body, request)))


@router.put("/meet-results")
def save_result(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.result.save", body, lambda: (200, commands.save_meet_result(session, payload, body, request)))


@router.put("/race-sessions")
def save_race(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "race.save", body, lambda: (200, commands.save_race_session(session, payload, body, request)))


@router.delete("/race-sessions/{race_id}")
def delete_race(race_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "race.delete", {"id": race_id}, lambda: (200, commands.delete_race_session(session, payload, race_id, request)))


@router.put("/season-plans")
def save_plan(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "plan.save", body, lambda: (200, commands.save_season_plan(session, payload, body, request)))


@router.delete("/season-plans/{plan_id}")
def delete_plan(plan_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "plan.delete", {"id": plan_id}, lambda: (200, commands.delete_season_plan(session, payload, plan_id, request)))


@router.put("/attendance")
def save_attendance(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "attendance.save", body, lambda: (200, commands.save_attendance(session, payload, body, request)))


@router.patch("/team")
def update_team(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    parsed = parse_body(TeamPatchBody, body)
    payload_body = parsed.model_dump(exclude_none=True)
    return _command(session, payload, request, "team.update", payload_body, lambda: (200, commands.update_team(session, payload, payload_body, request)))


@router.patch("/profile")
def update_profile(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    parsed = parse_body(ProfilePatchBody, body)
    payload_body = parsed.model_dump(exclude_none=True)
    return _command(session, payload, request, "profile.update", payload_body, lambda: (200, commands.update_profile(session, payload, payload_body, request)))
