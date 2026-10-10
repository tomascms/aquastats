"""Saving times under real concurrency, as aquastats_api: one upsert per rep, edits ordered by the device's edit
time (migration 013). Replaces the old fake-session unit tests (new time, skipped rep)."""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text


def key():
    return {"Idempotency-Key": uuid.uuid4().hex}


def iso(delta_s: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=delta_s)).isoformat()


@pytest.fixture
def setup(api_engine, client_for, team_factory):
    team = team_factory("T" + uuid.uuid4().hex[:3].upper())
    coach = client_for(api_engine, team.coach, "coach", team)
    cell = {"workoutId": str(team.workout), "blockId": "b9", "athleteId": str(team.athletes[0]), "repNumber": 7}
    return team, coach, cell


def stored(admin_engine, cell):
    with admin_engine.connect() as conn:
        return conn.execute(text(
            "select mm, ss, cc, splits from time_logs where workout_id = :w and block_id = :b and athlete_id = :a and rep_number = :r"),
            {"w": cell["workoutId"], "b": cell["blockId"], "a": cell["athleteId"], "r": cell["repNumber"]}).all()


def test_new_time_and_skipped_rep(setup, admin_engine):
    _, coach, cell = setup
    out = coach.put("/api/v1/times", json={**cell, "mm": 0, "ss": 30, "cc": 45, "stroke": "free"}, headers=key()).json()
    assert (out["mm"], out["ss"], out["cc"], out["skipped"]) == (0, 30, 45, False)
    out = coach.put("/api/v1/times", json={**cell, "repNumber": 8, "skipped": True}, headers=key()).json()
    assert out["skipped"] is True and out["splits"] == [{"skipped": True}]


def test_two_coaches_saving_the_same_cell_at_once_never_fail(setup, admin_engine, api_engine, client_for):
    team, _, cell = setup
    results, barrier = [], threading.Barrier(8)

    def save(i):
        client = client_for(api_engine, team.coach, "coach", team)
        barrier.wait()
        results.append(client.put("/api/v1/times", json={**cell, "ss": 30 + i, "clientUpdatedAt": iso(-10 + i)}, headers=key()).status_code)

    threads = [threading.Thread(target=save, args=(i,)) for i in range(8)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert results == [200] * 8, results  # measured with the old select-then-insert: 5 of 8 raised a duplicate key
    rows = stored(admin_engine, cell)
    assert len(rows) == 1 and rows[0][1] == 37  # the latest edit wins, whatever the arrival order


def test_late_retry_of_an_older_edit_does_not_overwrite_a_newer_one(setup, admin_engine):
    _, coach, cell = setup
    coach.put("/api/v1/times", json={**cell, "ss": 31, "clientUpdatedAt": iso(-1)}, headers=key())
    late = coach.put("/api/v1/times", json={**cell, "ss": 35, "clientUpdatedAt": iso(-60)}, headers=key()).json()
    assert late.get("stale") is True and late["ss"] == 31  # the device is told what is stored
    assert stored(admin_engine, cell)[0][1] == 31


def test_an_older_delete_does_not_remove_a_newer_time(setup, admin_engine):
    _, coach, cell = setup
    coach.put("/api/v1/times", json={**cell, "ss": 33, "clientUpdatedAt": iso(-1)}, headers=key())
    out = coach.put("/api/v1/times", json={**cell, "ss": 0, "clientUpdatedAt": iso(-30)}, headers=key()).json()
    assert out.get("stale") is True and len(stored(admin_engine, cell)) == 1
    out = coach.put("/api/v1/times", json={**cell, "ss": 0, "clientUpdatedAt": iso(0)}, headers=key()).json()
    assert out == {"deleted": True} and stored(admin_engine, cell) == []


def test_returning_to_an_earlier_value_is_saved(setup, admin_engine):
    """31.40 -> 31.20 -> 31.40 must end at 31.40 (different edit times, different requests)."""
    _, coach, cell = setup
    for cc, delta in ((40, -3), (20, -2), (40, -1)):
        coach.put("/api/v1/times", json={**cell, "ss": 31, "cc": cc, "clientUpdatedAt": iso(delta)}, headers=key())
    assert stored(admin_engine, cell)[0][2] == 40


def test_a_future_device_clock_is_capped_at_server_time(setup, admin_engine):
    _, coach, cell = setup
    coach.put("/api/v1/times", json={**cell, "ss": 40, "clientUpdatedAt": iso(3600)}, headers=key())
    coach.put("/api/v1/times", json={**cell, "ss": 41, "clientUpdatedAt": iso(0)}, headers=key())
    assert stored(admin_engine, cell)[0][1] == 41  # a phone an hour ahead cannot freeze the cell


def test_two_tabs_recording_the_same_predictions_never_fail(setup, admin_engine, api_engine, client_for):
    team, _, cell = setup
    body = {"model": "estado", "modelVersion": "1.0", "role": "champion", "horizon": "day",
            "items": [{"athleteId": cell["athleteId"], "workoutId": cell["workoutId"], "blockId": "p1", "repNumber": 1,
                       "targetDate": datetime.now(timezone.utc).date().isoformat(), "meanS": 30.0}]}
    results, barrier = [], threading.Barrier(6)

    def record():
        client = client_for(api_engine, team.coach, "coach", team)
        barrier.wait()
        response = client.post("/api/v1/predictions", json=body, headers=key())
        results.append((response.status_code, response.json().get("recorded")))

    threads = [threading.Thread(target=record) for _ in range(6)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert [code for code, _ in results] == [200] * 6, results
    assert sum(recorded for _, recorded in results) == 1  # the unique key decides
