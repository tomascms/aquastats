"""The real API, connected as aquastats_api: legitimate reads are unchanged, cross-team access fails, and
RLS still holds when the application code itself asks for the wrong team."""
from __future__ import annotations

import json
import uuid
from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session



def _snapshot(client_for, engine, user, role, team):
    client = client_for(engine, user, role, team)
    response = client.get("/api/v1/snapshot")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("who", ["coach", "swimmer"])
def test_new_role_sees_the_same_snapshot_as_a_superuser(world, api_engine, admin_engine, client_for, who):
    """Differential check: with RLS really applied nothing legitimate disappears."""
    team = world.a
    user, role = (team.coach, "coach") if who == "coach" else (team.swimmers[0], "swimmer")
    assert _snapshot(client_for, api_engine, user, role, team) == _snapshot(client_for, admin_engine, user, role, team)


def test_coach_snapshot_only_holds_their_team(world, api_engine, client_for):
    data = _snapshot(client_for, api_engine, world.a.coach, "coach", world.a)
    ids = {a["id"] for a in data["athletes"]}
    assert ids == {str(x) for x in world.a.athletes}
    assert {w["id"] for w in data["workouts"]} == {str(world.a.workout)}
    assert all(t["athleteId"] in ids for t in data["timeLogs"])


def test_swimmer_snapshot_only_holds_themselves(world, api_engine, client_for):
    data = _snapshot(client_for, api_engine, world.a.swimmers[0], "swimmer", world.a)
    me = str(world.a.athletes[0])
    assert [a["id"] for a in data["athletes"]] == [me]
    assert data["timeLogs"] and all(t["athleteId"] == me for t in data["timeLogs"])
    assert data["meetEntries"] and all(e["athleteId"] == me for e in data["meetEntries"])
    assert all(g["athleteId"] == me for g in data["goals"])


@pytest.mark.parametrize("method,path,body", [
    ("patch", "/api/v1/athletes/{athlete}/coach", {"name": "Intruso"}),
    ("delete", "/api/v1/athletes/{athlete}", None),
    ("delete", "/api/v1/workouts/{workout}", None),
    ("put", "/api/v1/times", {"workoutId": "{workout}", "blockId": "b1", "athleteId": "{athlete}", "repNumber": 3, "mm": 1, "ss": 1, "cc": 1}),
    ("delete", "/api/v1/competitions/{competition}", None),
])
def test_coach_cannot_reach_another_teams_records_through_the_api(world, api_engine, client_for, method, path, body):
    b = world.b
    fill = {"athlete": str(b.athletes[0]), "workout": str(b.workout), "competition": str(b.competition)}
    client = client_for(api_engine, world.a.coach, "coach", world.a)
    url = path.format(**fill)
    payload = {k: (v.format(**fill) if isinstance(v, str) else v) for k, v in (body or {}).items()} or None
    response = client.request(method.upper(), url, json=payload, headers={"Idempotency-Key": uuid.uuid4().hex})
    assert response.status_code in (403, 404), (url, response.status_code, response.text)


def test_rls_holds_even_when_the_code_asks_for_the_wrong_team(world, api_engine):
    """Simulates an application bug: tenant context is team A, the query asks for team B."""
    from app.core.rls import set_tenant_context
    from app.domain.queries import team_snapshot

    with Session(api_engine) as session:
        set_tenant_context(session, team_id=world.a.team, user_id=world.a.coach, role="coach")
        leaked = team_snapshot(session, world.b.team)
        session.rollback()
    leaked["timeLogs"] = json.loads(leaked["timeLogs"])
    for key in ("athletes", "workouts", "timeLogs", "competitions", "meetEntries", "meetResults", "goals", "hrSessions"):
        assert leaked[key] == [], key


def test_api_role_cannot_bypass_even_by_setting_the_flag(api_engine):
    """Migration 012: the bypass needs the flag AND the auth role. SQL injected into a team request can set the
    flag; it still sees nothing beyond its context."""
    with api_engine.connect() as conn, conn.begin() as trans:
        conn.execute(text("select set_config('app.bypass_rls', 'true', true)"))
        assert conn.execute(text("select count(*) from teams")).scalar() == 0
        assert conn.execute(text("select count(*) from users")).scalar() == 0
        trans.rollback()


def test_auth_role_bypasses_only_with_the_flag(auth_engine):
    with auth_engine.connect() as conn, conn.begin() as trans:
        assert conn.execute(text("select count(*) from teams")).scalar() == 0
        conn.execute(text("select set_config('app.bypass_rls', 'true', true)"))
        assert conn.execute(text("select count(*) from teams")).scalar() >= 2
        trans.rollback()


