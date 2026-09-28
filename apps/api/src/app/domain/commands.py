from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.passwords import clean_text
from .models import (
    Athlete,
    AttendanceSession,
    AuditLog,
    Competition,
    MeetEntry,
    MeetResult,
    Organization,
    OutboxEvent,
    PersonalRecord,
    Profile,
    RaceSession,
    SeasonPlan,
    Team,
    TeamMember,
    TimeLog,
    Workout,
)
from .serializers import (
    as_uuid,
    athlete_out,
    attendance_out,
    competition_out,
    entry_out,
    profile_out,
    race_session_out,
    result_out,
    season_plan_out,
    time_log_out,
    workout_out,
)

STROKES = {"free", "back", "breast", "fly", "im"}
SHIFTS = {"morning", "afternoon"}
COURSES = {"scm", "lcm"}
# Training groups: same meets for everyone, different sessions and season plans.
GROUPS = ("velocidade", "intermedio", "fundo")


def _groups(value) -> list[str]:
    return [group for group in GROUPS if group in (value or [])]


def _focus(value) -> str:
    """The coach's own word for the day (Potência, Tolerância, Aeróbio, Teste…)."""
    return " ".join(str(value or "").split())[:40]
DAY_PARTS = {"am", "pm"}
RACE_DISTANCES = {25, 50, 100, 200, 400, 800, 1500}
ATTENDANCE_STATUS = {"present", "late", "absent"}


def _treino_title(date_value) -> str:
    if hasattr(date_value, "strftime"):
        return date_value.strftime("Treino %d/%m/%Y")
    text = str(date_value or "")
    if len(text) >= 10 and text[4] == "-":
        year, month, day = text[:10].split("-")
        return f"Treino {day}/{month}/{year}"
    return "Treino"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _audit(session: Session, payload: dict, action: str, resource_type: str, resource_id: UUID | None, request) -> None:
    session.add(
        AuditLog(
            id=uuid4(),
            organization_id=payload.get("org_uuid"),
            user_id=payload.get("user_id"),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=request.client.host if request.client else None,
            user_agent=(request.headers.get("user-agent") or "")[:300],
            request_id=getattr(request.state, "request_id", None),
            created_at=_now(),
        )
    )


def _outbox(session: Session, payload: dict, event_type: str, body: dict) -> None:
    session.add(
        OutboxEvent(
            id=uuid4(),
            organization_id=payload.get("org_uuid"),
            event_type=event_type,
            payload=body,
            status="pending",
            next_retry_at=_now(),
            created_at=_now(),
        )
    )


def _owned_athlete(session: Session, team_id: UUID, athlete_id: UUID) -> Athlete:
    row = session.get(Athlete, athlete_id)
    if not row or row.team_id != team_id or row.deleted_at:
        raise HTTPException(status_code=404, detail="Atleta não encontrado.")
    return row


def _owned_workout(session: Session, team_id: UUID, workout_id: UUID) -> Workout:
    row = session.get(Workout, workout_id)
    if not row or row.team_id != team_id or row.deleted_at:
        raise HTTPException(status_code=404, detail="Treino não encontrado.")
    return row


def _owned_meet(session: Session, team_id: UUID, meet_id: UUID) -> Competition:
    row = session.get(Competition, meet_id)
    if not row or row.team_id != team_id or row.deleted_at:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    return row


def _clean_name(value: str) -> str:
    name = " ".join((value or "").split())
    if not name or len(name) > 80:
        raise HTTPException(status_code=400, detail="Nome inválido.")
    return name


def _stroke(value: str) -> str:
    if value not in STROKES:
        raise HTTPException(status_code=400, detail="Estilo inválido.")
    return value


def _as_date(value) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")


def _upsert_seed_records(session: Session, athlete_id: UUID, records: list[dict]) -> None:
    existing = session.scalars(select(PersonalRecord).where(PersonalRecord.athlete_id == athlete_id)).all()
    by_key = {(row.stroke, row.distance_m, row.course): row for row in existing}
    keep: set[tuple] = set()
    for item in records:
        key = (item["stroke"], item["distanceM"], item["course"])
        keep.add(key)
        meet_date = _as_date(item.get("date")) or _now().date()
        row = by_key.get(key)
        if row and (row.competition_id or (row.source or "meet") == "meet"):
            continue
        if row:
            row.mm = item["mm"]
            row.ss = item["ss"]
            row.cc = item["cc"]
            row.meet_date = meet_date
            row.source = "seed"
            row.splits = item.get("splits") or []
            continue
        session.add(
            PersonalRecord(
                id=uuid4(),
                athlete_id=athlete_id,
                stroke=item["stroke"],
                distance_m=item["distanceM"],
                course=item["course"],
                mm=item["mm"],
                ss=item["ss"],
                cc=item["cc"],
                competition_id=None,
                result_id=None,
                meet_date=meet_date,
                source="seed",
                splits=item.get("splits") or [],
            )
        )
    for key, row in by_key.items():
        if key not in keep and not row.competition_id and (row.source or "") == "seed":
            session.delete(row)


def _parse_wellness(raw) -> list[dict]:
    """Daily wellness: sleep hours, gym session and how recovered the swimmer feels (1–5)."""
    by_day: dict[str, dict] = {}
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        day = _as_date(item.get("date"))
        if not day:
            continue
        try:
            sleep = float(item["sleepHours"]) if item.get("sleepHours") not in (None, "") else None
        except (TypeError, ValueError):
            sleep = None
        try:
            recovery = int(item["recovery"]) if item.get("recovery") not in (None, "") else None
        except (TypeError, ValueError):
            recovery = None
        entry = {
            "date": day.isoformat(),
            "sleepHours": sleep if sleep is not None and 0 <= sleep <= 24 else None,
            "gym": item.get("gym") if item.get("gym") in {"strength", "mobility", "explosive"} else None,
            "recovery": recovery if recovery is not None and 1 <= recovery <= 5 else None,
        }
        if entry["sleepHours"] is not None or entry["gym"] or entry["recovery"]:
            by_day[entry["date"]] = entry
    return sorted(by_day.values(), key=lambda entry: entry["date"])[-400:]


