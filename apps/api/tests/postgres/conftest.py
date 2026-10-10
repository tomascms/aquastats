"""Suites that need a real PostgreSQL: row-level security, triggers, cascades, concurrent writes.

Set TEST_ADMIN_DATABASE_URL to a superuser URL on a LOCAL server we may create databases on, e.g.
    postgresql://postgres@127.0.0.1:5544/postgres   (local) or the CI service container.
Without it these tests are skipped. They refuse any non-local host: never Neon, never production.

The schema is built from db/schema.sql plus every migration, the way a fresh environment is. The API then
connects as aquastats_api (migration 011), the role production will use, so what passes here is what RLS
really enforces. Two synthetic teams (A and B) cover every table.
"""
from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from psycopg.types.json import Jsonb
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ADMIN_URL = os.environ.get("TEST_ADMIN_DATABASE_URL", "")
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1", "postgres"}
DB_NAME = "aquastats_test"
DB_DIR = Path(__file__).resolve().parents[2] / "db"
API_ROLE = "aquastats_api"
AUTH_ROLE = "aquastats_auth"
PASSWORD = "Teste-sintetico-2026"  # synthetic accounts of a throwaway local database

def pytest_collection_modifyitems(config, items):
    if ADMIN_URL:
        return
    skip = pytest.mark.skip(reason="TEST_ADMIN_DATABASE_URL not set (needs a local PostgreSQL)")
    for item in items:
        if "tests/postgres/" in str(item.fspath).replace("\\", "/"):
            item.add_marker(skip)


def _with_db(url: str, db: str, user: str | None = None) -> str:
    parts = urlsplit(url.replace("postgresql+psycopg://", "postgresql://", 1))
    netloc = parts.netloc
    if user:
        host = netloc.split("@", 1)[-1]
        netloc = f"{user}@{host}"
    return urlunsplit((parts.scheme, netloc, f"/{db}", parts.query, ""))


def _build_database() -> None:
    host = (urlsplit(ADMIN_URL).hostname or "").lower()
    if host not in LOCAL_HOSTS:
        pytest.exit(f"Refused: TEST_ADMIN_DATABASE_URL must point at a local server, not {host}.", returncode=2)
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {DB_NAME} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {DB_NAME}")
    with psycopg.connect(_with_db(ADMIN_URL, DB_NAME), autocommit=True) as conn:
        schema = (DB_DIR / "schema.sql").read_text(encoding="utf-8")
        try:
            conn.execute("create extension if not exists pgcrypto")
        except psycopg.Error:
            pass  # gen_random_uuid() is built in since PostgreSQL 13; pgcrypto is optional here
        conn.execute(schema.replace("create extension if not exists pgcrypto;", ""))
        conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())")
        for path in sorted((DB_DIR / "migrations").glob("*.sql")):
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT DO NOTHING", (path.name,))
        # Local test server only: trust authentication, so the role logs in without a password.
        conn.execute(f"ALTER ROLE {API_ROLE} LOGIN")
        conn.execute(f"ALTER ROLE {AUTH_ROLE} LOGIN")


@dataclass
class Team:
    org: uuid.UUID
    team: uuid.UUID
    coach: uuid.UUID
    swimmers: list[uuid.UUID] = field(default_factory=list)  # user ids
    athletes: list[uuid.UUID] = field(default_factory=list)  # athletes[i] belongs to swimmers[i]; the last one has no account
    workout: uuid.UUID | None = None
    competition: uuid.UUID | None = None


@dataclass
class World:
    admin_url: str
    api_url: str
    auth_url: str
    a: Team
    b: Team


