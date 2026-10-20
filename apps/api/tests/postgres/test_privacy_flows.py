"""GDPR flows through the real routes: parental consent for under-13s, uniform signup (audit #15), export and
the inactive-account retention job, with the API on aquastats_api and the auth flows on aquastats_auth."""
from __future__ import annotations

import base64
import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import psycopg
import pytest
from sqlalchemy import text

from app.domain import privacy

PASSWORD = "Sintetico-registo-2026"  # synthetic accounts of a throwaway local database
UNIFORM = {"ok": True, "needsConfirmation": True, "next": "/confirmar-pendente"}


def key():
    return {"Idempotency-Key": uuid.uuid4().hex}


def eleven() -> str:
    return date(date.today().year - 11, 1, 1).isoformat()


@pytest.fixture
def anonymous(world, api_engine, client_for):
    """The real app, signed out (auth flows on aquastats_auth)."""
    client = client_for(api_engine, world.a.coach, "coach", world.a)
    client.cookies.clear()
    return client


@pytest.fixture
def team(team_factory):
    return team_factory("P" + uuid.uuid4().hex[:3].upper())


def _consent(world, user_id, status: str) -> str:
    """Puts the athlete's consent in `status` and returns a guardian link token for it."""
    nonce = uuid.uuid4().hex
    with psycopg.connect(world.admin_url) as conn:
        conn.execute("update parental_consents set status = %s, nonce = %s where user_id = %s", (status, nonce, user_id))
    row = SimpleNamespace(user_id=user_id, nonce=nonce)
    return privacy.guardian_token(row, datetime.now(timezone.utc) + timedelta(days=7))


def test_signup_answer_is_the_same_for_an_existing_email(anonymous):
    client = anonymous
    body = {"password": PASSWORD + "x1", "acceptTerms": True, "birthDate": "1990-01-01"}
    taken = client.post("/api/v1/auth/register", json={**body, "email": "treinador.a@a.test"})
    fresh = client.post("/api/v1/auth/register", json={**body, "email": f"novo.{uuid.uuid4().hex[:6]}@p.test"})
    assert taken.status_code == fresh.status_code == 200
    assert taken.json() == UNIFORM
    assert {k: v for k, v in fresh.json().items() if k in UNIFORM} == UNIFORM


def test_signup_needs_terms_and_a_guardian_under_13(anonymous, admin_engine):
    client = anonymous
    email = f"crianca.{uuid.uuid4().hex[:6]}@p.test"
    body = {"email": email, "password": PASSWORD + "x1", "birthDate": eleven()}
    assert client.post("/api/v1/auth/register", json=body).status_code == 400  # terms
    assert client.post("/api/v1/auth/register", json={**body, "acceptTerms": True}).status_code == 400  # guardian
    done = client.post("/api/v1/auth/register", json={**body, "acceptTerms": True, "guardianEmail": "pai@p.test"}).json()
    assert done["guardianUrl"].startswith("/responsavel/")
    token = done["guardianUrl"].rsplit("/", 1)[1]
    assert client.get(f"/api/v1/auth/guardian/{token}").json()["status"] == "pending"
    assert client.post(f"/api/v1/auth/guardian/{token}", json={"decision": "grant"}).json()["status"] == "granted"
    with admin_engine.connect() as conn:
        row = conn.execute(text("select u.terms_version, c.guardian_email from users u join parental_consents c on c.user_id = u.id where u.email = :e"), {"e": email}).one()
    assert tuple(row) == (privacy.TERMS_VERSION, "pai@p.test")


