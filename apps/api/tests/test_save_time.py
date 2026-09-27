"""Regression: saving a brand-new time (no existing row) must build a valid TimeLog."""
from types import SimpleNamespace
from uuid import uuid4

from app.domain import commands
from app.domain.models import TimeLog


class FakeSession:
    def __init__(self):
        self.added = []

    def scalar(self, _query):
        return None  # no time recorded yet for this rep

    def add(self, row):
        self.added.append(row)

    def flush(self):
        pass


def _save(monkeypatch, **extra):
    workout = SimpleNamespace(id=uuid4(), athlete_ids=[])
    athlete = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(commands, "_owned_workout", lambda *_: workout)
    monkeypatch.setattr(commands, "_athlete_for_time", lambda *_: athlete)
    session = FakeSession()
    body = {
        "workoutId": str(workout.id),
        "athleteId": str(athlete.id),
        "blockId": "main-1",
        "repNumber": 1,
        "mm": 0,
        "ss": 30,
        "cc": 45,
        "stroke": "free",
        **extra,
    }
    result = commands.save_time(session, {"team_uuid": uuid4(), "user_id": uuid4()}, body, None)
    return session, result


def test_new_time_is_created(monkeypatch):
    session, result = _save(monkeypatch)
    assert len(session.added) == 1
    row = session.added[0]
    assert isinstance(row, TimeLog)
    assert (row.mm, row.ss, row.cc) == (0, 30, 45)
    assert result["skipped"] is False


def test_new_skipped_rep_is_stored_in_splits(monkeypatch):
    session, result = _save(monkeypatch, mm=0, ss=0, cc=0, skipped=True)
    row = session.added[0]
    assert row.splits == [{"skipped": True}]
    assert result["skipped"] is True
