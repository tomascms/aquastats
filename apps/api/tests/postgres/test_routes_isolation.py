"""The real API, connected as aquastats_api: legitimate reads are unchanged, cross-team access fails, and
RLS still holds when the application code itself asks for the wrong team."""
from __future__ import annotations

import uuid

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
    for key in ("athletes", "workouts", "timeLogs", "competitions", "meetEntries", "meetResults", "goals", "hrSessions"):
        assert leaked[key] == [], key


def test_known_limit_the_bypass_flag_is_settable_by_the_api_role(world, api_engine):
    """app.bypass_rls is a session setting the API itself sets for the auth flows: whoever can run SQL as
    the API can set it too. RLS protects against application bugs, not against SQL injection — that
    limit is written down in docs/security/rls.md. This test pins the behaviour so a change is noticed."""
    with api_engine.connect() as conn, conn.begin() as trans:
        conn.execute(text("select set_config('app.bypass_rls', 'true', true)"))
        assert conn.execute(text("select count(*) from teams")).scalar() >= 2  # every team, not only its own
        trans.rollback()