def test_no_health_data_until_the_guardian_agrees_and_withdrawing_erases_it(world, api_engine, admin_engine, client_for, team):
    swimmer = client_for(api_engine, team.swimmers[0], "swimmer", team)
    coach = client_for(api_engine, team.coach, "coach", team)
    athlete = str(team.athletes[0])
    wellness = {"wellness": [{"date": date.today().isoformat(), "sleepHours": 8, "rpe": 6}]}

    token = _consent(world, team.swimmers[0], "pending")
    blocked = swimmer.patch(f"/api/v1/athletes/{athlete}", json=wellness, headers=key())
    assert blocked.status_code == 403 and "responsável parental" in blocked.json()["detail"]
    hr = coach.post("/api/v1/hr/upload", json={"athleteId": athlete, "filename": "x.fit", "data": base64.b64encode(b"x").decode()}, headers=key())
    assert hr.status_code == 403

    assert swimmer.post(f"/api/v1/auth/guardian/{token}", json={"decision": "grant"}).status_code == 200
    assert swimmer.patch(f"/api/v1/athletes/{athlete}", json=wellness, headers=key()).status_code == 200

    assert swimmer.post(f"/api/v1/auth/guardian/{token}", json={"decision": "withdraw"}).json()["status"] == "withdrawn"
    with admin_engine.connect() as conn:
        extra = conn.execute(text("select extra from athletes where id = :a"), {"a": athlete}).scalar()
        hr_left = conn.execute(text("select count(*) from hr_sessions where athlete_id = :a"), {"a": athlete}).scalar()
    assert "wellness" not in extra and hr_left == 0
    assert swimmer.patch(f"/api/v1/athletes/{athlete}", json=wellness, headers=key()).status_code == 403
    assert swimmer.get("/api/v1/auth/me").json()["consent"] == "withdrawn"


def test_api_role_cannot_write_consents(world, api_engine):
    with api_engine.connect() as api:
        with pytest.raises(Exception) as err, api.begin():
            api.execute(text("update parental_consents set status = 'granted'"))
        assert "permission denied" in str(err.value)


def test_export_has_my_data_and_no_secrets(api_engine, client_for, team):
    swimmer = client_for(api_engine, team.swimmers[0], "swimmer", team)
    response = swimmer.get("/api/v1/auth/export")
    assert response.status_code == 200 and "attachment" in response.headers["content-disposition"]
    data = response.json()
    assert data["account"]["id"] == str(team.swimmers[0])
    assert "password_hash" not in data["account"] and "nonce" not in (data["parentalConsent"] or {})
    assert {a["id"] for a in data["athletes"]} == {str(team.athletes[0])}
    assert data["times"] and data["heartRate"]


def test_retention_warns_then_deletes_after_30_days(world, anonymous, monkeypatch):
    from app.core.config import get_settings

    secret = "c" * 40
    monkeypatch.setattr(get_settings(), "cron_secret", secret)
    old, recent = uuid.uuid4(), uuid.uuid4()
    long_ago = datetime.now(timezone.utc) - timedelta(days=4 * 365)
    with psycopg.connect(world.admin_url) as conn:
        for uid, seen in ((old, long_ago), (recent, datetime.now(timezone.utc))):
            conn.execute("insert into users (id, email, role, is_active, is_verified, created_at, last_login_at) values (%s, %s, 'pending', true, true, %s, %s)", (uid, f"{uid.hex[:8]}@p.test", seen, seen))
            conn.execute("insert into profiles (user_id, full_name) values (%s, 'Sintético')", (uid,))
    client = anonymous
    assert client.post("/api/v1/auth/internal/retention").status_code == 404  # no key
    run = lambda: client.post("/api/v1/auth/internal/retention", headers={"x-cron-key": secret}).json()  # noqa: E731
    assert run()["warned"] >= 1
    with psycopg.connect(world.admin_url) as conn:
        assert conn.execute("select inactivity_notice_at is not null from users where id = %s", (old,)).fetchone()[0]
        assert conn.execute("select inactivity_notice_at is null from users where id = %s", (recent,)).fetchone()[0]
        conn.execute("update users set inactivity_notice_at = now() - interval '31 days' where id = %s", (old,))
    assert run()["deleted"] >= 1
    with psycopg.connect(world.admin_url) as conn:
        assert conn.execute("select count(*) from users where id = %s", (old,)).fetchone()[0] == 0
        assert conn.execute("select count(*) from users where id = %s", (recent,)).fetchone()[0] == 1
