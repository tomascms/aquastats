"""Row-level security, table by table, as the API role (aquastats_api) — not as a superuser.

Expectations are written in business terms (which team, which athlete, which user a row belongs to) and
computed with the admin connection; the API role must see exactly that set, nothing more, nothing less.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

# Team a row belongs to (SQL over the row).
TEAM_OF = {
    "teams": "id",
    "organizations": "(select t.id from teams t where t.organization_id = organizations.id)",
    "athletes": "team_id",
    "workouts": "team_id",
    "competitions": "team_id",
    "race_sessions": "team_id",
    "season_plans": "team_id",
    "attendance_sessions": "team_id",
    "team_members": "team_id",
    "team_invites": "team_id",
    "goals": "team_id",
    "hr_sessions": "team_id",
    "polar_links": "team_id",
    "prediction_ledger": "team_id",
    "time_logs": "(select w.team_id from workouts w where w.id = time_logs.workout_id)",
    "meet_entries": "(select c.team_id from competitions c where c.id = meet_entries.competition_id)",
    "meet_results": "(select c.team_id from meet_entries me join competitions c on c.id = me.competition_id where me.id = meet_results.entry_id)",
    "personal_records": "(select a.team_id from athletes a where a.id = personal_records.athlete_id)",
    "audit_logs": "(select t.id from teams t where t.organization_id = audit_logs.organization_id)",
    "outbox_events": "(select t.id from teams t where t.organization_id = outbox_events.organization_id)",
}
# Athlete a row belongs to: a swimmer sees only their own.
ATHLETE_OF = {
    "athletes": "id",
    "time_logs": "athlete_id",
    "meet_entries": "athlete_id",
    "meet_results": "(select me.athlete_id from meet_entries me where me.id = meet_results.entry_id)",
    "personal_records": "athlete_id",
    "race_sessions": "athlete_id",
    "goals": "athlete_id",
    "hr_sessions": "athlete_id",
    "polar_links": "athlete_id",
    "prediction_ledger": "athlete_id",
}
COACH_ONLY = {"audit_logs", "outbox_events", "team_invites"}
USER_OWNED = {"profiles", "idempotency_keys", "refresh_tokens", "password_reset_tokens", "email_verification_tokens", "oauth_accounts"}
SYSTEM_ONLY = {"oauth_states", "saga_instances", "saga_logs"}
NOT_FOR_THE_API = {"schema_migrations"}


def actors(world):
    a, b = world.a, world.b
    return {
        "coach A": dict(team=a.team, user=a.coach, role="coach", athlete=None),
        "coach B": dict(team=b.team, user=b.coach, role="coach", athlete=None),
        "swimmer A1": dict(team=a.team, user=a.swimmers[0], role="swimmer", athlete=a.athletes[0]),
        "no context": dict(team=None, user=None, role=None, athlete=None),
    }


def expected_sql(table: str, actor: dict) -> str | None:
    """Rows the actor may see, as a WHERE clause (admin side); None means none at all."""
    if actor["team"] is None or table in SYSTEM_ONLY or table in NOT_FOR_THE_API:
        return None
    if table in USER_OWNED:
        return f"user_id = '{actor['user']}'"
    if table == "users":
        statuses = "('owner', 'coach')" if actor["role"] == "swimmer" else "('owner', 'coach', 'swimmer')"
        return f"id = '{actor['user']}' or id in (select user_id from team_members where team_id = '{actor['team']}' and status in {statuses})"
    if table in COACH_ONLY and actor["role"] != "coach":
        return None
    clause = f"{TEAM_OF[table]} = '{actor['team']}'"
    if actor["role"] == "swimmer" and table in ATHLETE_OF:
        clause += f" and {ATHLETE_OF[table]} = '{actor['athlete']}'"
    return clause


def public_tables(conn) -> list[str]:
    return [r[0] for r in conn.execute(text("select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1"))]


def set_context(conn, actor: dict) -> None:
    for key, value in (("app.bypass_rls", ""), ("app.team_id", actor["team"]), ("app.user_id", actor["user"]),
                       ("app.role", actor["role"]), ("app.athlete_id", actor["athlete"])):
        conn.execute(text("select set_config(:k, :v, true)"), {"k": key, "v": str(value) if value else ""})


def test_every_table_is_classified(admin_engine):
    """A new table must be classified here (and get RLS + grants in a migration) before it ships."""
    with admin_engine.connect() as conn:
        tables = set(public_tables(conn))
    known = set(TEAM_OF) | USER_OWNED | SYSTEM_ONLY | NOT_FOR_THE_API | {"users"}
    assert tables - known == set(), f"unclassified tables: {sorted(tables - known)}"


def test_rls_is_on_and_forced_on_every_api_table(admin_engine):
    with admin_engine.connect() as conn:
        rows = conn.execute(text(
            "select relname, relrowsecurity, relforcerowsecurity from pg_class "
            "where relnamespace = 'public'::regnamespace and relkind = 'r'")).all()
    missing = [name for name, rls, forced in rows if name not in NOT_FOR_THE_API and not (rls and forced)]
    assert missing == []


def test_api_role_is_ordinary(admin_engine):
    with admin_engine.connect() as conn:
        row = conn.execute(text(
            "select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication, "
            "(select count(*) from pg_auth_members m where m.member = r.oid) "
            "from pg_roles r where rolname = 'aquastats_api'")).one()
    assert tuple(row) == (False, False, False, False, False, 0)


def test_api_role_has_no_rights_on_internal_tables(admin_engine):
    with admin_engine.connect() as conn:
        for table in NOT_FOR_THE_API | {"oauth_states"}:
            assert not conn.execute(text(f"select has_table_privilege('aquastats_api', '{table}', 'SELECT')")).scalar()
        for action in ("UPDATE", "DELETE", "TRUNCATE"):
            assert not conn.execute(text(f"select has_table_privilege('aquastats_api', 'prediction_ledger', '{action}')")).scalar()


@pytest.mark.parametrize("actor_name", ["coach A", "coach B", "swimmer A1", "no context"])
def test_each_actor_sees_exactly_their_rows(world, admin_engine, api_engine, actor_name):
    actor = actors(world)[actor_name]
    failures = []
    with admin_engine.connect() as admin, api_engine.connect() as api:
        tables = [t for t in public_tables(admin) if t not in NOT_FOR_THE_API | {"oauth_states"}]
        with api.begin():
            set_context(api, actor)
            for table in tables:
                where = expected_sql(table, actor)
                expected = set() if where is None else {r[0] for r in admin.execute(text(f"select ctid::text from {table} where {where}"))}
                seen = {r[0] for r in api.execute(text(f"select ctid::text from {table}"))}
                if seen != expected:
                    failures.append(f"{table}: saw {len(seen)} rows, expected {len(expected)}")
    assert failures == [], f"{actor_name}: " + "; ".join(failures)


def test_seed_covers_every_team_table(world, admin_engine):
    """The matrix only proves something if both teams have rows everywhere."""
    with admin_engine.connect() as conn:
        for table, team_expr in TEAM_OF.items():
            for team in (world.a.team, world.b.team):
                count = conn.execute(text(f"select count(*) from {table} where {team_expr} = '{team}'")).scalar()
                assert count > 0, f"no seed rows for {table} in team {team}"


@pytest.mark.parametrize("table,column", [
    ("athletes", "name"), ("workouts", "title"), ("competitions", "title"), ("goals", "text"),
    ("time_logs", "ss"), ("season_plans", "name"), ("race_sessions", "tournament"),
])
def test_coach_cannot_change_or_delete_another_teams_rows(world, api_engine, table, column):
    actor = actors(world)["coach A"]
    value = "'x'" if column != "ss" else "1"
    with api_engine.connect() as api:
        trans = api.begin()
        try:
            set_context(api, actor)
            changed = api.execute(text(f"update {table} set {column} = {value} where {TEAM_OF[table]} = '{world.b.team}'")).rowcount
            removed = api.execute(text(f"delete from {table} where {TEAM_OF[table]} = '{world.b.team}'")).rowcount
        finally:
            trans.rollback()
    assert (changed, removed) == (0, 0)


def test_coach_cannot_insert_into_another_team(world, api_engine):
    actor = actors(world)["coach A"]
    with api_engine.connect() as api:
        with pytest.raises(Exception) as err, api.begin():
            set_context(api, actor)
            api.execute(text(
                "insert into season_plans (team_id, name, start_date, end_date, created_by) "
                f"values ('{world.b.team}', 'intrusa', current_date, current_date, '{world.a.coach}')"))
        assert "row-level security" in str(err.value)


def test_swimmer_cannot_write_for_a_teammate(world, api_engine):
    actor = actors(world)["swimmer A1"]
    teammate = world.a.athletes[1]
    with api_engine.connect() as api:
        with pytest.raises(Exception) as err, api.begin():
            set_context(api, actor)
            api.execute(text(
                "insert into goals (team_id, athlete_id, author_role, author_user_id, kind, text) "
                f"values ('{world.a.team}', '{teammate}', 'athlete', '{world.a.swimmers[0]}', 'other', 'x')"))
        assert "row-level security" in str(err.value)


def test_ledger_is_append_only_for_the_api(world, api_engine):
    actor = actors(world)["coach A"]
    for statement in ("update prediction_ledger set mean_s = 1", "delete from prediction_ledger"):
        with api_engine.connect() as api:
            with pytest.raises(Exception) as err, api.begin():
                set_context(api, actor)
                api.execute(text("set local aquastats.ledger_maintenance = 'on'"))  # the switch is not for the API
                api.execute(text(statement))
            assert "permission denied" in str(err.value)


def test_no_context_means_no_rows_and_no_writes(world, api_engine):
    with api_engine.connect() as api:
        with pytest.raises(Exception), api.begin():
            api.execute(text(
                "insert into season_plans (team_id, name, start_date, end_date, created_by) "
                f"values ('{world.a.team}', 'sem contexto', current_date, current_date, '{world.a.coach}')"))
