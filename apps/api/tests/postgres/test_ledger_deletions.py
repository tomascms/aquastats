"""Deleting an athlete, a workout, a swimmer's account or a whole team removes everything that was theirs —
predictions included — through the API's real code paths, connected as aquastats_api.

The ledger refuses direct edits (trigger + no UPDATE/DELETE grant) but must never block erasure: its rows
follow the athlete, workout, team and account through foreign-key cascades.
"""
from __future__ import annotations

import uuid

from sqlalchemy import text

from app.core.sessions import ACCESS_COOKIE

PASSWORD = "Teste-sintetico-2026"


def count(admin_engine, sql: str, **params) -> int:
    with admin_engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()


def everything_of_athlete(admin_engine, athlete: uuid.UUID) -> dict:
    tables = ("time_logs", "meet_entries", "personal_records", "race_sessions", "goals", "hr_sessions", "polar_links", "prediction_ledger")
    found = {t: count(admin_engine, f"select count(*) from {t} where athlete_id = :a", a=athlete) for t in tables}
    found["athletes"] = count(admin_engine, "select count(*) from athletes where id = :a", a=athlete)
    return {k: v for k, v in found.items() if v}


def test_coach_purging_an_athlete_removes_their_predictions(api_engine, admin_engine, client_for, team_factory):
    team = team_factory("P1")
    athlete = team.athletes[2]
    assert everything_of_athlete(admin_engine, athlete)["prediction_ledger"] == 1
    client = client_for(api_engine, team.coach, "coach", team)
    response = client.delete(f"/api/v1/athletes/{athlete}?purge=1", headers={"Idempotency-Key": uuid.uuid4().hex})
    assert response.status_code == 200, response.text
    assert everything_of_athlete(admin_engine, athlete) == {}


def test_deleting_a_workout_removes_its_predictions(api_engine, admin_engine, client_for, team_factory):
    team = team_factory("P2")
    client = client_for(api_engine, team.coach, "coach", team)
    response = client.delete(f"/api/v1/workouts/{team.workout}", headers={"Idempotency-Key": uuid.uuid4().hex})
    assert response.status_code == 200, response.text
    assert count(admin_engine, "select count(*) from prediction_ledger where workout_id = :w", w=team.workout) == 0
    assert count(admin_engine, "select count(*) from workouts where id = :w", w=team.workout) == 0


def test_swimmer_leaving_with_purge_takes_everything(api_engine, admin_engine, client_for, team_factory):
    team = team_factory("P3")
    client = client_for(api_engine, team.swimmers[0], "swimmer", team)
    response = client.post("/api/v1/auth/leave-team?purge=1")
    assert response.status_code == 200, response.text
    assert everything_of_athlete(admin_engine, team.athletes[0]) == {}


def test_swimmer_deleting_their_account_takes_everything(api_engine, admin_engine, client_for, team_factory):
    team = team_factory("P4")
    user, athlete = team.swimmers[1], team.athletes[1]
    client = client_for(api_engine, user, "swimmer", team)
    response = client.post("/api/v1/auth/delete-account", json={"password": PASSWORD, "confirm": "ELIMINAR"})
    assert response.status_code == 200, response.text
    assert everything_of_athlete(admin_engine, athlete) == {}
    for table, column in (("users", "id"), ("profiles", "user_id"), ("refresh_tokens", "user_id"), ("team_members", "user_id"),
                          ("oauth_accounts", "user_id"), ("idempotency_keys", "user_id"), ("audit_logs", "user_id")):
        assert count(admin_engine, f"select count(*) from {table} where {column} = :u", u=user) == 0, table


def test_owner_deleting_their_account_takes_the_whole_team(api_engine, admin_engine, client_for, team_factory):
    team = team_factory("P5")
    coach = client_for(api_engine, team.coach, "coach", team)
    blocked = coach.post("/api/v1/auth/delete-account", json={"password": PASSWORD, "confirm": "ELIMINAR"})
    assert blocked.status_code == 409  # swimmers still in the team
    for swimmer in team.swimmers:
        client_for(api_engine, swimmer, "swimmer", team).post("/api/v1/auth/leave-team?purge=1")
    coach.cookies.delete(ACCESS_COOKIE)
    coach = client_for(api_engine, team.coach, "coach", team)
    response = coach.post("/api/v1/auth/delete-account", json={"password": PASSWORD, "confirm": "ELIMINAR"})
    assert response.status_code == 200, response.text
    for table in ("prediction_ledger", "athletes", "workouts", "competitions", "goals", "hr_sessions", "season_plans", "team_members"):
        assert count(admin_engine, f"select count(*) from {table} where team_id = :t", t=team.team) == 0, table
    assert count(admin_engine, "select count(*) from teams where id = :t", t=team.team) == 0
    assert count(admin_engine, "select count(*) from organizations where id = :o", o=team.org) == 0
    assert count(admin_engine, "select count(*) from users where id = :u", u=team.coach) == 0