def _parse_seed_records(raw, existing) -> list[dict]:
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="Recordes pessoais inválidos.")
    previous: dict[tuple, dict] = {}
    if isinstance(existing, list):
        for item in existing:
            if not isinstance(item, dict):
                continue
            try:
                previous[(item.get("stroke"), int(item.get("distanceM") or 0), item.get("course"))] = item
            except (TypeError, ValueError):
                continue
    out: list[dict] = []
    seen: set[tuple] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        stroke = item.get("stroke")
        course = item.get("course")
        if stroke not in STROKES or course not in COURSES:
            continue
        try:
            distance = int(item.get("distanceM") or 0)
            mm = int(item.get("mm") or 0)
            ss = int(item.get("ss") or 0)
            cc = int(item.get("cc") or 0)
        except (TypeError, ValueError):
            continue
        if distance not in RACE_DISTANCES or distance < 50:
            continue
        if course == "lcm" and stroke == "im" and distance == 100:
            continue
        if not 0 <= mm <= 99 or not 0 <= ss <= 59 or not 0 <= cc <= 99:
            continue
        if mm == 0 and ss == 0 and cc == 0:
            continue
        key = (stroke, distance, course)
        if key in seen:
            continue
        seen.add(key)
        old = previous.get(key) or {}
        out.append(
            {
                "stroke": stroke,
                "distanceM": distance,
                "course": course,
                "mm": mm,
                "ss": ss,
                "cc": cc,
                "date": (_as_date(item.get("date")) or _as_date(old.get("date")) or _now().date()).isoformat(),
                "splits": _parse_seed_splits(item.get("splits"), distance),
                # Provenance survives edits: a SwimRankings time stays marked as such unless the time changes.
                **(
                    {"source": old.get("source")}
                    if old.get("source") == "swimrankings" and (old.get("mm"), old.get("ss"), old.get("cc")) == (mm, ss, cc)
                    else {}
                ),
            }
        )
    return out


def _parse_seed_splits(raw, distance: int) -> list[dict]:
    if not isinstance(raw, list):
        return []
    allowed = set(range(50, distance, 50))
    out: list[dict] = []
    seen: set[int] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            at_m = int(item.get("atM") or 0)
            mm = int(item.get("mm") or 0)
            ss = int(item.get("ss") or 0)
            cc = int(item.get("cc") or 0)
        except (TypeError, ValueError):
            continue
        if at_m not in allowed or at_m in seen:
            continue
        if not 0 <= mm <= 99 or not 0 <= ss <= 59 or not 0 <= cc <= 99:
            continue
        if mm == 0 and ss == 0 and cc == 0:
            continue
        seen.add(at_m)
        out.append({"atM": at_m, "mm": mm, "ss": ss, "cc": cc})
    return sorted(out, key=lambda item: item["atM"])


