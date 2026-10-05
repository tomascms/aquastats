"""Prediction ledger: training predictions stored when they are made, before the time they predict exists.

The model runs in the browser (apps/web/src/lib/ml); this module only keeps an honest record:
- a prediction is accepted only while that rep has no time yet, so nothing can be "predicted" after
  the fact;
- the first prediction for a (model, version, horizon, rep) wins and is never changed;
- outcomes are the time_logs entered later, paired on read (a corrected typo is simply re-paired).
"""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .commands import _now
from .models import Athlete, PredictionLedger, TimeLog, Workout
from .serializers import as_uuid

ROLES = {"champion", "challenger"}
HORIZONS = {"rep", "day", "week", "month", "year"}
CONFIDENCES = {"alta", "média", "baixa"}
MAX_ITEMS = 500
MAX_DETAILS_CHARS = 4000


def ledger_out(row: PredictionLedger) -> dict:
    return {
        "id": str(row.id),
        "athleteId": str(row.athlete_id),
        "workoutId": str(row.workout_id),
        "blockId": row.block_id,
        "repNumber": row.rep_number,
        "targetDate": row.target_date.isoformat() if row.target_date else None,
        "model": row.model,
        "modelVersion": row.model_version,
        "role": row.role,
        "horizon": row.horizon,
        "meanS": row.mean_s,
        "loS": row.lo_s,
        "hiS": row.hi_s,
        "nominal": row.nominal,
        "sdS": row.sd_s,
        "confidence": row.confidence,
        "details": row.details or {},
        "predictedAt": row.predicted_at.isoformat() if row.predicted_at else "",
    }


def _label(value, limit: int, field: str) -> str:
    text = str(value or "").strip()
    if not text or len(text) > limit:
        raise HTTPException(status_code=400, detail=f"{field} inválido.")
    return text


def _positive(value, field: str, upper: float = 3600.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} inválido.")
    if not math.isfinite(number) or not 0 < number < upper:
        raise HTTPException(status_code=400, detail=f"{field} inválido.")
    return number


def _optional(value, field: str, upper: float = 3600.0) -> float | None:
    return None if value is None else _positive(value, field, upper)


def _item(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Previsão inválida.")
    try:
        rep_number = int(raw.get("repNumber") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Previsão inválida.")
    if not 1 <= rep_number <= 400:
        raise HTTPException(status_code=400, detail="Previsão inválida.")
    try:
        target = date.fromisoformat(str(raw.get("targetDate") or ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")
    mean = _positive(raw.get("meanS"), "Tempo previsto")
    lo = _optional(raw.get("loS"), "Intervalo")
    hi = _optional(raw.get("hiS"), "Intervalo")
    if (lo is not None and lo > mean) or (hi is not None and hi < mean):
        raise HTTPException(status_code=400, detail="Intervalo inválido.")
    nominal = raw.get("nominal")
    if nominal is not None:
        nominal = _positive(nominal, "Nível do intervalo", 1.0)
    details = raw.get("details") if isinstance(raw.get("details"), dict) else {}
    if len(json.dumps(details, ensure_ascii=False)) > MAX_DETAILS_CHARS:
        details = {}
    confidence = raw.get("confidence") if raw.get("confidence") in CONFIDENCES else None
    return {
        "athlete_id": as_uuid(raw.get("athleteId"), "athleteId"),
        "workout_id": as_uuid(raw.get("workoutId"), "workoutId"),
        "block_id": _label(raw.get("blockId"), 80, "Bloco"),
        "rep_number": rep_number,
        "target_date": target,
        "mean_s": mean,
        "lo_s": lo,
        "hi_s": hi,
        "nominal": nominal,
        "sd_s": _optional(raw.get("sdS"), "Desvio"),
        "confidence": confidence,
        "details": details,
    }


def record_predictions(session: Session, payload: dict, body: dict, _request=None) -> dict:
    team_id: UUID = payload["team_uuid"]
    model = _label(body.get("model"), 60, "Modelo")
    version = _label(body.get("modelVersion"), 40, "Versão")
    role = body.get("role") if body.get("role") in ROLES else None
    horizon = body.get("horizon") if body.get("horizon") in HORIZONS else None
    if not role or not horizon:
        raise HTTPException(status_code=400, detail="Previsão inválida.")
    raw_items = body.get("items")
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > MAX_ITEMS:
        raise HTTPException(status_code=400, detail="Previsões inválidas.")
    items = [_item(raw) for raw in raw_items]

    workout_ids = {item["workout_id"] for item in items}
    workouts: dict[UUID, Workout] = {}
    for workout_id in workout_ids:
        row = session.get(Workout, workout_id)
        if row and row.team_id == team_id and not row.deleted_at:
            workouts[workout_id] = row
    athletes: dict[UUID, Athlete] = {}
    for athlete_id in {item["athlete_id"] for item in items}:
        row = session.get(Athlete, athlete_id)
        if row and row.team_id == team_id and not row.deleted_at:
            athletes[athlete_id] = row

    # A prediction only counts while its rep has no time: nothing is predicted after the fact.
    timed = set(
        session.execute(
            select(TimeLog.workout_id, TimeLog.block_id, TimeLog.athlete_id, TimeLog.rep_number).where(TimeLog.workout_id.in_(list(workouts)))
        ).all()
    ) if workouts else set()
    recorded = set(
        session.execute(
            select(PredictionLedger.workout_id, PredictionLedger.block_id, PredictionLedger.athlete_id, PredictionLedger.rep_number).where(
                PredictionLedger.model == model,
                PredictionLedger.model_version == version,
                PredictionLedger.horizon == horizon,
                PredictionLedger.workout_id.in_(list(workouts)),
            )
        ).all()
    ) if workouts else set()

    now = _now()
    counts = {"recorded": 0, "skippedHasTime": 0, "skippedDuplicate": 0, "skippedInvalid": 0}
    for item in items:
        workout = workouts.get(item["workout_id"])
        athlete = athletes.get(item["athlete_id"])
        listed = workout is not None and item["athlete_id"] in {UUID(str(value)) for value in (workout.athlete_ids or [])}
        if not workout or not athlete or not listed:
            counts["skippedInvalid"] += 1
            continue
        key = (item["workout_id"], item["block_id"], item["athlete_id"], item["rep_number"])
        if key in timed:
            counts["skippedHasTime"] += 1
            continue
        if key in recorded:
            counts["skippedDuplicate"] += 1
            continue
        recorded.add(key)
        session.add(
            PredictionLedger(
                team_id=team_id,
                model=model,
                model_version=version,
                role=role,
                horizon=horizon,
                predicted_by=payload.get("user_id"),
                predicted_at=now,
                **item,
            )
        )
        counts["recorded"] += 1
    return counts


def list_predictions(session: Session, payload: dict, athlete_id: str | None = None, since: str | None = None) -> list[dict]:
    team_id: UUID = payload["team_uuid"]
    try:
        start = date.fromisoformat(since) if since else date.today() - timedelta(days=400)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")
    query = select(PredictionLedger).where(PredictionLedger.team_id == team_id, PredictionLedger.target_date >= start)
    if athlete_id:
        query = query.where(PredictionLedger.athlete_id == as_uuid(athlete_id, "athleteId"))
    rows = session.scalars(query.order_by(PredictionLedger.target_date.desc()).limit(20000)).all()
    return [ledger_out(row) for row in rows]
