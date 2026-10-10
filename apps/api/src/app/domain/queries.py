from __future__ import annotations

from datetime import date
from uuid import UUID

import json

from sqlalchemy import select, text
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
    workout_out,
)


class RawJSON(str):
    """JSON text built by Postgres, spliced into the response as is (see snapshot_body)."""


# Time logs are by far the biggest part of a snapshot (94k rows for 32 athletes over 4 seasons): Postgres
# builds their JSON directly, in the shape of serializers.time_log_out, instead of ORM objects + dicts + encoder.
_TIME_LOGS_JSON = text(
    """
    select coalesce(json_agg(json_build_object(
             'id', t.id, 'workoutId', t.workout_id, 'blockId', t.block_id, 'athleteId', t.athlete_id,
             'repNumber', t.rep_number, 'mm', t.mm, 'ss', t.ss, 'cc', t.cc, 'splits', t.splits,
             'stroke', t.stroke, 'pending', false,
             'skipped', jsonb_path_exists(t.splits, '$[*] ? (@.skipped == true)'),
             'recordedAt', t.recorded_at)), '[]')::text,
           coalesce(array_agg(distinct t.workout_id), '{}')
    from time_logs t
    where t.workout_id = any(:workouts) and (cast(:athlete as uuid) is null or t.athlete_id = cast(:athlete as uuid))
    """
)


# The best official time per athlete, course, stroke and distance, over every season (RLS applies).
_BEST_RESULTS = text(
    """
    select distinct on (e.athlete_id, c.course, e.stroke, e.distance_m)
           e.athlete_id, c.course, e.stroke, e.distance_m, r.mm, r.ss, r.cc, r.id as result_id,
           c.id as competition_id, c.meet_date
    from meet_results r
    join meet_entries e on e.id = r.entry_id
    join competitions c on c.id = e.competition_id
    where c.team_id = :team and c.deleted_at is null and r.mm * 6000 + r.ss * 100 + r.cc > 0
    order by e.athlete_id, c.course, e.stroke, e.distance_m, r.mm * 6000 + r.ss * 100 + r.cc, r.id
    """
)


def team_snapshot(session: Session, team_id: UUID, athlete_id: UUID | None = None, since: date | None = None, before: date | None = None) -> dict:
    """Everything a team page needs. With `athlete_id` (a swimmer) the time logs are only theirs, filtered in
    SQL on top of row-level security, so a swimmer's request never loads the team's history. `since`/`before`
    limit workouts (and their times) by date: the app loads recent weeks first and the older history after."""
    team = session.get(Team, team_id)
    athletes = session.scalars(select(Athlete).where(Athlete.team_id == team_id).order_by(Athlete.name)).all()
    active_athletes = [row for row in athletes if row.deleted_at is None]
    # Workouts, entries and results come as plain rows (same attribute names), not ORM objects: thousands of
    # them, read-only, and hydrating them held the GIL long enough to slow concurrent time writes.
    workout_filter = [Workout.team_id == team_id, Workout.deleted_at.is_(None)]
    if since:
        workout_filter.append(Workout.workout_date >= since)
    if before:
        workout_filter.append(Workout.workout_date < before)
    workouts = session.execute(select(Workout.__table__).where(*workout_filter).order_by(Workout.workout_date.desc())).all()
    workout_ids = [row.id for row in workouts]
    time_logs_json, logged_workouts = "[]", []
    if workout_ids:
        time_logs_json, logged_workouts = session.execute(
            _TIME_LOGS_JSON, {"workouts": workout_ids, "athlete": str(athlete_id) if athlete_id else None}
        ).one()
    # Competitions follow the same window as workouts; personal records still count every season (in SQL).
    meet_filter = [Competition.team_id == team_id, Competition.deleted_at.is_(None)]
    if since:
        meet_filter.append(Competition.meet_date >= since)
    if before:
        meet_filter.append(Competition.meet_date < before)
    shown_meets = session.scalars(select(Competition).where(*meet_filter).order_by(Competition.meet_date.desc())).all()
    meet_ids = [row.id for row in shown_meets]
    entry_table, result_table = MeetEntry.__table__, MeetResult.__table__
    shown_entries = session.execute(select(entry_table).where(entry_table.c.competition_id.in_(meet_ids))).all() if meet_ids else []
    entry_ids = [row.id for row in shown_entries]
    shown_results = session.execute(select(result_table).where(result_table.c.entry_id.in_(entry_ids))).all() if entry_ids else []
    if before:  # older history: the app merges only these (loadOlderHistory)
        return {
            "teamName": team.name if team else "Equipa",
            "workouts": [workout_out(row) for row in workouts],
            "timeLogs": RawJSON(time_logs_json),
            "competitions": [competition_out(row) for row in shown_meets],
            "meetEntries": [entry_out(row) for row in shown_entries],
            "meetResults": [result_out(row) for row in shown_results],
            **{key: [] for key in ("athletes", "raceSessions", "seasonPlans", "attendance", "personalRecords", "goals",
                                   "hrSessions")},
            "_loggedWorkoutIds": [str(item) for item in logged_workouts],
        }
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
        "timeLogs": RawJSON(time_logs_json),
        "competitions": [competition_out(row) for row in shown_meets],
        "meetEntries": [entry_out(row) for row in shown_entries],
        "meetResults": [result_out(row) for row in shown_results],
        "raceSessions": [race_session_out(row) for row in races],
        "seasonPlans": [season_plan_out(row) for row in plans],
        "attendance": [attendance_out(row) for row in attendance],
        "personalRecords": personal_records(session.execute(_BEST_RESULTS, {"team": team_id}).all(), active_athletes),
        "goals": team_goals(session, team_id),
        "hrSessions": team_hr_sessions(session, team_id),
        "_loggedWorkoutIds": [str(item) for item in logged_workouts],
    }