def create_athlete(session: Session, payload: dict, body: dict, request) -> dict:
    now = _now()
    row = Athlete(
        id=uuid4(),
        team_id=payload["team_uuid"],
        name=_clean_name(body.get("name") or ""),
        date_of_birth=body.get("dateOfBirth") or None,
        primary_stroke=_stroke(body.get("primaryStroke")) if body.get("primaryStroke") in STROKES else "",
        is_placeholder=bool(body.get("isPlaceholder", True)),
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.flush()
    _audit(session, payload, "athlete.create", "athlete", row.id, request)
    _outbox(session, payload, "athlete.created", {"id": str(row.id)})
    return athlete_out(row)


def update_athlete(session: Session, payload: dict, athlete_id: str, body: dict, request) -> dict:
    if payload.get("role") != "swimmer":
        raise HTTPException(status_code=403, detail="Só o atleta edita os seus dados.")
    target = as_uuid(athlete_id, "athleteId")
    if payload.get("athlete_uuid") != target:
        raise HTTPException(status_code=403, detail="Só podes editar a tua ficha.")
    row = _owned_athlete(session, payload["team_uuid"], target)
    row.name = _clean_name(body.get("name") or row.name)
    if "dateOfBirth" in body:  # partial updates (e.g. only wellness) must not wipe the birthday
        row.date_of_birth = _as_date(body.get("dateOfBirth"))
    if "primaryStroke" in body:
        row.primary_stroke = _stroke(str(body.get("primaryStroke"))) if body.get("primaryStroke") in STROKES else ""
    extra = dict(row.extra or {})
    for key in ("bloodType", "allergyDetail", "allergic", "guardianName", "guardianEmail", "guardianPhone", "address"):
        extra.pop(key, None)
    if "gender" in body:
        gender = str(body.get("gender") or "").strip().upper()
        extra["gender"] = "M" if gender in {"M", "MASCULINO"} else "F" if gender in {"F", "FEMININO"} else ""
    if "seedRecords" in body:
        extra["seedRecords"] = _parse_seed_records(body.get("seedRecords"), extra.get("seedRecords") or [])
        _upsert_seed_records(session, row.id, extra["seedRecords"])
    if "wellness" in body:
        extra["wellness"] = _parse_wellness(body.get("wellness"))
    row.extra = extra
    flag_modified(row, "extra")
    row.updated_at = _now()
    _audit(session, payload, "athlete.update", "athlete", row.id, request)
    return athlete_out(row)


def coach_update_athlete(session: Session, payload: dict, athlete_id: str, body: dict, request) -> dict:
    """The coach's part of an athlete: training group, and gender only while the athlete left it empty."""
    row = _owned_athlete(session, payload["team_uuid"], as_uuid(athlete_id, "athleteId"))
    extra = dict(row.extra or {})
    if "groupName" in body:
        group = str(body.get("groupName") or "").strip().lower()
        extra["groupName"] = group if group in GROUPS else ""
    if "gender" in body and extra.get("gender") not in {"M", "F"}:
        gender = str(body.get("gender") or "").strip().upper()
        extra["gender"] = gender if gender in {"M", "F"} else ""
    row.extra = extra
    flag_modified(row, "extra")
    row.updated_at = _now()
    _audit(session, payload, "athlete.coach_update", "athlete", row.id, request)
    return athlete_out(row)


def delete_athlete(session: Session, payload: dict, athlete_id: str, request, purge: bool = False) -> dict:
    """Removes a swimmer from the team. By default their history stays for the team's analyses;
    with `purge` every record of theirs in this team is deleted for good."""
    row = _owned_athlete(session, payload["team_uuid"], as_uuid(athlete_id, "athleteId"))
    if purge:
        _purge_athlete(session, payload["team_uuid"], row)
        _audit(session, payload, "athlete.purge", "athlete", row.id, request)
        return {"ok": True, "purged": True}
    stamp = _now()
    if row.user_id:
        member = session.scalar(
            select(TeamMember).where(TeamMember.user_id == row.user_id, TeamMember.team_id == payload["team_uuid"])
        )
        if member:
            session.delete(member)
        extra = dict(row.extra or {})
        extra["formerUserId"] = str(row.user_id)
        # Keeping the data is the coach's consent for it to follow the swimmer to a new team.
        extra["portable"] = True
        row.extra = extra
        flag_modified(row, "extra")
        row.user_id = None
    row.deleted_at = stamp
    row.updated_at = stamp
    _audit(session, payload, "athlete.kick", "athlete", row.id, request)
    return {"ok": True}


def _purge_athlete(session: Session, team_id, athlete: Athlete) -> None:
    from sqlalchemy import func

    from .models import Goal, HrSession, PolarLink

    aid = athlete.id
    if athlete.user_id:
        member = session.scalar(select(TeamMember).where(TeamMember.user_id == athlete.user_id, TeamMember.team_id == team_id))
        if member:
            session.delete(member)
    entries = select(MeetEntry.id).where(MeetEntry.athlete_id == aid)
    session.execute(delete(PersonalRecord).where(PersonalRecord.athlete_id == aid))
    session.execute(delete(MeetResult).where(MeetResult.entry_id.in_(entries)))
    for model in (MeetEntry, TimeLog, RaceSession, Goal, HrSession, PolarLink):
        session.execute(delete(model).where(model.athlete_id == aid))
    # Their place in selections and workouts, and their attendance marks.
    for model in (Workout, Competition):
        session.execute(
            update(model)
            .where(model.team_id == team_id, model.athlete_ids.any(aid))
            .values(athlete_ids=func.array_remove(model.athlete_ids, aid))
        )
    for sheet in session.scalars(select(AttendanceSession).where(AttendanceSession.team_id == team_id)):
        marks = [mark for mark in (sheet.marks or []) if str(mark.get("athleteId")) != str(aid)]
        if len(marks) != len(sheet.marks or []):
            sheet.marks = marks
            flag_modified(sheet, "marks")
    session.flush()
    session.delete(athlete)
    session.flush()


def _ordered_workout_blocks(blocks: list) -> list:
    order = {"warmup": 0, "main": 1, "recovery": 2}
    return [
        item
        for _, item in sorted(
            enumerate(blocks),
            key=lambda pair: (order.get(str(pair[1].get("type") or "main"), 1) if isinstance(pair[1], dict) else 1, pair[0]),
        )
    ]


def _group_athletes(session: Session, team_id: UUID, groups: list[str]) -> list[UUID]:
    """A workout for a group starts with that group's active swimmers in the water."""
    if not groups:
        return []
    rows = session.scalars(select(Athlete).where(Athlete.team_id == team_id, Athlete.deleted_at.is_(None))).all()
    return [row.id for row in rows if (row.extra or {}).get("groupName") in groups]


def create_workout(session: Session, payload: dict, body: dict, request) -> dict:
    now = _now()
    shift = body.get("shift") or "afternoon"
    if shift not in SHIFTS:
        raise HTTPException(status_code=400, detail="Turno inválido.")
    if body.get("course") not in COURSES:
        raise HTTPException(status_code=400, detail="Escolhe piscina de 25 ou 50 m.")
    row = Workout(
        id=uuid4(),
        team_id=payload["team_uuid"],
        created_by=payload["user_id"],
        title=(body.get("title") or "").strip()[:120] or _treino_title(body.get("date")),
        workout_date=body.get("date"),
        shift=shift,
        athlete_ids=[],  # swimmers are picked per session; a group is only who the session is for
        blocks=_ordered_workout_blocks(body.get("blocks") or []),
        extra={
            **({"course": body.get("course")} if body.get("course") in COURSES else {}),
            "groups": _groups(body.get("groups")),
            "focus": _focus(body.get("focus")),
        },
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.flush()
    _audit(session, payload, "workout.create", "workout", row.id, request)
    _outbox(session, payload, "workout.created", {"id": str(row.id)})
    return workout_out(row)


def update_workout(session: Session, payload: dict, workout_id: str, body: dict, request) -> dict:
    row = _owned_workout(session, payload["team_uuid"], as_uuid(workout_id, "workoutId"))
    if "title" in body:
        row.title = (body.get("title") or "").strip()[:120] or row.title
    if body.get("date"):
        row.workout_date = body["date"]
    if body.get("shift") in SHIFTS:
        row.shift = body["shift"]
    if body.get("course") in COURSES or "groups" in body or "focus" in body:
        extra = dict(row.extra or {})
        if body.get("course") in COURSES:
            extra["course"] = body["course"]
        if "groups" in body:
            extra["groups"] = _groups(body.get("groups"))
        if "focus" in body:
            extra["focus"] = _focus(body.get("focus"))
        row.extra = extra
        flag_modified(row, "extra")
    if "blocks" in body:
        old_blocks = row.blocks or []
        new_blocks = _ordered_workout_blocks(body.get("blocks") or [])
        id_map: dict[str, str] = {}
        for index, new_block in enumerate(new_blocks):
            if not isinstance(new_block, dict):
                continue
            new_id = str(new_block.get("id") or "")
            if index < len(old_blocks) and isinstance(old_blocks[index], dict):
                old_id = str(old_blocks[index].get("id") or "")
                if old_id and new_id and old_id != new_id:
                    id_map[old_id] = new_id
        for old_id, new_id in id_map.items():
            session.execute(
                update(TimeLog)
                .where(TimeLog.workout_id == row.id, TimeLog.block_id == old_id)
                .values(block_id=new_id)
            )
        old_ids = {str(block.get("id")) for block in old_blocks if isinstance(block, dict) and block.get("id")}
        new_ids = {str(block.get("id")) for block in new_blocks if isinstance(block, dict) and block.get("id")}
        removed_ids = old_ids - new_ids - set(id_map.keys())
        if removed_ids:
            session.execute(
                delete(TimeLog).where(TimeLog.workout_id == row.id, TimeLog.block_id.in_(removed_ids))
            )
        row.blocks = new_blocks
    if "athleteIds" in body:
        ids = [as_uuid(item, "athleteId") for item in body.get("athleteIds") or []]
        for item in ids:
            _owned_athlete(session, payload["team_uuid"], item)
        row.athlete_ids = ids
    row.updated_at = _now()
    _audit(session, payload, "workout.update", "workout", row.id, request)
    return workout_out(row)


def delete_workout(session: Session, payload: dict, workout_id: str, request) -> dict:
    row = _owned_workout(session, payload["team_uuid"], as_uuid(workout_id, "workoutId"))
    now = _now()
    session.query(TimeLog).filter(TimeLog.workout_id == row.id).delete(synchronize_session=False)
    for attendance in session.scalars(select(AttendanceSession).where(AttendanceSession.workout_id == row.id, AttendanceSession.deleted_at.is_(None))):
        attendance.deleted_at = now
        attendance.updated_at = now
    row.deleted_at = now
    row.updated_at = now
    _audit(session, payload, "workout.delete", "workout", row.id, request)
    return {"deleted": True, "id": str(row.id)}


def _athlete_for_time(session: Session, team_id: UUID, athlete_id: UUID, workout: Workout) -> Athlete:
    row = session.get(Athlete, athlete_id)
    if not row or row.team_id != team_id:
        raise HTTPException(status_code=404, detail="Atleta não encontrado.")
    if row.deleted_at and athlete_id not in (workout.athlete_ids or []):
        raise HTTPException(status_code=404, detail="Atleta não encontrado.")
    return row


def save_time(session: Session, payload: dict, body: dict, request) -> dict:
    workout = _owned_workout(session, payload["team_uuid"], as_uuid(body.get("workoutId"), "workoutId"))
    athlete = _athlete_for_time(session, payload["team_uuid"], as_uuid(body.get("athleteId"), "athleteId"), workout)
    block_id = str(body.get("blockId") or "")[:80]
    if not block_id:
        raise HTTPException(status_code=400, detail="Bloco inválido.")
    try:
        rep_number = int(body.get("repNumber") or 0)
        mm = int(body.get("mm") or 0)
        ss = int(body.get("ss") or 0)
        cc = int(body.get("cc") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Tempo inválido.")
    if not 1 <= rep_number <= 400 or not 0 <= mm <= 99 or not 0 <= ss <= 59 or not 0 <= cc <= 99:
        raise HTTPException(status_code=400, detail="Tempo inválido.")
    splits = body.get("splits") if isinstance(body.get("splits"), list) else []
    skipped = bool(body.get("skipped"))
    if skipped:
        splits = [{"skipped": True}]
    existing = session.scalar(
        select(TimeLog).where(
            TimeLog.workout_id == workout.id,
            TimeLog.block_id == block_id,
            TimeLog.athlete_id == athlete.id,
            TimeLog.rep_number == rep_number,
        )
    )
    if body.get("stroke"):
        stroke = _stroke(str(body.get("stroke")))
    elif existing and existing.stroke:
        stroke = existing.stroke
    else:
        stroke = ""
    now = _now()
    if mm == 0 and ss == 0 and cc == 0 and not splits and not skipped:
        if existing:
            session.delete(existing)
        return {"deleted": True}
    if existing:
        existing.mm, existing.ss, existing.cc = mm, ss, cc
        existing.splits = splits
        existing.stroke = stroke
        existing.recorded_by = payload["user_id"]
        existing.recorded_at = now
        row = existing
    else:
        row = TimeLog(
            id=uuid4(),
            workout_id=workout.id,
            block_id=block_id,
            athlete_id=athlete.id,
            rep_number=rep_number,
            mm=mm,
            ss=ss,
            cc=cc,
            splits=splits,
            stroke=stroke,
            recorded_by=payload["user_id"],
            recorded_at=now,
        )
        session.add(row)
        session.flush()
    return time_log_out(row)


def create_competition(session: Session, payload: dict, body: dict, request) -> dict:
    course = body.get("course") or "scm"
    if course not in COURSES:
        raise HTTPException(status_code=400, detail="Piscina inválida.")
    now = _now()
    start = body.get("date")
    end = body.get("endDate") or start
    row = Competition(
        id=uuid4(),
        team_id=payload["team_uuid"],
        created_by=payload["user_id"],
        title=(body.get("title") or "").strip()[:120] or "Competição",
        meet_date=start,
        course=course,
        venue=(body.get("venue") or "").strip()[:120],
        athlete_ids=[],
        extra={"endDate": end},
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.flush()
    _audit(session, payload, "meet.create", "competition", row.id, request)
    _outbox(session, payload, "meet.created", {"id": str(row.id)})
    return competition_out(row)


def update_competition(session: Session, payload: dict, meet_id: str, body: dict, request) -> dict:
    row = _owned_meet(session, payload["team_uuid"], as_uuid(meet_id, "competitionId"))
    if "title" in body:
        row.title = (body.get("title") or "").strip()[:120] or row.title
    if body.get("date"):
        row.meet_date = body["date"]
    extra = dict(row.extra or {})
    if body.get("endDate") or body.get("date"):
        extra["endDate"] = body.get("endDate") or body.get("date") or extra.get("endDate")
        row.extra = extra
        flag_modified(row, "extra")
    if body.get("course") in COURSES:
        row.course = body["course"]
    if "venue" in body:
        row.venue = (body.get("venue") or "").strip()[:120]
    if "athleteIds" in body:
        ids = [as_uuid(item, "athleteId") for item in body.get("athleteIds") or []]
        for item in ids:
            _owned_athlete(session, payload["team_uuid"], item)
        removed = {item for item in (row.athlete_ids or []) if item not in ids}
        if removed:
            entries = session.scalars(
                select(MeetEntry).where(MeetEntry.competition_id == row.id, MeetEntry.athlete_id.in_(removed))
            ).all()
            entry_ids = [entry.id for entry in entries]
            if entry_ids:
                session.query(MeetResult).filter(MeetResult.entry_id.in_(entry_ids)).delete(synchronize_session=False)
                session.query(MeetEntry).filter(MeetEntry.id.in_(entry_ids)).delete(synchronize_session=False)
        row.athlete_ids = ids
    row.updated_at = _now()
    _audit(session, payload, "meet.update", "competition", row.id, request)
    return competition_out(row)


def delete_competition(session: Session, payload: dict, meet_id: str, request) -> dict:
    row = _owned_meet(session, payload["team_uuid"], as_uuid(meet_id, "meetId"))
    now = _now()
    entries = session.scalars(select(MeetEntry).where(MeetEntry.competition_id == row.id)).all()
    entry_ids = [entry.id for entry in entries]
    if entry_ids:
        session.query(MeetResult).filter(MeetResult.entry_id.in_(entry_ids)).delete(synchronize_session=False)
        session.query(MeetEntry).filter(MeetEntry.id.in_(entry_ids)).delete(synchronize_session=False)
    for race in session.scalars(select(RaceSession).where(RaceSession.competition_id == row.id, RaceSession.deleted_at.is_(None))):
        race.deleted_at = now
        race.updated_at = now
    row.deleted_at = now
    row.updated_at = now
    _audit(session, payload, "meet.delete", "competition", row.id, request)
    return {"deleted": True, "id": str(row.id)}


def toggle_meet_entry(session: Session, payload: dict, body: dict, request) -> dict:
    meet = _owned_meet(session, payload["team_uuid"], as_uuid(body.get("competitionId"), "competitionId"))
    athlete = _owned_athlete(session, payload["team_uuid"], as_uuid(body.get("athleteId"), "athleteId"))
    stroke = _stroke(body.get("stroke") or "")
    try:
        distance_m = int(body.get("distanceM") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Distância inválida.")
    if distance_m < 50 or distance_m not in RACE_DISTANCES:
        raise HTTPException(status_code=400, detail="Esta prova não existe.")
    if meet.course == "lcm" and stroke == "im" and distance_m == 100:
        raise HTTPException(status_code=400, detail="Não há 100 estilos em piscina de 50 m.")
    existing = session.scalar(
        select(MeetEntry).where(
            MeetEntry.competition_id == meet.id,
            MeetEntry.athlete_id == athlete.id,
            MeetEntry.stroke == stroke,
            MeetEntry.distance_m == distance_m,
        )
    )
    if existing:
        session.query(MeetResult).filter(MeetResult.entry_id == existing.id).delete()
        session.delete(existing)
        return {"deleted": True, "id": str(existing.id)}
    ids = list(meet.athlete_ids or [])
    if athlete.id not in ids:
        ids.append(athlete.id)
        meet.athlete_ids = ids
    row = MeetEntry(id=uuid4(), competition_id=meet.id, athlete_id=athlete.id, stroke=stroke, distance_m=distance_m)
    session.add(row)
    session.flush()
    _audit(session, payload, "meet.entry", "meet_entry", row.id, request)
    return entry_out(row)


def _opt_int(value, low: int, high: int) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if low <= number <= high else None


def save_meet_entry(session: Session, payload: dict, body: dict, request) -> dict:
    """Coach adds or corrects one event by hand; later file/live imports fill whatever is still missing."""
    meet = _owned_meet(session, payload["team_uuid"], as_uuid(body.get("competitionId"), "competitionId"))
    athlete = _owned_athlete(session, payload["team_uuid"], as_uuid(body.get("athleteId"), "athleteId"))
    stroke = _stroke(body.get("stroke") or "")
    distance_m = _opt_int(body.get("distanceM"), 50, 1500)
    if distance_m not in RACE_DISTANCES:
        raise HTTPException(status_code=400, detail="Esta prova não existe.")
    row = session.scalar(
        select(MeetEntry).where(
            MeetEntry.competition_id == meet.id,
            MeetEntry.athlete_id == athlete.id,
            MeetEntry.stroke == stroke,
            MeetEntry.distance_m == distance_m,
        )
    )
    if row is None:
        row = MeetEntry(id=uuid4(), competition_id=meet.id, athlete_id=athlete.id, stroke=stroke, distance_m=distance_m, extra={})
        session.add(row)
    extra = dict(row.extra or {})
    for key, low, high in (("eventNumber", 1, 999), ("heat", 1, 999), ("lane", 0, 10), ("finalHeat", 1, 99), ("finalLane", 0, 10)):
        if key in body:
            extra[key] = _opt_int(body.get(key), low, high)
    for key in ("date", "finalDate"):
        if key in body:
            try:
                extra[key] = date.fromisoformat(str(body[key])[:10]).isoformat() if body.get(key) else None
            except ValueError:
                raise HTTPException(status_code=400, detail="Data inválida.")
    if "entryTimeS" in body:
        try:
            value = float(body["entryTimeS"]) if body.get("entryTimeS") not in (None, "") else None
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Tempo inválido.")
        extra["entryTimeS"] = value if value and 10 <= value <= 3600 else None
    if "entryCourse" in body:
        extra["entryCourse"] = body.get("entryCourse") if body.get("entryCourse") in COURSES else None
    row.extra = extra
    flag_modified(row, "extra")
    ids = list(meet.athlete_ids or [])
    if athlete.id not in ids:
        meet.athlete_ids = [*ids, athlete.id]
    live = (meet.extra or {}).get("live")
    if isinstance(live, dict) and live.get("files"):
        # A new/corrected event must be looked for again in files already read.
        meet.extra = {**meet.extra, "live": {**live, "files": {}}}
        flag_modified(meet, "extra")
    session.flush()
    _audit(session, payload, "meet.entry.save", "meet_entry", row.id, request)
    return entry_out(row)


def delete_meet_entry(session: Session, payload: dict, entry_id: str, request) -> dict:
    """Removing an event removes its result too (and unlinks any race analysis from it)."""
    row = session.get(MeetEntry, as_uuid(entry_id, "entryId"))
    if not row:
        raise HTTPException(status_code=404, detail="Prova não encontrada.")
    _owned_meet(session, payload["team_uuid"], row.competition_id)
    session.query(MeetResult).filter(MeetResult.entry_id == row.id).delete(synchronize_session=False)
    session.delete(row)
    session.flush()
    _audit(session, payload, "meet.entry.delete", "meet_entry", row.id, request)
    return {"deleted": True, "id": str(row.id)}


def save_meet_result(session: Session, payload: dict, body: dict, request) -> dict:
    entry = session.get(MeetEntry, as_uuid(body.get("entryId"), "entryId"))
    if not entry:
        raise HTTPException(status_code=404, detail="Prova não encontrada.")
    meet = _owned_meet(session, payload["team_uuid"], entry.competition_id)
    _owned_athlete(session, payload["team_uuid"], entry.athlete_id)
    try:
        mm = int(body.get("mm") or 0)
        ss = int(body.get("ss") or 0)
        cc = int(body.get("cc") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Tempo inválido.")
    if not 0 <= mm <= 99 or not 0 <= ss <= 59 or not 0 <= cc <= 99:
        raise HTTPException(status_code=400, detail="Tempo inválido.")
    splits = body.get("splits") if isinstance(body.get("splits"), list) else []
    existing = session.scalar(select(MeetResult).where(MeetResult.entry_id == entry.id))
    now = _now()
    if mm == 0 and ss == 0 and cc == 0 and not splits:
        if existing:
            session.delete(existing)
        return {"deleted": True}
    if existing:
        existing.mm, existing.ss, existing.cc = mm, ss, cc
        existing.splits = splits
        existing.recorded_by = payload["user_id"]
        existing.recorded_at = now
        row = existing
    else:
        row = MeetResult(
            id=uuid4(),
            entry_id=entry.id,
            mm=mm,
            ss=ss,
            cc=cc,
            splits=splits,
            recorded_by=payload["user_id"],
            recorded_at=now,
        )
        session.add(row)
        session.flush()
    _ = meet
    return result_out(row)


def _num(value, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number < 0 or number > 9999:
        return default
    return number


def _laps(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    out = []
    for index, raw in enumerate(value[:80], start=1):
        if not isinstance(raw, dict):
            continue
        out.append(
            {
                "n": int(raw.get("n") or index),
                "uw": _num(raw.get("uw")),
                "uwd": _num(raw.get("uwd")),
                "sec15": _num(raw.get("sec15")),
                "sec10": _num(raw.get("sec10")),
                "sec25": _num(raw.get("sec25")),
                "sec35": _num(raw.get("sec35")),
                "sec45": _num(raw.get("sec45")),
                "sec50": _num(raw.get("sec50")),
                "last5": _num(raw.get("last5")),
                "sr": _num(raw.get("sr")),
                "sr1": _num(raw.get("sr1")),
                "sr2": _num(raw.get("sr2")),
                "sc": _num(raw.get("sc")),
                "sc15": _num(raw.get("sc15")),
                "sr15": _num(raw.get("sr15")),
                "sc25": _num(raw.get("sc25")),
                "sr25": _num(raw.get("sr25")),
                "sc35": _num(raw.get("sc35")),
                "sr35": _num(raw.get("sr35")),
                "sc45": _num(raw.get("sc45")),
                "sr45": _num(raw.get("sr45")),
                "sc50": _num(raw.get("sc50")),
                "sr50": _num(raw.get("sr50")),
                "uwKicks": _num(raw.get("uwKicks")),
            }
        )
    return out


def _owned_race(session: Session, team_id: UUID, race_id: UUID) -> RaceSession:
    row = session.get(RaceSession, race_id)
    if not row or row.team_id != team_id or row.deleted_at:
        raise HTTPException(status_code=404, detail="Sessão de prova não encontrada.")
    return row


def save_race_session(session: Session, payload: dict, body: dict, request) -> dict:
    athlete = _owned_athlete(session, payload["team_uuid"], as_uuid(body.get("athleteId"), "athleteId"))
    course = body.get("course") or "scm"
    if course not in COURSES:
        raise HTTPException(status_code=400, detail="Piscina inválida.")
    stroke = _stroke(body.get("stroke") or "free")
    try:
        distance_m = int(body.get("distanceM") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Distância inválida.")
    if distance_m not in RACE_DISTANCES:
        raise HTTPException(status_code=400, detail="Distância inválida.")
    day_part = body.get("dayPart") or "am"
    if day_part not in DAY_PARTS:
        raise HTTPException(status_code=400, detail="Sessão AM/PM inválida.")
    date_value = body.get("date")
    if not date_value:
        raise HTTPException(status_code=400, detail="Data obrigatória.")
    competition_id = None
    if body.get("competitionId"):
        meet = _owned_meet(session, payload["team_uuid"], as_uuid(body.get("competitionId"), "competitionId"))
        competition_id = meet.id
    now = _now()
    extra = {
        "entryId": str(body.get("entryId") or "") or None,
        "officialTimeS": _num(body.get("officialTimeS")),
    }
    race_id = body.get("id")
    row = session.get(RaceSession, as_uuid(race_id, "id")) if race_id else None
    if row and (row.team_id != payload["team_uuid"] or row.deleted_at):
        raise HTTPException(status_code=404, detail="Sessão de prova não encontrada.")
    if row:
        row.athlete_id = athlete.id
        row.competition_id = competition_id
        row.session_date = date_value
        row.tournament = str(body.get("tournament") or "")[:160]
        row.course = course
        row.distance_m = distance_m
        row.stroke = stroke
        row.day_part = day_part
        row.reaction_s = _num(body.get("reactionS"))
        row.flight_s = _num(body.get("flightS"))
        row.laps = _laps(body.get("laps"))
        row.extra = extra
        row.updated_at = now
    else:
        row = RaceSession(
            id=as_uuid(race_id, "id") if race_id else uuid4(),
            team_id=payload["team_uuid"],
            athlete_id=athlete.id,
            competition_id=competition_id,
            session_date=date_value,
            tournament=str(body.get("tournament") or "")[:160],
            course=course,
            distance_m=distance_m,
            stroke=stroke,
            day_part=day_part,
            reaction_s=_num(body.get("reactionS")),
            flight_s=_num(body.get("flightS")),
            laps=_laps(body.get("laps")),
            extra=extra,
            created_by=payload["user_id"],
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
    _audit(session, payload, "race.save", "race_session", row.id, request)
    return race_session_out(row)


def delete_race_session(session: Session, payload: dict, race_id: str, request) -> dict:
    row = _owned_race(session, payload["team_uuid"], as_uuid(race_id, "id"))
    now = _now()
    row.deleted_at = now
    row.updated_at = now
    _audit(session, payload, "race.delete", "race_session", row.id, request)
    return {"deleted": True, "id": str(row.id)}


def _iso_or_none(value) -> str | None:
    try:
        return date.fromisoformat(str(value)[:10]).isoformat()
    except (TypeError, ValueError):
        return None


def _plan_cycles(value) -> list[dict]:
    """Macro/meso cycles: id, type, dates and short free text, bounded."""
    out = []
    for raw in value[:60] if isinstance(value, list) else []:
        if not isinstance(raw, dict):
            continue
        start, end = _iso_or_none(raw.get("start")), _iso_or_none(raw.get("end"))
        if not start or not end or end < start:
            continue
        out.append(
            {
                "id": str(raw.get("id") or uuid4())[:64],
                "type": str(raw.get("type") or "")[:40],
                "label": " ".join(str(raw.get("label") or "").split())[:80],
                "focus": " ".join(str(raw.get("focus") or "").split())[:200],
                "start": start,
                "end": end,
            }
        )
    return out


def _plan_events(value) -> list[dict]:
    out = []
    for raw in value[:200] if isinstance(value, list) else []:
        if not isinstance(raw, dict) or not _iso_or_none(raw.get("date")):
            continue
        out.append(
            {
                "id": str(raw.get("id") or uuid4())[:64],
                "name": " ".join(str(raw.get("name") or "").split())[:120],
                "type": str(raw.get("type") or "")[:20],
                "date": _iso_or_none(raw.get("date")),
                "description": " ".join(str(raw.get("description") or "").split())[:300],
            }
        )
    return out


def _plan_volumes(value) -> list[dict]:
    out = []
    for raw in value[:60] if isinstance(value, list) else []:
        if not isinstance(raw, dict):
            continue
        try:
            week, meters = int(raw.get("week")), int(float(raw.get("meters") or 0))
        except (TypeError, ValueError):
            continue
        if 0 <= week < 60 and 0 <= meters <= 200_000:
            out.append({"week": week, "meters": meters})
    return out


def save_season_plan(session: Session, payload: dict, body: dict, request) -> dict:
    name = " ".join(str(body.get("name") or "").split())[:120]
    if not name:
        raise HTTPException(status_code=400, detail="Nome do plano obrigatório.")
    if not body.get("start") or not body.get("end"):
        raise HTTPException(status_code=400, detail="Datas do plano obrigatórias.")
    try:
        start, end = date.fromisoformat(str(body["start"])[:10]), date.fromisoformat(str(body["end"])[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")
    if end <= start or (end - start).days > 400:
        raise HTTPException(status_code=400, detail="Datas do plano inválidas.")
    now = _now()
    payload_json = {
        "macros": _plan_cycles(body.get("macros")),
        "mesos": _plan_cycles(body.get("mesos")),
        "competitions": _plan_events(body.get("competitions")),
        "tests": _plan_events(body.get("tests")),
        "weeklyVolumes": _plan_volumes(body.get("weeklyVolumes")),
    }
    plan_id = body.get("id")
    row = session.get(SeasonPlan, as_uuid(plan_id, "id")) if plan_id else None
    if row and (row.team_id != payload["team_uuid"] or row.deleted_at):
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    if row:
        row.name = name
        row.start_date = start
        row.end_date = end
        row.description = str(body.get("description") or "")[:2000]
        row.payload = payload_json
        row.updated_at = now
    else:
        row = SeasonPlan(
            id=uuid4(),
            team_id=payload["team_uuid"],
            name=name,
            start_date=start,
            end_date=end,
            description=str(body.get("description") or "")[:2000],
            payload=payload_json,
            created_by=payload["user_id"],
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
    _audit(session, payload, "plan.save", "season_plan", row.id, request)
    return season_plan_out(row)


def delete_season_plan(session: Session, payload: dict, plan_id: str, request) -> dict:
    row = session.get(SeasonPlan, as_uuid(plan_id, "id"))
    if not row or row.team_id != payload["team_uuid"] or row.deleted_at:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    now = _now()
    row.deleted_at = now
    row.updated_at = now
    _audit(session, payload, "plan.delete", "season_plan", row.id, request)
    return {"deleted": True, "id": str(row.id)}


def save_attendance(session: Session, payload: dict, body: dict, request) -> dict:
    if not body.get("date"):
        raise HTTPException(status_code=400, detail="Data da sessão obrigatória.")
    workout_id = None
    if body.get("workoutId"):
        workout = _owned_workout(session, payload["team_uuid"], as_uuid(body.get("workoutId"), "workoutId"))
        workout_id = workout.id
    marks = []
    for raw in body.get("marks") or []:
        if not isinstance(raw, dict) or not raw.get("athleteId"):
            continue
        athlete = _owned_athlete(session, payload["team_uuid"], as_uuid(raw.get("athleteId"), "athleteId"))
        status = raw.get("status") if raw.get("status") in ATTENDANCE_STATUS else "present"
        marks.append(
            {
                "athleteId": str(athlete.id),
                "status": status,
                "volumeM": int(_num(raw.get("volumeM"))),
            }
        )
    now = _now()
    row_id = body.get("id")
    row = session.get(AttendanceSession, as_uuid(row_id, "id")) if row_id else None
    if row and (row.team_id != payload["team_uuid"] or row.deleted_at):
        raise HTTPException(status_code=404, detail="Sessão de presença não encontrada.")
    if row:
        row.workout_id = workout_id
        row.session_date = body.get("date")
        row.group_name = str(body.get("groupName") or "")[:80]
        row.marks = marks
        row.updated_at = now
    else:
        row = AttendanceSession(
            id=uuid4(),
            team_id=payload["team_uuid"],
            workout_id=workout_id,
            session_date=body.get("date"),
            group_name=str(body.get("groupName") or "")[:80],
            marks=marks,
            created_by=payload["user_id"],
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
    _audit(session, payload, "attendance.save", "attendance_session", row.id, request)
    return attendance_out(row)


def update_team(session: Session, payload: dict, body: dict, request) -> dict:
    team = session.get(Team, payload["team_uuid"])
    if not team or team.deleted_at:
        raise HTTPException(status_code=404, detail="Equipa não encontrada.")
    name = clean_text(str(body.get("name") or ""), 80)
    if name:
        team.name = name
        org = session.get(Organization, team.organization_id)
        if org:
            org.name = name
    team.updated_at = datetime.now(timezone.utc)
    _audit(session, payload, "team.update", "team", team.id, request)
    return {"id": str(team.id), "name": team.name, "joinCode": team.join_code}


def update_profile(session: Session, payload: dict, body: dict, request) -> dict:
    name = clean_text(str(body.get("name") or ""), 80)
    if not name:
        raise HTTPException(status_code=400, detail="Nome obrigatório.")
    profile = session.get(Profile, payload["user_id"])
    if profile:
        profile.full_name = name
        profile.updated_at = datetime.now(timezone.utc)
    _audit(session, payload, "profile.update", "profile", payload["user_id"], request)
    return {"name": name}


def update_swimmer_profile(session: Session, user_id: UUID, body: dict, request) -> dict:
    profile = session.get(Profile, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    if "name" in body:
        profile.full_name = _clean_name(body.get("name") or profile.full_name)
    if "dateOfBirth" in body:
        profile.date_of_birth = _as_date(body.get("dateOfBirth"))
    if "primaryStroke" in body:
        profile.primary_stroke = _stroke(str(body.get("primaryStroke"))) if body.get("primaryStroke") in STROKES else ""
    extra = dict(profile.extra or {})
    if "gender" in body:
        gender = str(body.get("gender") or "").strip().upper()
        extra["gender"] = "M" if gender in {"M", "MASCULINO"} else "F" if gender in {"F", "FEMININO"} else ""
    if "seedRecords" in body:
        extra["seedRecords"] = _parse_seed_records(body.get("seedRecords"), extra.get("seedRecords") or [])
    if "wellness" in body:
        extra["wellness"] = _parse_wellness(body.get("wellness"))
    profile.extra = extra
    flag_modified(profile, "extra")
    profile.updated_at = _now()
    _audit(
        session,
        {"user_id": user_id, "role": "swimmer"},
        "swimmer.profile.update",
        "profile",
        user_id,
        request,
    )
    return profile_out(profile)