def test_api_role_cannot_become_the_auth_role(admin_engine):
    with admin_engine.connect() as conn:
        assert not conn.execute(text("select pg_has_role('aquastats_api', 'aquastats_auth', 'MEMBER')")).scalar()
        attrs = conn.execute(text("select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname = 'aquastats_auth'")).one()
        assert tuple(attrs) == (False, False, False, False)


def test_time_logs_built_by_postgres_match_the_python_serializer(world, admin_engine):
    """The snapshot's time logs now come from SQL (performance); their content must not change."""
    from sqlalchemy import select

    from app.domain.models import TimeLog, Workout
    from app.domain.queries import team_snapshot
    from app.domain.serializers import time_log_out

    with Session(admin_engine) as session:
        built = json.loads(team_snapshot(session, world.a.team)["timeLogs"])
        workouts = select(Workout.id).where(Workout.team_id == world.a.team, Workout.deleted_at.is_(None))
        expected = [time_log_out(row) for row in session.scalars(select(TimeLog).where(TimeLog.workout_id.in_(workouts)))]

    def norm(rows):
        out = []
        for row in rows:
            row = dict(row)
            row["recordedAt"] = datetime.fromisoformat(row["recordedAt"]).timestamp()
            out.append(row)
        return sorted(out, key=lambda r: r["id"])

    assert built and norm(built) == norm(expected)


def test_recent_and_older_windows_add_up_to_the_full_snapshot(world, api_engine, client_for, admin_engine):
    from datetime import date

    with admin_engine.begin() as conn:  # an older workout with a time, so both windows have something
        old = conn.execute(text(
            "insert into workouts (team_id, created_by, title, workout_date, shift, athlete_ids) "
            "values (:t, :c, 'Antigo', '2024-01-10', 'morning', array[:a]::uuid[]) returning id"),
            {"t": world.a.team, "c": world.a.coach, "a": str(world.a.athletes[0])}).scalar()
        conn.execute(text("insert into time_logs (workout_id, block_id, athlete_id, rep_number, ss, recorded_by) values (:w, 'b1', :a, 1, 40, :c)"),
                     {"w": old, "a": world.a.athletes[0], "c": world.a.coach})
    client = client_for(api_engine, world.a.coach, "coach", world.a)
    cutoff = date(2025, 1, 1).isoformat()
    full = client.get("/api/v1/snapshot").json()
    recent = client.get(f"/api/v1/snapshot?since={cutoff}").json()
    older = client.get(f"/api/v1/snapshot?before={cutoff}").json()
    ids = lambda rows: {row["id"] for row in rows}
    assert ids(recent["workouts"]) & ids(older["workouts"]) == set()
    assert ids(recent["workouts"]) | ids(older["workouts"]) == ids(full["workouts"])
    assert ids(recent["timeLogs"]) | ids(older["timeLogs"]) == ids(full["timeLogs"])
    assert str(old) in ids(older["workouts"]) and str(old) not in ids(recent["workouts"])


def test_race_session_id_of_another_team_is_not_found(world, api_engine, client_for):
    body = {"athleteId": str(world.b.athletes[0]), "distanceM": 100, "stroke": "free", "date": "2026-10-18"}
    coach_b = client_for(api_engine, world.b.coach, "coach", world.b)
    created = coach_b.put("/api/v1/race-sessions", json=body, headers={"Idempotency-Key": uuid.uuid4().hex})
    assert created.status_code == 200, created.text
    # Team A reuses that id for its own athlete: RLS hides B's row, the insert collides, the answer is 404 (not 500).
    coach_a = client_for(api_engine, world.a.coach, "coach", world.a)
    reuse = {**body, "id": created.json()["id"], "athleteId": str(world.a.athletes[0])}
    response = coach_a.put("/api/v1/race-sessions", json=reuse, headers={"Idempotency-Key": uuid.uuid4().hex})
    assert response.status_code == 404, response.text


def test_forgot_password_sends_one_link_per_cooldown(world, team_factory, api_engine, auth_engine):
    import psycopg

    from tests.postgres.conftest import make_client

    team = team_factory("Forgot")
    # The seed gives every user a fresh link; age it so the next request may send one.
    with psycopg.connect(world.admin_url, autocommit=True) as conn:
        conn.execute("update password_reset_tokens set created_at = now() - interval '1 hour' where user_id = %s", (team.coach,))
    client = make_client(api_engine, auth_engine)
    email = "treinador.forgot@forgot.test"
    first = client.post("/api/v1/auth/forgot", json={"email": email}, headers={"Origin": "http://localhost:3000"})
    second = client.post("/api/v1/auth/forgot", json={"email": email}, headers={"Origin": "http://localhost:3000"})
    assert first.status_code == second.status_code == 200
    # Same answer shape for the caller; only the first request created a link.
    assert "resetUrl" in first.json() and "resetUrl" not in second.json()