def _seed_team(conn: psycopg.Connection, label: str) -> Team:
    from app.core.passwords import hash_password

    now = datetime.now(timezone.utc)
    t = Team(org=uuid.uuid4(), team=uuid.uuid4(), coach=uuid.uuid4())
    password_hash = hash_password(PASSWORD)
    conn.execute("insert into organizations (id, name) values (%s, %s)", (t.org, f"Org {label}"))
    conn.execute("insert into teams (id, organization_id, name, join_code) values (%s, %s, %s, %s)", (t.team, t.org, f"Equipa {label}", f"JOIN{label}{uuid.uuid4().hex[:4].upper()}"))

    def user(uid: uuid.UUID, role: str, status: str, name: str) -> None:
        conn.execute(
            "insert into users (id, email, role, is_active, is_verified, password_hash) values (%s, %s, %s, true, true, %s)",
            (uid, f"{name.lower().replace(' ', '.')}@{label.lower()}.test", role, password_hash),
        )
        conn.execute("insert into profiles (user_id, full_name) values (%s, %s)", (uid, name))
        conn.execute("insert into team_members (team_id, user_id, status) values (%s, %s, %s)", (t.team, uid, status))
        conn.execute("insert into refresh_tokens (user_id, token_hash, family_id, expires_at) values (%s, %s, %s, %s)", (uid, uuid.uuid4().hex, uuid.uuid4(), now + timedelta(days=7)))
        conn.execute("insert into password_reset_tokens (user_id, token_hash, expires_at) values (%s, %s, %s)", (uid, uuid.uuid4().hex, now + timedelta(minutes=30)))
        conn.execute("insert into email_verification_tokens (user_id, token_hash, expires_at) values (%s, %s, %s)", (uid, uuid.uuid4().hex, now + timedelta(days=1)))
        conn.execute("insert into oauth_accounts (user_id, provider, provider_account_id, email) values (%s, 'google', %s, %s)", (uid, uuid.uuid4().hex, None))
        conn.execute(
            "insert into idempotency_keys (key, operation, user_id, request_hash, status, expires_at) values (%s, 'test', %s, 'h', 'completed', %s)",
            (uuid.uuid4().hex, uid, now + timedelta(hours=1)),
        )

    user(t.coach, "coach", "owner", f"Treinador {label}")
    for i in range(2):
        uid = uuid.uuid4()
        t.swimmers.append(uid)
        user(uid, "swimmer", "swimmer", f"Atleta {label}{i + 1}")
    for i in range(3):  # two with an account, one placeholder
        aid = uuid.uuid4()
        t.athletes.append(aid)
        conn.execute(
            "insert into athletes (id, team_id, user_id, name, primary_stroke, is_placeholder, extra) values (%s, %s, %s, %s, 'free', %s, %s)",
            (aid, t.team, t.swimmers[i] if i < 2 else None, f"Sintético {label}{i + 1}", i >= 2, Jsonb({"groupName": "fundo"})),
        )
    t.workout = uuid.uuid4()
    blocks = [{"id": "b1", "type": "main", "rounds": 1, "noSendOff": False, "segments": [{"id": "s1", "reps": 4, "distanceM": 100, "stroke": "free"}], "betweenRounds": None}]
    conn.execute(
        "insert into workouts (id, team_id, created_by, title, workout_date, shift, athlete_ids, blocks, extra) values (%s, %s, %s, %s, %s, 'afternoon', %s, %s, %s)",
        (t.workout, t.team, t.coach, f"Treino {label}", date.today(), t.athletes, Jsonb(blocks), Jsonb({"course": "scm"})),
    )
    t.competition = uuid.uuid4()
    conn.execute(
        "insert into competitions (id, team_id, created_by, title, meet_date, course, athlete_ids) values (%s, %s, %s, %s, %s, 'scm', %s)",
        (t.competition, t.team, t.coach, f"Prova {label}", date.today(), t.athletes),
    )
    conn.execute("insert into season_plans (team_id, name, start_date, end_date, created_by) values (%s, %s, %s, %s, %s)", (t.team, f"Época {label}", date.today(), date.today() + timedelta(days=300), t.coach))
    conn.execute(
        "insert into attendance_sessions (team_id, workout_id, session_date, marks, created_by) values (%s, %s, %s, %s, %s)",
        (t.team, t.workout, date.today(), Jsonb([{"athleteId": str(a), "status": "present"} for a in t.athletes]), t.coach),
    )
    conn.execute("insert into team_invites (team_id, email, role, token_hash, expires_at, created_by) values (%s, %s, 'swimmer', %s, %s, %s)", (t.team, f"convite@{label.lower()}.test", uuid.uuid4().hex, now + timedelta(days=7), t.coach))
    conn.execute("insert into audit_logs (organization_id, user_id, action, resource_type) values (%s, %s, 'test.seed', 'team')", (t.org, t.coach))
    conn.execute("insert into outbox_events (organization_id, event_type, payload, next_retry_at) values (%s, 'test', '{}', %s)", (t.org, now))
    for i, aid in enumerate(t.athletes):
        for rep in (1, 2):
            conn.execute(
                "insert into time_logs (workout_id, block_id, athlete_id, rep_number, mm, ss, cc, stroke, recorded_by) values (%s, 'b1', %s, %s, 1, 10 + %s, 0, 'free', %s)",
                (t.workout, aid, rep, i, t.coach),
            )
        entry = uuid.uuid4()
        conn.execute("insert into meet_entries (id, competition_id, athlete_id, stroke, distance_m) values (%s, %s, %s, 'free', 100)", (entry, t.competition, aid))
        conn.execute("insert into meet_results (entry_id, mm, ss, cc, recorded_by) values (%s, 1, 5, 0, %s)", (entry, t.coach))
        conn.execute("insert into personal_records (athlete_id, stroke, distance_m, course, mm, ss, cc, competition_id, meet_date) values (%s, 'free', 100, 'scm', 1, 5, 0, %s, %s)", (aid, t.competition, date.today()))
        conn.execute(
            "insert into race_sessions (team_id, athlete_id, competition_id, session_date, course, distance_m, stroke, created_by) values (%s, %s, %s, %s, 'scm', 100, 'free', %s)",
            (t.team, aid, t.competition, date.today(), t.coach),
        )
        conn.execute("insert into goals (team_id, athlete_id, author_role, author_user_id, kind, text) values (%s, %s, 'coach', %s, 'other', 'objetivo')", (t.team, aid, t.coach))
        conn.execute("insert into hr_sessions (team_id, athlete_id, workout_id, source, external_id, started_at) values (%s, %s, %s, 'file', %s, %s)", (t.team, aid, t.workout, uuid.uuid4().hex, now))
        conn.execute("insert into polar_links (athlete_id, team_id, user_id, polar_user_id) values (%s, %s, %s, %s)", (aid, t.team, t.swimmers[i] if i < 2 else t.coach, uuid.uuid4().hex))
        conn.execute(
            "insert into prediction_ledger (team_id, athlete_id, workout_id, block_id, rep_number, target_date, model, model_version, role, mean_s, predicted_by) "
            "values (%s, %s, %s, 'b1', 3, %s, 'estado', '1.0', 'champion', 71.5, %s)",
            (t.team, aid, t.workout, date.today(), t.coach),
        )
    return t


