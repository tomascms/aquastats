from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from .goals import team_goals
from .heart_rate import team_hr_sessions
from .models import Athlete, AttendanceSession, Competition, MeetEntry, MeetResult, RaceSession, SeasonPlan, Team, TimeLog, Workout
from .serializers import (
    athlete_out,
    attendance_out,
    competition_out,
    entry_out,
    race_session_out,
    result_out,
    season_plan_out,
    time_log_out,
    workout_out,
)


def team_snapshot(session: Session, team_id: UUID) -> dict:
    team = session.get(Team, team_id)
    athletes = session.scalars(select(Athlete).where(Athlete.team_id == team_id).order_by(Athlete.name)).all()
    active_athletes = [row for row in athletes if row.deleted_at is None]
    workouts = session.scalars(
        select(Workout).where(Workout.team_id == team_id, Workout.deleted_at.is_(None)).order_by(Workout.workout_date.desc())
    ).all()
    workout_ids = [row.id for row in workouts]
    time_logs = (
        session.scalars(select(TimeLog).where(TimeLog.workout_id.in_(workout_ids))).all() if workout_ids else []
    )
    meets = session.scalars(
        select(Competition).where(Competition.team_id == team_id, Competition.deleted_at.is_(None)).order_by(Competition.meet_date.desc())
    ).all()
    meet_ids = [row.id for row in meets]
    entries = session.scalars(select(MeetEntry).where(MeetEntry.competition_id.in_(meet_ids))).all() if meet_ids else []
    entry_ids = [row.id for row in entries]
    results = session.scalars(select(MeetResult).where(MeetResult.entry_id.in_(entry_ids))).all() if entry_ids else []
    races = session.scalars(
        select(RaceSession).where(RaceSession.team_id == team_id, RaceSession.deleted_at.is_(None)).order_by(RaceSession.session_date.desc())
    ).all()
    plans = session.scalars(
        select(SeasonPlan).where(SeasonPlan.team_id == team_id, SeasonPlan.deleted_at.is_(None)).order_by(SeasonPlan.start_date.desc())
    ).all()
    attendance = session.scalars(
        select(AttendanceSession)
        .where(AttendanceSession.team_id == team_id, AttendanceSession.deleted_at.is_(None))
        .order_by(AttendanceSession.session_date.desc())
    ).all()
    return {
        "teamName": team.name if team else "Equipa",
        "joinCode": team.join_code if team else None,
        "athletes": [athlete_out(row) for row in athletes],
        "workouts": [workout_out(row) for row in workouts],
        "timeLogs": [time_log_out(row) for row in time_logs],
        "competitions": [competition_out(row) for row in meets],
        "meetEntries": [entry_out(row) for row in entries],
        "meetResults": [result_out(row) for row in results],
        "raceSessions": [race_session_out(row) for row in races],
        "seasonPlans": [season_plan_out(row) for row in plans],
        "attendance": [attendance_out(row) for row in attendance],
        "personalRecords": personal_records(entries, results, meets, active_athletes),
        "goals": team_goals(session, team_id),
        "hrSessions": team_hr_sessions(session, team_id),
    }


def filter_swimmer_snapshot(data: dict, athlete_id: str) -> dict:
    workout_ids = {item["id"] for item in data["workouts"] if athlete_id in (item.get("athleteIds") or [])}
    workout_ids |= {item["workoutId"] for item in data["timeLogs"] if item.get("athleteId") == athlete_id}
    entry_ids = {item["id"] for item in data["meetEntries"] if item.get("athleteId") == athlete_id}
    meet_ids = {item["competitionId"] for item in data["meetEntries"] if item.get("athleteId") == athlete_id}
    return {
        "teamName": data["teamName"],
        "swimmerId": athlete_id,
        "athletes": [item for item in data["athletes"] if item["id"] == athlete_id and item.get("active", True)],
        "workouts": [item for item in data["workouts"] if item["id"] in workout_ids],
        "timeLogs": [item for item in data["timeLogs"] if item.get("athleteId") == athlete_id],
        "competitions": [item for item in data["competitions"] if item["id"] in meet_ids],
        "meetEntries": [item for item in data["meetEntries"] if item.get("athleteId") == athlete_id],
        "meetResults": [item for item in data["meetResults"] if item.get("entryId") in entry_ids],
        "raceSessions": [item for item in data["raceSessions"] if item.get("athleteId") == athlete_id],
        "attendance": [
            {
                **item,
                "marks": [mark for mark in (item.get("marks") or []) if mark.get("athleteId") == athlete_id],
            }
            for item in data["attendance"]
            if any(mark.get("athleteId") == athlete_id for mark in (item.get("marks") or []))
        ],
        "personalRecords": [item for item in data["personalRecords"] if item.get("athleteId") == athlete_id],
        "goals": [item for item in data.get("goals", []) if item.get("athleteId") == athlete_id],
        "hrSessions": [item for item in data.get("hrSessions", []) if item.get("athleteId") == athlete_id],
    }


def personal_records(
    entries: list[MeetEntry],
    results: list[MeetResult],
    meets: list[Competition],
    athletes: list[Athlete] | None = None,
) -> list[dict]:
    meet_map = {row.id: row for row in meets}
    entry_map = {row.id: row for row in entries}
    best: dict[tuple, dict] = {}

    def consider(key: tuple, cs: int, payload: dict) -> None:
        current = best.get(key)
        if current is None or cs < current["cs"]:
            best[key] = {"cs": cs, **payload}

    for athlete in athletes or []:
        extra = athlete.extra or {}
        for item in extra.get("seedRecords") or []:
            if not isinstance(item, dict):
                continue
            try:
                cs = int(item.get("mm") or 0) * 6000 + int(item.get("ss") or 0) * 100 + int(item.get("cc") or 0)
                distance = int(item.get("distanceM") or 0)
            except (TypeError, ValueError):
                continue
            if cs <= 0:
                continue
            consider(
                (athlete.id, item.get("course"), item.get("stroke"), distance),
                cs,
                {
                    "athleteId": str(athlete.id),
                    "stroke": item.get("stroke"),
                    "distanceM": distance,
                    "course": item.get("course"),
                    "mm": int(item.get("mm") or 0),
                    "ss": int(item.get("ss") or 0),
                    "cc": int(item.get("cc") or 0),
                    "competitionId": "",
                    "resultId": "",
                    "date": item.get("date") or "",
                    "source": "seed",
                    "splits": item.get("splits") if isinstance(item.get("splits"), list) else [],
                },
            )
    for result in results:
        cs = result.mm * 6000 + result.ss * 100 + result.cc
        if cs <= 0:
            continue
        entry = entry_map.get(result.entry_id)
        if not entry:
            continue
        meet = meet_map.get(entry.competition_id)
        if not meet:
            continue
        consider(
            (entry.athlete_id, meet.course, entry.stroke, entry.distance_m),
            cs,
            {
                "athleteId": str(entry.athlete_id),
                "stroke": entry.stroke,
                "distanceM": entry.distance_m,
                "course": meet.course,
                "mm": result.mm,
                "ss": result.ss,
                "cc": result.cc,
                "competitionId": str(meet.id),
                "resultId": str(result.id),
                "date": meet.meet_date.isoformat() if meet.meet_date else "",
                "source": "meet",
            },
        )
    return [{key: value for key, value in item.items() if key != "cs"} for item in best.values()]
