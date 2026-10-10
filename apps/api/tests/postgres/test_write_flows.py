"""Everyday writes through the real routes, as aquastats_api: nothing a coach or a swimmer legitimately does
may be refused by the new grants or policies (row-level security also applies to INSERT ... RETURNING)."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

BLOCKS = [{"id": "w1", "type": "main", "rounds": 1, "noSendOff": False,
           "segments": [{"id": "s1", "reps": 4, "distanceM": 50, "stroke": "free"}], "betweenRounds": None}]


def ok(response, status=(200, 201)):
    assert response.status_code in status, (response.request.method, str(response.request.url), response.status_code, response.text[:300])
    return response.json()


def key():
    return {"Idempotency-Key": uuid.uuid4().hex}


@pytest.fixture
def team(team_factory):
    return team_factory("W" + uuid.uuid4().hex[:3].upper())


def test_coach_daily_flow(api_engine, client_for, team):
    coach = client_for(api_engine, team.coach, "coach", team)
    today = date.today().isoformat()
    athletes = [str(a) for a in team.athletes]

    workout = ok(coach.post("/api/v1/workouts", json={"date": today, "shift": "afternoon", "course": "scm", "groups": ["fundo"], "blocks": BLOCKS}, headers=key()))
    workout = ok(coach.patch(f"/api/v1/workouts/{workout['id']}", json={"title": "Treino editado", "athleteIds": athletes}, headers=key()))
    time = {"workoutId": workout["id"], "blockId": "w1", "athleteId": athletes[0], "repNumber": 1, "mm": 0, "ss": 31, "cc": 40}
    ok(coach.put("/api/v1/times", json=time, headers=key()))
    ok(coach.put("/api/v1/times", json={**time, "cc": 20}, headers=key()))  # edit
    assert ok(coach.put("/api/v1/times", json={**time, "ss": 0, "cc": 0}, headers=key()))["deleted"] is True

    prediction = {"model": "estado", "modelVersion": "1.0", "role": "champion", "horizon": "day",
                  "items": [{"athleteId": athletes[1], "workoutId": workout["id"], "blockId": "w1", "repNumber": 2,
                             "targetDate": today, "meanS": 32.1, "loS": 31.0, "hiS": 33.5, "nominal": 0.8}]}
    counts = ok(coach.post("/api/v1/predictions", json=prediction, headers=key()))
    assert counts["recorded"] == 1, (counts, workout["athleteIds"], [b["id"] for b in workout["blocks"]])
    assert len(ok(coach.get("/api/v1/predictions"))) >= 1

    meet = ok(coach.post("/api/v1/competitions", json={"date": today, "course": "scm", "athleteIds": athletes}, headers=key()))
    ok(coach.patch(f"/api/v1/competitions/{meet['id']}", json={"venue": "Piscina sintética"}, headers=key()))
    ok(coach.put("/api/v1/season-plans", json={"name": "Época sintética", "start": today, "end": (date.today() + timedelta(days=200)).isoformat()}, headers=key()))
    ok(coach.put("/api/v1/attendance", json={"date": today, "workoutId": workout["id"], "marks": [{"athleteId": a, "status": "present"} for a in athletes]}, headers=key()))
    ok(coach.put("/api/v1/goals", json={"athleteId": athletes[0], "stroke": "free", "distanceM": 100, "course": "scm", "targetValue": 62.5}, headers=key()))
    ok(coach.patch("/api/v1/team", json={"name": "Equipa renomeada"}, headers=key()))
    ok(coach.patch("/api/v1/profile", json={"name": "Treinador Renomeado"}, headers=key()))
    ok(coach.delete(f"/api/v1/competitions/{meet['id']}", headers=key()))
    ok(coach.delete(f"/api/v1/workouts/{workout['id']}", headers=key()))


def test_swimmer_daily_flow(api_engine, client_for, team):
    swimmer = client_for(api_engine, team.swimmers[0], "swimmer", team)
    me, teammate = str(team.athletes[0]), str(team.athletes[1])
    goal = ok(swimmer.put("/api/v1/goals", json={"athleteId": me, "stroke": "free", "distanceM": 50, "course": "scm", "targetValue": 29.9}, headers=key()))
    refused = swimmer.put("/api/v1/goals", json={"athleteId": teammate, "stroke": "free", "distanceM": 50, "course": "scm", "targetValue": 29.9}, headers=key())
    assert refused.status_code in (403, 404)
    ok(swimmer.delete(f"/api/v1/goals/{goal['id']}", headers=key()))
    snapshot = ok(swimmer.get("/api/v1/snapshot"))
    assert [a["id"] for a in snapshot["athletes"]] == [me]
