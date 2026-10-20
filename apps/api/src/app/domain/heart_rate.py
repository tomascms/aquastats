"""Heart-rate sessions from watches (FIT / TCX files, Polar, Whoop), attached to existing workouts.

A session is stored once per athlete and source, linked to the workout of that day/shift, and kept
compact: samples downsampled to 5 s plus the watch laps. Per-rep heart rate is derived on the client
from these and the recorded times, so it also works for reps logged after the upload.
"""

from __future__ import annotations

import base64
import binascii
import io
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from defusedxml import ElementTree as SafeET

from .commands import _audit, _now, _owned_athlete
from .models import Athlete, HrSession, Workout
from .privacy import require_athlete_health_consent
from .serializers import as_uuid

MAX_FILE_BYTES = 10 * 1024 * 1024
SAMPLE_STEP_S = 5


class HrFileError(ValueError):
    pass


@dataclass
class ParsedLap:
    start: float  # seconds from session start
    end: float
    distance_m: float
    avg_hr: int | None
    max_hr: int | None


@dataclass
class ParsedSession:
    started_at: datetime
    ended_at: datetime
    samples: list[tuple[int, int]] = field(default_factory=list)  # (offset seconds, bpm)
    laps: list[ParsedLap] = field(default_factory=list)
    sport: str | None = None