def snapshot_body(data: dict) -> bytes:
    """The response body, with the time logs' JSON spliced in untouched (no re-parsing, no jsonable_encoder)."""
    rest = {key: value for key, value in data.items() if key != "timeLogs" and not key.startswith("_")}
    head = json.dumps(rest, ensure_ascii=False, separators=(",", ":"), default=str)
    return (head[:-1] + ',"timeLogs":' + str(data["timeLogs"]) + "}").encode("utf-8")


def filter_swimmer_snapshot(data: dict, athlete_id: str) -> dict:
    workout_ids = {item["id"] for item in data["workouts"] if athlete_id in (item.get("athleteIds") or [])}
    workout_ids |= set(data.get("_loggedWorkoutIds") or [])  # time logs were filtered to this athlete in SQL
    entry_ids = {item["id"] for item in data["meetEntries"] if item.get("athleteId") == athlete_id}
    meet_ids = {item["competitionId"] for item in data["meetEntries"] if item.get("athleteId") == athlete_id}
    return {
        "teamName": data["teamName"],
        "swimmerId": athlete_id,
        "athletes": [item for item in data["athletes"] if item["id"] == athlete_id and item.get("active", True)],
        "workouts": [item for item in data["workouts"] if item["id"] in workout_ids],
        "timeLogs": data["timeLogs"],
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


def personal_records(best_results: list, athletes: list[Athlete] | None = None) -> list[dict]:
    """Best time per athlete, course, stroke and distance: seed records first, then `_BEST_RESULTS` rows."""
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
    for row in best_results:
        consider(
            (row.athlete_id, row.course, row.stroke, row.distance_m),
            row.mm * 6000 + row.ss * 100 + row.cc,
            {
                "athleteId": str(row.athlete_id),
                "stroke": row.stroke,
                "distanceM": row.distance_m,
                "course": row.course,
                "mm": row.mm,
                "ss": row.ss,
                "cc": row.cc,
                "competitionId": str(row.competition_id),
                "resultId": str(row.result_id),
                "date": row.meet_date.isoformat() if row.meet_date else "",
                "source": "meet",
            },
        )
    return [{key: value for key, value in item.items() if key != "cs"} for item in best.values()]
