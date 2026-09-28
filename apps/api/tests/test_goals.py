"""Goal permissions: each side edits its own goals and can only answer the other's."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.domain import goals
from app.domain.models import Goal

TEAM = uuid4()
ATHLETE = uuid4()
OTHER_ATHLETE = uuid4()
REQUEST = SimpleNamespace(client=None, headers={}, state=SimpleNamespace(request_id="t"))


class FakeSession:
    def __init__(self, rows=None):
        self.rows = {row.id: row for row in rows or []}
        self.added = []

    def get(self, _model, key):
        return self.rows.get(key)

    def add(self, row):
        self.added.append(row)
        self.rows[row.id] = row

    def flush(self):
        pass

    def delete(self, row):
        self.rows.pop(row.id, None)


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    monkeypatch.setattr(goals, "_owned_athlete", lambda *_: None)
    monkeypatch.setattr(goals, "_audit", lambda *_: None)


COACH = {"role": "coach", "team_uuid": TEAM, "user_id": uuid4()}
SWIMMER = {"role": "swimmer", "team_uuid": TEAM, "user_id": uuid4(), "athlete_uuid": ATHLETE}


def test_coach_sets_time_goal():
    session = FakeSession()
    out = goals.save_goal(
        session,
        COACH,
        {"athleteId": str(ATHLETE), "kind": "time", "stroke": "fly", "distanceM": 200, "course": "lcm", "targetValue": 138.0},
        REQUEST,
    )
    assert out["author"] == "coach" and out["targetValue"] == 138.0 and out["status"] == "active"


def test_time_goal_needs_event_and_time():
    with pytest.raises(HTTPException):
        goals.save_goal(FakeSession(), COACH, {"athleteId": str(ATHLETE), "kind": "time", "stroke": "fly"}, REQUEST)


def test_swimmer_only_for_self():
    with pytest.raises(HTTPException) as error:
        goals.save_goal(FakeSession(), SWIMMER, {"athleteId": str(OTHER_ATHLETE), "kind": "other", "text": "x"}, REQUEST)
    assert error.value.status_code == 403


def _coach_goal():
    return Goal(
        id=uuid4(), team_id=TEAM, athlete_id=ATHLETE, author_role="coach", author_user_id=COACH["user_id"],
        kind="time", stroke="fly", distance_m=200, target_value=138.0, text="", response="", status="active", deleted_at=None,
    )


def test_swimmer_answers_coach_goal_without_changing_it():
    row = _coach_goal()
    out = goals.save_goal(FakeSession([row]), SWIMMER, {"id": str(row.id), "response": "Vou tentar!"}, REQUEST)
    assert out["response"] == "Vou tentar!"
    assert out["targetValue"] == 138.0 and out["status"] == "active"


def test_swimmer_can_raise_the_bar_on_a_coach_goal():
    row = _coach_goal()
    out = goals.save_goal(
        FakeSession([row]), SWIMMER, {"id": str(row.id), "stroke": "fly", "distanceM": 200, "course": "lcm", "targetValue": 135.0}, REQUEST
    )
    assert out["targetValue"] == 135.0 and out["author"] == "coach"


def test_either_side_deletes_but_not_other_athletes():
    row = _coach_goal()
    assert goals.delete_goal(FakeSession([row]), SWIMMER, str(row.id), REQUEST)["deleted"] is True
    other = _coach_goal()
    other.athlete_id = OTHER_ATHLETE
    with pytest.raises(HTTPException) as error:
        goals.delete_goal(FakeSession([other]), SWIMMER, str(other.id), REQUEST)
    assert error.value.status_code == 403
