from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from .models import Athlete, AttendanceSession, Competition, MeetEntry, MeetResult, Profile, RaceSession, SeasonPlan, Team, TimeLog, Workout


def _iso_date(value: date | datetime | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _uuid_list(values: list | None) -> list[str]:
    return [str(item) for item in (values or [])]


def profile_out(row: Profile) -> dict:
    extra = row.extra or {}
    return {
        "id": f"profile-{row.user_id}",
        "name": row.full_name,
        "isPlaceholder": False,
        "dateOfBirth": _iso_date(row.date_of_birth),
        "primaryStroke": row.primary_stroke if row.primary_stroke in {"free", "back", "breast", "fly", "im"} else "",
        "teamId": "",
        "gender": extra.get("gender") if extra.get("gender") in {"M", "F"} else "",
        # Only the current groups; old free-text groups (A, B, C…) are dropped.
        "groupName": extra.get("groupName") if extra.get("groupName") in ("velocidade", "intermedio", "fundo") else "",
        "seedRecords": extra.get("seedRecords") if isinstance(extra.get("seedRecords"), list) else [],
        "wellness": extra.get("wellness") if isinstance(extra.get("wellness"), list) else [],
        "swimrankingsUrl": extra.get("swimrankingsUrl") or "",
        "swimrankingsSyncedAt": extra.get("swimrankingsSyncedAt"),
    }


def athlete_out(row: Athlete) -> dict:
    extra = row.extra or {}
    return {
        "id": str(row.id),
        "name": row.name,
        "isPlaceholder": row.is_placeholder,
        "dateOfBirth": _iso_date(row.date_of_birth),
        "primaryStroke": row.primary_stroke if row.primary_stroke in {"free", "back", "breast", "fly", "im"} else "",
        "teamId": str(row.team_id),
        "gender": extra.get("gender") if extra.get("gender") in {"M", "F"} else "",
        # Only the current groups; old free-text groups (A, B, C…) are dropped.
        "groupName": extra.get("groupName") if extra.get("groupName") in ("velocidade", "intermedio", "fundo") else "",
        "seedRecords": extra.get("seedRecords") if isinstance(extra.get("seedRecords"), list) else [],
        "wellness": extra.get("wellness") if isinstance(extra.get("wellness"), list) else [],
        "swimrankingsUrl": extra.get("swimrankingsUrl") or "",
        "swimrankingsSyncedAt": extra.get("swimrankingsSyncedAt"),
        "active": row.deleted_at is None,
    }


def workout_out(row: Workout) -> dict:
    extra = row.extra or {}
    course = extra.get("course")
    return {
        "id": str(row.id),
        "title": row.title,
        "date": _iso_date(row.workout_date),
        "shift": row.shift,
        "course": course if course in {"scm", "lcm"} else "",
        "athleteIds": _uuid_list(row.athlete_ids),
        "blocks": row.blocks or [],
        "groups": [group for group in extra.get("groups") or [] if isinstance(group, str)],
        "focus": extra.get("focus") or "",
    }


def time_log_out(row: TimeLog) -> dict:
    splits = row.splits or []
    skipped = any(isinstance(item, dict) and item.get("skipped") is True for item in splits)
    return {
        "id": str(row.id),
        "workoutId": str(row.workout_id),
        "blockId": row.block_id,
        "athleteId": str(row.athlete_id),
        "repNumber": row.rep_number,
        "mm": row.mm,
        "ss": row.ss,
        "cc": row.cc,
        "splits": splits,
        "stroke": row.stroke or "",
        "pending": False,
        "skipped": skipped,
        "recordedAt": row.recorded_at.isoformat() if row.recorded_at else "",
    }


def competition_out(row: Competition) -> dict:
    extra = row.extra or {}
    start = _iso_date(row.meet_date)
    return {
        "id": str(row.id),
        "title": row.title,
        "date": start,
        "endDate": extra.get("endDate") or start,
        "course": row.course,
        "venue": row.venue or "",
        "athleteIds": _uuid_list(row.athlete_ids),
        "rules": extra.get("rules") if isinstance(extra.get("rules"), list) else None,
        "live": (
            {key: extra["live"].get(key) for key in ("url", "status", "lastSyncAt")} if isinstance(extra.get("live"), dict) else None
        ),
    }


def entry_out(row: MeetEntry) -> dict:
    extra = row.extra or {}
    return {
        "id": str(row.id),
        "competitionId": str(row.competition_id),
        "athleteId": str(row.athlete_id),
        "stroke": row.stroke,
        "distanceM": row.distance_m,
        # Filled from official files: heat/lane once the start list is out, seed time, schedule.
        **{key: extra.get(key) for key in _ENTRY_EXTRA},
    }


_ENTRY_EXTRA = ("heat", "lane", "entryTimeS", "eventNumber", "date", "sessionTime", "entryCourse", "finalHeat",
                "finalLane", "finalDate", "finalTime")


def result_out(row: MeetResult) -> dict:
    extra = row.extra or {}
    return {
        "id": str(row.id),
        "entryId": str(row.entry_id),
        "mm": row.mm,
        "ss": row.ss,
        "cc": row.cc,
        "splits": row.splits or [],
        "reactionS": extra.get("reactionS"),
        "source": extra.get("source") or "manual",
        # Official swims per round ("heat", "final"): time, reaction, heat, lane.
        "swims": extra.get("swims") or {},
        "recordedAt": row.recorded_at.isoformat() if row.recorded_at else "",
    }


def team_out(row: Team) -> dict:
    return {"id": str(row.id), "name": row.name, "joinCode": row.join_code}


def race_session_out(row: RaceSession) -> dict:
    extra = row.extra or {}
    return {
        "id": str(row.id),
        "athleteId": str(row.athlete_id),
        "competitionId": str(row.competition_id) if row.competition_id else None,
        "entryId": extra.get("entryId") or None,
        "date": _iso_date(row.session_date),
        "tournament": row.tournament or "",
        "course": row.course,
        "distanceM": row.distance_m,
        "stroke": row.stroke,
        "dayPart": row.day_part,
        "reactionS": float(row.reaction_s or 0),
        "flightS": float(row.flight_s or 0),
        "officialTimeS": float(extra.get("officialTimeS") or 0),
        "laps": row.laps or [],
        "createdAt": row.created_at.isoformat() if row.created_at else "",
    }


def season_plan_out(row: SeasonPlan) -> dict:
    payload = row.payload or {}
    return {
        "id": str(row.id),
        "name": row.name,
        "start": _iso_date(row.start_date),
        "end": _iso_date(row.end_date),
        "description": row.description or "",
        "macros": payload.get("macros") or [],
        "mesos": payload.get("mesos") or [],
        "competitions": payload.get("competitions") or [],
        "tests": payload.get("tests") or [],
        "weeklyVolumes": payload.get("weeklyVolumes") or [],
    }


def attendance_out(row: AttendanceSession) -> dict:
    return {
        "id": str(row.id),
        "workoutId": str(row.workout_id) if row.workout_id else None,
        "date": _iso_date(row.session_date),
        "groupName": row.group_name or "",
        "marks": row.marks or [],
        "createdAt": row.created_at.isoformat() if row.created_at else "",
    }


def as_uuid(value: str, field: str = "id") -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=f"{field} inválido.")
