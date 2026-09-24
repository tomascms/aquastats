"""Prediction and analytics API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, date
import structlog

from ..core.db import get_session
from ..core.tenant import require_member, require_coach
from ..domain.models import TimeLog, Athlete, Workout
from ..domain.prediction import EnsemblePredictor
from ..core.audit import AuditLogger

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["prediction"])


@router.get("/athletes/{athlete_id}/forecast")
async def forecast_athlete_performance(
    athlete_id: str,
    distance_m: int = Query(..., ge=25, le=10000),
    stroke: str = Query(..., regex="^(free|back|breast|fly|im)$"),
    weeks_ahead: int = Query(4, ge=1, le=24),
    payload: dict = Depends(require_member),
    session: Session = Depends(get_session),
):
    """
    Forecast athlete performance for a distance/stroke.

    Example:
        GET /api/v1/athletes/abc123/forecast?distance_m=100&stroke=free&weeks_ahead=4

    Response:
        {
            "prediction_seconds": 58.32,
            "lower_bound": 57.2,
            "upper_bound": 59.4,
            "confidence": 0.87,
            "trend": "improving",
            "weeks_to_pr": 2.5,
            "predicted_pr_date": "2026-10-15",
            "current_pb": 59.12,
            "model_details": {
                "linear": 58.1,
                "xgb": 58.5
            }
        }
    """
    try:
        athlete_id_uuid = UUID(athlete_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid athlete ID format")

    # Verify athlete belongs to user's team
    athlete = session.scalar(
        select(Athlete).where(
            Athlete.id == athlete_id_uuid,
            Athlete.team_id == UUID(payload['team_uuid']),
            Athlete.deleted_at.is_(None),
        )
    )

    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")

    # Get all time logs for this athlete/distance/stroke
    time_logs = session.scalars(
        select(TimeLog).where(
            TimeLog.athlete_id == athlete_id_uuid,
            Workout.distance_m == distance_m,  # Assume this field exists
            TimeLog.stroke == stroke,
        ).join(Workout, TimeLog.workout_id == Workout.id)
    ).all()

    if not time_logs:
        logger.warning("no_sessions_for_athlete", athlete_id=athlete_id, distance_m=distance_m)
        raise HTTPException(
            status_code=404,
            detail="No training sessions found for this athlete/distance/stroke combo"
        )

    # Convert to session dicts
    sessions = [
        {
            'recorded_at': log.recorded_at,
            'time_seconds': (log.mm * 60 + log.ss + log.cc / 100),
            'stroke': log.stroke,
        }
        for log in time_logs
    ]

    # Train ensemble model
    athlete_meta = {
        'age': calculate_age(athlete.date_of_birth) if athlete.date_of_birth else 16,
        'experience_years': 1,  # TODO: calculate from join_date
    }

    predictor = EnsemblePredictor()
    predictor.fit(sessions, athlete_meta)

    # Get forecast
    forecast = predictor.predict_with_ci(weeks_ahead)

    # Get PR info
    current_pb = min([s['time_seconds'] for s in sessions]) if sessions else None
    pr_forecast = predictor.predict_pr_date(current_pb) if current_pb else None

    # Audit log
    await AuditLogger.log_action(
        user_id=UUID(payload['user_id']),
        organization_id=UUID(payload['org_id']),
        action='forecast_view',
        entity='athlete_performance',
        entity_id=athlete_id_uuid,
        session=session,
    )

    return {
        'prediction_seconds': forecast['prediction'],
        'lower_bound': forecast['lower_bound'],
        'upper_bound': forecast['upper_bound'],
        'confidence': forecast['confidence'],
        'trend': forecast['trend'],
        'weeks_to_pr': pr_forecast['weeks_to_pr'] if pr_forecast else None,
        'predicted_pr_date': pr_forecast['predicted_date'] if pr_forecast else None,
        'current_pb': current_pb,
        'sessions_analyzed': len(sessions),
        'model_details': forecast['models'],
    }


@router.get("/workouts/{workout_id}/analysis")
async def analyze_workout(
    workout_id: str,
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    """
    Analyze workout efficiency, zones, and athlete performance.

    Response:
        {
            "efficiency_score": 0.82,
            "zone_distribution": {
                "z1": 10,
                "z2": 20,
                "z3": 35,
                "z4": 25,
                "z5": 10
            },
            "athlete_stats": {
                "athlete_1": {
                    "completed": true,
                    "time_avg": 58.2,
                    "zone": "z3"
                }
            },
            "recommendations": [
                "Aumentar volume em Z3",
                "SR baixa em finais"
            ]
        }
    """
    try:
        workout_id_uuid = UUID(workout_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workout ID format")

    # Get workout
    workout = session.scalar(
        select(Workout).where(
            Workout.id == workout_id_uuid,
            Workout.team_id == UUID(payload['team_uuid']),
            Workout.deleted_at.is_(None),
        )
    )

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    # Get time logs for this workout
    time_logs = session.scalars(
        select(TimeLog).where(TimeLog.workout_id == workout_id_uuid)
    ).all()

    # Analyze
    zone_distribution = analyze_zones(time_logs)
    efficiency_score = calculate_efficiency(zone_distribution)
    athlete_stats = get_athlete_stats(time_logs, session)
    recommendations = generate_recommendations(zone_distribution, time_logs)

    # Audit
    await AuditLogger.log_action(
        user_id=UUID(payload['user_id']),
        organization_id=UUID(payload['org_id']),
        action='workout_analysis',
        entity='workout',
        entity_id=workout_id_uuid,
        session=session,
    )

    return {
        'workout_id': workout_id,
        'efficiency_score': efficiency_score,
        'zone_distribution': zone_distribution,
        'athlete_stats': athlete_stats,
        'recommendations': recommendations,
    }


def calculate_age(dob: date) -> int:
    """Calculate age from date of birth."""
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def analyze_zones(time_logs: list) -> dict:
    """
    Classify times into training zones (Z1-Z6).

    Based on pace relative to athlete's recent performance.
    """
    if not time_logs:
        return {'z1': 0, 'z2': 0, 'z3': 0, 'z4': 0, 'z5': 0, 'z6': 0}

    # Simplified: classify by pace
    times = [log.mm * 60 + log.ss + log.cc / 100 for log in time_logs]
    avg_time = sum(times) / len(times)
    pb_time = min(times)

    zones = {'z1': 0, 'z2': 0, 'z3': 0, 'z4': 0, 'z5': 0, 'z6': 0}

    for t in times:
        pace_ratio = t / pb_time  # How much slower than PB

        if pace_ratio <= 1.03:
            zones['z6'] += 1  # Velocity (sprint)
        elif pace_ratio <= 1.07:
            zones['z5'] += 1  # VO2 max
        elif pace_ratio <= 1.14:
            zones['z4'] += 1  # Tolerance
        elif pace_ratio <= 1.22:
            zones['z3'] += 1  # Threshold
        elif pace_ratio <= 1.35:
            zones['z2'] += 1  # Aerobic medium
        else:
            zones['z1'] += 1  # Aerobic low

    # Normalize to percentages
    total = sum(zones.values())
    if total > 0:
        zones = {k: int(v / total * 100) for k, v in zones.items()}

    return zones


def calculate_efficiency(zone_distribution: dict) -> float:
    """
    Calculate workout efficiency score (0-1).

    Efficient workouts have concentrated zone distribution.
    """
    if not zone_distribution:
        return 0

    # Ideal: 70% in target zone, rest distributed
    target_zones = ['z3', 'z4', 'z5']  # High intensity
    target_pct = sum(zone_distribution.get(z, 0) for z in target_zones)

    # Score: how concentrated
    efficiency = min(1, target_pct / 70)

    return round(efficiency, 2)


def get_athlete_stats(time_logs: list, session) -> dict:
    """Get per-athlete statistics for workout."""
    from sqlalchemy import select
    from ..domain.models import Athlete

    athlete_stats = {}

    for log in time_logs:
        athlete = session.get(Athlete, log.athlete_id)
        if not athlete:
            continue

        if athlete.id not in athlete_stats:
            athlete_stats[athlete.id] = {
                'name': athlete.name,
                'completed': False,
                'time_seconds': None,
                'times_count': 0,
            }

        if log.mm > 0 or log.ss > 0:
            athlete_stats[athlete.id]['completed'] = True
            time_sec = log.mm * 60 + log.ss + log.cc / 100
            athlete_stats[athlete.id]['time_seconds'] = time_sec
            athlete_stats[athlete.id]['times_count'] += 1

    return athlete_stats


def generate_recommendations(zone_distribution: dict, time_logs: list) -> list:
    """Generate training recommendations based on zone distribution."""
    recommendations = []

    # Check zone concentration
    z3_pct = zone_distribution.get('z3', 0)
    z4_pct = zone_distribution.get('z4', 0)
    z5_pct = zone_distribution.get('z5', 0)
    high_intensity = z3_pct + z4_pct + z5_pct

    if high_intensity < 30:
        recommendations.append("Aumentar volume em intensidade (Z3+)")
    elif high_intensity > 75:
        recommendations.append("Adicionar recuperação (Z1-Z2)")

    # Check SR trend
    if time_logs:
        srs = [log.sr for log in time_logs if log.sr > 0]
        if srs and len(srs) > 1:
            first_half_sr = sum(srs[:len(srs)//2]) / max(1, len(srs)//2)
            second_half_sr = sum(srs[len(srs)//2:]) / max(1, len(srs) - len(srs)//2)

            if second_half_sr < first_half_sr * 0.95:
                recommendations.append("SR caiu no final — fadiga detectada")

    # Completion rate
    completed = sum(1 for log in time_logs if log.mm > 0 or log.ss > 0)
    total = len(time_logs)
    completion_rate = completed / max(1, total)

    if completion_rate < 0.7:
        recommendations.append(f"Apenas {int(completion_rate * 100)}% de atletas completaram")

    return recommendations
