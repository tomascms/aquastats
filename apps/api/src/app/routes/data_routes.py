from __future__ import annotations

import gzip
import threading
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_session
from ..core.idempotency import require_key, run_idempotent
from ..core.tenant import require_coach, require_member, require_user
from ..domain import commands, goals, heart_rate, lenex_import, live_results, predictions, swimrankings
from ..domain.models import Profile, TeamMember, User
from ..domain.queries import filter_swimmer_snapshot, snapshot_body, team_snapshot
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
def snapshot(
    request: Request,
    payload: dict = Depends(require_member),
    session: Session = Depends(get_session),
    since: date | None = None,
    before: date | None = None,
):
    window = {"since": since, "before": before}
    with _SNAPSHOT_SLOTS:  # bulkhead: snapshots queue, time writes keep their CPU
        body = _snapshot_body(payload, session, window)
        if "gzip" not in request.headers.get("accept-encoding", ""):
            return Response(body, media_type="application/json")
        # Compressed here, in the worker thread: GZipMiddleware would deflate megabytes on the event loop and stall
        # every other request (time writes included). zlib releases the GIL, so this runs alongside them.
        return Response(gzip.compress(body, 5), media_type="application/json",
                        headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding"})


# ponytail: per-process limit; more instances when one is not enough.
_SNAPSHOT_SLOTS = threading.BoundedSemaphore(1)


def _snapshot_body(payload: dict, session: Session, window: dict) -> bytes:
    if payload.get("role") == "swimmer":
        athlete = payload.get("athlete_uuid")
        # No athlete record yet: nothing of theirs to show (and never the team's times).
        data = team_snapshot(session, payload["team_uuid"], athlete_id=athlete or UUID(int=0), **window)
        data = filter_swimmer_snapshot(data, str(athlete or ""))
    else:
        data = team_snapshot(session, payload["team_uuid"], **window)
    return snapshot_body(data)


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


@router.patch("/athletes/{athlete_id}/coach")
def coach_update_athlete(athlete_id: str, body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    clean = {key: body[key] for key in ("groupName", "gender") if key in body}
    return _command(
        session,
        payload,
        request,
        "athlete.coach_update",
        {"id": athlete_id, **clean},
        lambda: (200, commands.coach_update_athlete(session, payload, athlete_id, clean, request)),
    )


@router.delete("/athletes/{athlete_id}")
def delete_athlete(athlete_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    purge = request.query_params.get("purge") == "1"
    return _command(
        session, payload, request, "athlete.delete", {"id": athlete_id, "purge": purge},
        lambda: (200, commands.delete_athlete(session, payload, athlete_id, request, purge=purge)),
    )


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


@router.put("/meet-entries")
def save_entry(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.entry.save", body, lambda: (200, commands.save_meet_entry(session, payload, body, request)))


@router.delete("/meet-entries/{entry_id}")
def delete_entry(entry_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.entry.delete", {"id": entry_id}, lambda: (200, commands.delete_meet_entry(session, payload, entry_id, request)))


@router.put("/meet-results")
def save_result(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return _command(session, payload, request, "meet.result.save", body, lambda: (200, commands.save_meet_result(session, payload, body, request)))


@router.post("/meet-files/lenex")
def meet_file_lenex(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    if body.get("dryRun"):
        return lenex_import.process_file(session, payload, body, request)
    fingerprint = {k: v for k, v in body.items() if k != "data"} | {"size": len(str(body.get("data") or ""))}
    return _command(
        session,
        payload,
        request,
        "meet.file.lenex",
        fingerprint,
        lambda: (200, lenex_import.process_file(session, payload, body, request)),
    )


@router.put("/competitions/{competition_id}/live")
def live_link(competition_id: str, body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return live_results.set_link(session, payload, competition_id, body.get("url"))


@router.post("/competitions/{competition_id}/live/sync")
def live_sync(competition_id: str, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return live_results.sync_one(session, payload, competition_id, request)


@router.post("/live/sync")
def live_sync_team(request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return live_results.sync_team(session, payload, request)


@router.post("/athletes/{athlete_id}/swimrankings")
def swimrankings_import(athlete_id: str, body: dict, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    if body.get("dryRun"):
        return swimrankings.import_profile(session, payload, athlete_id, body, request)
    fingerprint = {k: v for k, v in body.items() if k != "text"} | {"size": len(str(body.get("text") or ""))}
    return _command(session, payload, request, "athlete.swimrankings", fingerprint, lambda: (200, swimrankings.import_profile(session, payload, athlete_id, body, request)))


@router.put("/athletes/{athlete_id}/records/splits")
def record_splits(athlete_id: str, body: dict, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return _command(session, payload, request, "athlete.record.splits", {"id": athlete_id, **body}, lambda: (200, swimrankings.save_record_splits(session, payload, athlete_id, body, request)))


@router.post("/predictions")
def record_predictions(body: dict, request: Request, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    """Stores training predictions made before their times exist (append-only ledger)."""
    return _command(session, payload, request, "prediction.record", body, lambda: (200, predictions.record_predictions(session, payload, body, request)))


@router.get("/predictions")
def list_predictions(athleteId: str | None = None, since: str | None = None, payload: dict = Depends(require_coach), session: Session = Depends(get_session)):
    return predictions.list_predictions(session, payload, athleteId, since)


@router.put("/goals")
def save_goal(body: dict, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return _command(session, payload, request, "goal.save", body, lambda: (200, goals.save_goal(session, payload, body, request)))


@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: str, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return _command(session, payload, request, "goal.delete", {"id": goal_id}, lambda: (200, goals.delete_goal(session, payload, goal_id, request)))


@router.post("/hr/upload")
def hr_upload(body: dict, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    fingerprint = {k: v for k, v in body.items() if k != "data"} | {"size": len(str(body.get("data") or ""))}
    return _command(session, payload, request, "hr.upload", fingerprint, lambda: (200, heart_rate.upload(session, payload, body, request)))


@router.delete("/hr/{session_id}")
def hr_delete(session_id: str, request: Request, payload: dict = Depends(require_member), session: Session = Depends(get_session)):
    return _command(session, payload, request, "hr.delete", {"id": session_id}, lambda: (200, heart_rate.delete(session, payload, session_id, request)))


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