def _downsample(points: list[tuple[datetime, int]], start: datetime) -> list[tuple[int, int]]:
    buckets: dict[int, list[int]] = {}
    for stamp, bpm in points:
        if not 25 <= bpm <= 250:
            continue
        offset = int((stamp - start).total_seconds())
        if offset < 0:
            continue
        buckets.setdefault(offset // SAMPLE_STEP_S, []).append(bpm)
    return [(bucket * SAMPLE_STEP_S, round(sum(values) / len(values))) for bucket, values in sorted(buckets.items())]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def parse_fit(data: bytes) -> ParsedSession:
    import fitdecode

    points: list[tuple[datetime, int]] = []
    laps_raw: list[dict] = []
    sport = None
    session_start = None
    try:
        with fitdecode.FitReader(io.BytesIO(data), check_crc=fitdecode.CrcCheck.WARN) as reader:
            for frame in reader:
                if not isinstance(frame, fitdecode.FitDataMessage):
                    continue
                values = {f.name: f.value for f in frame.fields}
                if frame.name == "record" and values.get("timestamp") and values.get("heart_rate"):
                    points.append((_aware(values["timestamp"]), int(values["heart_rate"])))
                elif frame.name == "lap" and values.get("start_time"):
                    laps_raw.append(values)
                elif frame.name == "session":
                    sport = str(values.get("sport") or "") or sport
                    if values.get("start_time"):
                        session_start = _aware(values["start_time"])
    except Exception as exc:  # corrupt / not a FIT file
        raise HrFileError("Ficheiro do relógio inválido.") from exc
    return _assemble(points, laps_raw, session_start, sport, fit=True)


def parse_tcx(data: bytes) -> ParsedSession:
    try:
        root = SafeET.fromstring(data)
    except Exception as exc:
        raise HrFileError("Ficheiro do relógio inválido.") from exc

    def local(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    points: list[tuple[datetime, int]] = []
    laps_raw: list[dict] = []
    for lap in root.iter():
        if local(lap.tag) != "Lap":
            continue
        values: dict = {"start_time": _parse_iso(lap.get("StartTime"))}
        for child in lap:
            name = local(child.tag)
            if name == "TotalTimeSeconds":
                values["total_elapsed_time"] = float(child.text or 0)
            elif name == "DistanceMeters":
                values["total_distance"] = float(child.text or 0)
            elif name in {"AverageHeartRateBpm", "MaximumHeartRateBpm"}:
                value = next((int(v.text) for v in child if local(v.tag) == "Value" and v.text), None)
                values["avg_heart_rate" if name.startswith("Average") else "max_heart_rate"] = value
            elif name == "Track":
                for point in child:
                    stamp = hr = None
                    for item in point:
                        if local(item.tag) == "Time":
                            stamp = _parse_iso(item.text)
                        elif local(item.tag) == "HeartRateBpm":
                            hr = next((int(v.text) for v in item if local(v.tag) == "Value" and v.text), None)
                    if stamp and hr:
                        points.append((stamp, hr))
        if values["start_time"]:
            laps_raw.append(values)
    return _assemble(points, laps_raw, None, None, fit=False)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return _aware(datetime.fromisoformat(value.strip().replace("Z", "+00:00")))
    except ValueError:
        return None


def _assemble(points, laps_raw, session_start, sport, fit: bool) -> ParsedSession:
    points.sort(key=lambda item: item[0])
    starts = [_aware(lap["start_time"]) for lap in laps_raw if lap.get("start_time")]
    start = session_start or (min([p[0] for p in points] + starts) if (points or starts) else None)
    if start is None:
        raise HrFileError("O ficheiro não tem dados de frequência cardíaca.")
    laps: list[ParsedLap] = []
    for lap in laps_raw:
        lap_start = _aware(lap["start_time"])
        elapsed = float(lap.get("total_elapsed_time") or lap.get("total_timer_time") or 0)
        offset = (lap_start - start).total_seconds()
        laps.append(
            ParsedLap(
                start=round(offset, 1),
                end=round(offset + elapsed, 1),
                distance_m=float(lap.get("total_distance") or 0),
                avg_hr=int(lap["avg_heart_rate"]) if lap.get("avg_heart_rate") else None,
                max_hr=int(lap["max_heart_rate"]) if lap.get("max_heart_rate") else None,
            )
        )
    end_candidates = [p[0] for p in points] + [start + timedelta(seconds=lap.end) for lap in laps]
    end = max(end_candidates) if end_candidates else start
    samples = _downsample(points, start)
    if not samples and not any(lap.avg_hr for lap in laps):
        raise HrFileError("O ficheiro não tem dados de frequência cardíaca.")
    return ParsedSession(started_at=start, ended_at=end, samples=samples, laps=laps, sport=sport)


def parse_file(filename: str, data: bytes) -> ParsedSession:
    if len(data) > MAX_FILE_BYTES:
        raise HrFileError("O ficheiro é demasiado grande (máximo 10 MB).")
    name = filename.lower()
    if name.endswith(".fit") or data[8:12] == b".FIT":
        return parse_fit(data)
    if name.endswith(".tcx") or b"TrainingCenterDatabase" in data[:2000]:
        return parse_tcx(data)
    raise HrFileError("Formato não suportado. Usa um ficheiro .FIT ou .TCX do relógio.")


def _local_date_and_shift(moment: datetime, tz_name: str = "Europe/Lisbon") -> tuple[str, str]:
    try:
        from zoneinfo import ZoneInfo

        local = moment.astimezone(ZoneInfo(tz_name))
    except Exception:
        local = moment
    return local.date().isoformat(), ("morning" if local.hour < 13 else "afternoon")


def match_workout(session: Session, team_id: UUID, athlete_id: UUID, started_at: datetime) -> Workout | None:
    """The athlete's workout that day; with two sessions that day, the one of the same shift."""
    day, shift = _local_date_and_shift(started_at)
    workouts = session.scalars(
        select(Workout).where(
            Workout.team_id == team_id, Workout.deleted_at.is_(None), Workout.workout_date == date.fromisoformat(day)
        )
    ).all()
    mine = [w for w in workouts if athlete_id in (w.athlete_ids or [])] or list(workouts)
    if not mine:
        return None
    same_shift = [w for w in mine if w.shift == shift]
    return (same_shift or mine)[0]


def hr_session_out(row: HrSession) -> dict:
    return {
        "id": str(row.id),
        "athleteId": str(row.athlete_id),
        "workoutId": str(row.workout_id) if row.workout_id else None,
        "source": row.source,
        "startedAt": row.started_at.isoformat(),
        "endedAt": row.ended_at.isoformat() if row.ended_at else None,
        "avgHr": row.avg_hr,
        "maxHr": row.max_hr,
        "samples": row.samples or [],
        "laps": row.laps or [],
        "summary": row.summary or {},
    }


def team_hr_sessions(session: Session, team_id: UUID, since: datetime | None = None) -> list[dict]:
    since = since or (_now() - timedelta(days=120))
    rows = session.scalars(
        select(HrSession)
        .where(HrSession.team_id == team_id, HrSession.deleted_at.is_(None), HrSession.started_at >= since)
        .order_by(HrSession.started_at.desc())
    ).all()
    return [hr_session_out(row) for row in rows]


def _target_athlete(session: Session, payload: dict, body: dict) -> UUID:
    if payload.get("role") == "swimmer":
        own = payload.get("athlete_uuid")
        if not own:
            raise HTTPException(status_code=403, detail="Entra numa equipa primeiro.")
        return UUID(str(own))
    athlete_id = as_uuid(body.get("athleteId"), "athleteId")
    _owned_athlete(session, payload["team_uuid"], athlete_id)
    return athlete_id


def store_session(
    session: Session,
    team_id: UUID,
    athlete_id: UUID,
    parsed: ParsedSession,
    source: str,
    external_id: str,
    workout_id: UUID | None = None,
    summary: dict | None = None,
) -> HrSession:
    """Insert or refresh (same athlete + source + external id) and link it to the right workout."""
    workout = session.get(Workout, workout_id) if workout_id else match_workout(session, team_id, athlete_id, parsed.started_at)
    if workout and workout.team_id != team_id:
        workout = None
    hrs = [bpm for _, bpm in parsed.samples] or [lap.avg_hr for lap in parsed.laps if lap.avg_hr]
    maxes = [bpm for _, bpm in parsed.samples] or [lap.max_hr for lap in parsed.laps if lap.max_hr]
    row = session.scalar(
        select(HrSession).where(HrSession.athlete_id == athlete_id, HrSession.source == source, HrSession.external_id == external_id)
    )
    now = _now()
    if row is None:
        row = HrSession(id=uuid4(), team_id=team_id, athlete_id=athlete_id, source=source, external_id=external_id, created_at=now)
        session.add(row)
    row.workout_id = workout.id if workout else None
    row.started_at = parsed.started_at
    row.ended_at = parsed.ended_at
    row.avg_hr = round(sum(hrs) / len(hrs)) if hrs else None
    row.max_hr = max(maxes) if maxes else None
    row.samples = [list(item) for item in parsed.samples]
    row.laps = [
        {"start": lap.start, "end": lap.end, "distanceM": lap.distance_m, "avgHr": lap.avg_hr, "maxHr": lap.max_hr} for lap in parsed.laps
    ]
    row.summary = summary or row.summary or {}
    row.deleted_at = None
    session.flush()
    return row


def upload(session: Session, payload: dict, body: dict, request) -> dict:
    raw = body.get("data")
    if not isinstance(raw, str) or not raw:
        raise HTTPException(status_code=400, detail="Ficheiro em falta.")
    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Ficheiro do relógio inválido.")
    athlete_id = _target_athlete(session, payload, body)
    require_athlete_health_consent(session, session.get(Athlete, athlete_id))
    try:
        parsed = parse_file(str(body.get("filename") or ""), data)
    except HrFileError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    workout_id = as_uuid(body["workoutId"], "workoutId") if body.get("workoutId") else None
    external_id = f"file:{parsed.started_at.isoformat()}"
    row = store_session(session, payload["team_uuid"], athlete_id, parsed, "file", external_id, workout_id)
    _audit(session, payload, "hr.upload", "hr_session", row.id, request)
    return hr_session_out(row)


def delete(session: Session, payload: dict, session_id: str, request) -> dict:
    row = session.get(HrSession, as_uuid(session_id, "id"))
    if not row or row.team_id != payload["team_uuid"] or row.deleted_at:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    if payload.get("role") == "swimmer" and str(row.athlete_id) != str(payload.get("athlete_uuid")):
        raise HTTPException(status_code=403, detail="Sem acesso.")
    _audit(session, payload, "hr.delete", "hr_session", row.id, request)
    session.delete(row)
    session.flush()
    return {"deleted": True, "id": str(row.id)}
