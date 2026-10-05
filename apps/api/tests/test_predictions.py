"""Prediction ledger: only before the time exists, first one wins, never another team's reps."""
from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.domain import predictions
from app.domain.models import PredictionLedger

TEAM = uuid4()
OTHER_TEAM = uuid4()
COACH = {"role": "coach", "team_uuid": TEAM, "user_id": uuid4()}


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeSession:
    """Just enough of a SQLAlchemy session: objects by id, a few key tuples, recorded inserts."""

    def __init__(self, objects, timed=(), recorded=()):
        self.objects = {obj.id: obj for obj in objects}
        self.timed = list(timed)
        self.recorded = list(recorded)
        self.added = []
        self.calls = 0

    def get(self, _model, key):
        return self.objects.get(key)

    def execute(self, _query):
        # First query: times already entered; second: predictions already in the ledger.
        self.calls += 1
        return Rows(self.timed if self.calls == 1 else self.recorded)

    def add(self, row):
        self.added.append(row)


def _world():
    athlete = SimpleNamespace(id=uuid4(), team_id=TEAM, deleted_at=None)
    workout = SimpleNamespace(id=uuid4(), team_id=TEAM, deleted_at=None, athlete_ids=[athlete.id])
    return athlete, workout


def _body(athlete, workout, reps=(1,), **extra):
    return {
        "model": "estado",
        "modelVersion": "2.0",
        "role": "challenger",
        "horizon": "day",
        "items": [
            {
                "athleteId": str(athlete.id),
                "workoutId": str(workout.id),
                "blockId": "b2",
                "repNumber": rep,
                "targetDate": "2026-10-06",
                "meanS": 31.2,
                "loS": 30.6,
                "hiS": 31.9,
                "nominal": 0.8,
                "sdS": 0.5,
                "confidence": "média",
                "details": {"factors": [["Forma", -0.6]]},
                **extra,
            }
            for rep in reps
        ],
    }


def test_records_predictions_before_the_time_exists():
    athlete, workout = _world()
    session = FakeSession([athlete, workout])
    out = predictions.record_predictions(session, COACH, _body(athlete, workout, reps=(1, 2, 3)))
    assert out == {"recorded": 3, "skippedHasTime": 0, "skippedDuplicate": 0, "skippedInvalid": 0}
    row = session.added[0]
    assert isinstance(row, PredictionLedger)
    assert row.team_id == TEAM and row.model == "estado" and row.mean_s == 31.2 and row.target_date == date(2026, 10, 6)
    assert row.predicted_at is not None


def test_refuses_to_record_after_the_fact():
    athlete, workout = _world()
    session = FakeSession([athlete, workout], timed=[(workout.id, "b2", athlete.id, 2)])
    out = predictions.record_predictions(session, COACH, _body(athlete, workout, reps=(1, 2)))
    assert out["recorded"] == 1 and out["skippedHasTime"] == 1
    assert [row.rep_number for row in session.added] == [1]


def test_first_prediction_wins():
    athlete, workout = _world()
    session = FakeSession([athlete, workout], recorded=[(workout.id, "b2", athlete.id, 1)])
    out = predictions.record_predictions(session, COACH, _body(athlete, workout, reps=(1, 1, 2)))
    assert out["recorded"] == 1 and out["skippedDuplicate"] == 2


def test_never_records_for_another_team_or_an_athlete_not_in_the_session():
    athlete, workout = _world()
    foreign = SimpleNamespace(id=uuid4(), team_id=OTHER_TEAM, deleted_at=None, athlete_ids=[athlete.id])
    stranger = SimpleNamespace(id=uuid4(), team_id=TEAM, deleted_at=None)
    session = FakeSession([athlete, workout, foreign, stranger])
    out = predictions.record_predictions(session, COACH, _body(athlete, foreign))
    assert out["recorded"] == 0 and out["skippedInvalid"] == 1
    out = predictions.record_predictions(FakeSession([athlete, workout, stranger]), COACH, _body(stranger, workout))
    assert out["recorded"] == 0 and out["skippedInvalid"] == 1


@pytest.mark.parametrize(
    "change",
    [
        {"meanS": 0},
        {"meanS": "abc"},
        {"meanS": float("inf")},
        {"loS": 40},
        {"hiS": 20},
        {"repNumber": 0},
        {"targetDate": "ontem"},
        {"athleteId": "x"},
    ],
)
def test_rejects_malformed_predictions(change):
    athlete, workout = _world()
    with pytest.raises(HTTPException):
        predictions.record_predictions(FakeSession([athlete, workout]), COACH, _body(athlete, workout, **change))


def test_rejects_unknown_role_horizon_and_oversized_batches():
    athlete, workout = _world()
    for body in (
        {**_body(athlete, workout), "role": "boss"},
        {**_body(athlete, workout), "horizon": "decade"},
        _body(athlete, workout, reps=range(1, 502)),
    ):
        with pytest.raises(HTTPException):
            predictions.record_predictions(FakeSession([athlete, workout]), COACH, body)


def test_drops_oversized_details_and_unknown_confidence():
    athlete, workout = _world()
    session = FakeSession([athlete, workout])
    predictions.record_predictions(session, COACH, _body(athlete, workout, details={"x": "y" * 5000}, confidence="total"))
    assert session.added[0].details == {} and session.added[0].confidence is None


def test_ledger_out_serialises_a_row():
    row = PredictionLedger(
        id=uuid4(),
        team_id=TEAM,
        athlete_id=uuid4(),
        workout_id=uuid4(),
        block_id="b2",
        rep_number=3,
        target_date=date(2026, 10, 6),
        model="estado",
        model_version="2.0",
        role="champion",
        horizon="day",
        mean_s=31.2,
        details={},
        predicted_at=datetime(2026, 10, 5, 20, 0, tzinfo=timezone.utc),
    )
    out = predictions.ledger_out(row)
    assert out["targetDate"] == "2026-10-06" and out["repNumber"] == 3 and out["predictedAt"].startswith("2026-10-05")