@pytest.fixture(scope="session")
def world() -> World:
    _build_database()
    admin = _with_db(ADMIN_URL, DB_NAME)
    with psycopg.connect(admin, autocommit=False) as conn:
        a, b = _seed_team(conn, "A"), _seed_team(conn, "B")
        saga = uuid.uuid4()
        conn.execute("insert into saga_instances (id, saga_type, status) values (%s, 'provision', 'completed')", (saga,))
        conn.execute("insert into saga_logs (saga_id, step, status) values (%s, 'provision', 'completed')", (saga,))
        conn.execute("insert into oauth_states (state, code_verifier, nonce, expires_at) values ('s', 'v', 'n', now() + interval '5 minutes')")
        conn.commit()
    return World(admin_url=admin, api_url=_with_db(ADMIN_URL, DB_NAME, user=API_ROLE),
                 auth_url=_with_db(ADMIN_URL, DB_NAME, user=AUTH_ROLE), a=a, b=b)


def _engine(url: str):
    return create_engine(url.replace("postgresql://", "postgresql+psycopg://", 1), connect_args={"sslmode": "disable"}, pool_size=2, max_overflow=4)


@pytest.fixture(scope="session")
def api_engine(world: World):
    engine = _engine(world.api_url)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def auth_engine(world: World):
    engine = _engine(world.auth_url)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def admin_engine(world: World):
    engine = _engine(world.admin_url)
    yield engine
    engine.dispose()


def make_client(engine, auth_engine=None):
    """The real FastAPI app: team requests on `engine`, auth flows on `auth_engine` (default: the same)."""
    from fastapi.testclient import TestClient

    from app.core import db as core_db
    from app.core.rls import set_system_context
    from app.main import app

    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    auth_factory = sessionmaker(bind=auth_engine or engine, autoflush=False, autocommit=False)

    def get_session():
        yield from core_db._session_lifecycle(factory())

    def get_auth_session():
        session = auth_factory()
        set_system_context(session)
        yield from core_db._session_lifecycle(session)

    app.dependency_overrides[core_db.get_session] = get_session
    app.dependency_overrides[core_db.get_auth_session] = get_auth_session
    client = TestClient(app, base_url="http://127.0.0.1:8000", headers={"Origin": "http://localhost:3000"})
    return client


def login_as(client, user_id: uuid.UUID, role: str, team: Team) -> None:
    from app.core.sessions import ACCESS_COOKIE, sign_access

    client.cookies.set(ACCESS_COOKIE, sign_access(str(user_id), role, str(team.team), str(team.org)))


@pytest.fixture
def client_for(api_engine, auth_engine):
    """client_for(engine, user_id, role, team) -> TestClient logged in as that user. With the API role's engine
    the auth flows run as aquastats_auth, exactly as in production; with any other engine, on that engine."""
    def build(engine, user_id: uuid.UUID, role: str, team: Team):
        client = make_client(engine, auth_engine if engine is api_engine else engine)
        login_as(client, user_id, role, team)
        return client
    return build


@pytest.fixture
def team_factory(world):
    """A fresh synthetic team for tests that delete things (the shared teams A and B stay intact)."""
    def make(label: str) -> Team:
        with psycopg.connect(world.admin_url, autocommit=False) as conn:
            team = _seed_team(conn, label)
            conn.commit()
        return team
    return make
