"""Loads a SYNTHETIC team (apps/web/scripts/export-synthetic.ts) into a local or staging database.

    DATABASE_URL=postgresql://postgres@127.0.0.1:5544/aquastats python scripts/seed_synthetic.py ../../.local/synthetic.json

Never for production: it refuses the production Neon endpoint and any database that already holds an
account whose email is not a reserved demo address (*.test). Everything it writes is synthetic: names
"Sintético N", emails under demo.aquastats.test, data from the generator.

Demo logins (local/staging only; the database refuses to be seeded anywhere else):
    coach:   treinador@demo.aquastats.test
    swimmer: atleta@demo.aquastats.test
    password for both: LOCAL_DEMO_PASSWORD below on localhost; anywhere else (e.g. a staging branch reachable
    from the internet) the DEMO_PASSWORD environment variable is required, so the public repository never
    holds a working login for a deployed environment.
"""
from __future__ import annotations

import json
import os
import secrets
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from psycopg.types.json import Jsonb

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from app.core.passwords import hash_password  # noqa: E402

PRODUCTION_ENDPOINTS = ("ep-rough-unit-b1cgm5pl",)  # Neon branch "production"
DEMO_DOMAIN = "demo.aquastats.test"
LOCAL_DEMO_PASSWORD = "sintetico-demo-2026"  # localhost databases only
# The generator names workouts after its season phase ("Sintético taper"); the UI is in Portuguese.
PHASE_TITLES = {
    "ramp": "Retoma",
    "general": "Preparação geral",
    "specific": "Preparação específica",
    "competitive": "Competitivo",
    "taper": "Taper",
    "transition": "Transição",
}
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
NS = uuid.UUID("6f9b2a3e-5d1c-4e8a-9b7f-0c2d4e6f8a10")


def demo_password(url: str) -> str:
    if (urlsplit(_plain_url(url)).hostname or "").lower() in LOCAL_HOSTS:
        return os.environ.get("DEMO_PASSWORD") or LOCAL_DEMO_PASSWORD
    password = os.environ.get("DEMO_PASSWORD", "")
    if len(password) < 12:
        sys.exit("Refused: seeding a non-local database needs DEMO_PASSWORD (12+ characters) in the environment.")
    return password


def _plain_url(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def _guard(conn: psycopg.Connection, url: str) -> None:
    host = (urlsplit(url).hostname or "").lower()
    if any(endpoint in host for endpoint in PRODUCTION_ENDPOINTS):
        sys.exit("Refused: this is the production database.")
    real = conn.execute("select count(*) from users where email is not null and email not like '%.test'").fetchone()[0]
    if real:
        sys.exit(f"Refused: {real} account(s) with a non-demo email exist here; this is not a demo database.")


def _id(name: str) -> uuid.UUID:
    return uuid.uuid5(NS, name)


def _time_parts(seconds: float) -> tuple[int, int, int]:
    hundredths = round(seconds * 100)
    return hundredths // 6000, (hundredths // 100) % 60, hundredths % 100


def main(path: str) -> None:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        sys.exit("DATABASE_URL is required.")
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not data.get("synthetic"):
        sys.exit("Refused: the file is not marked synthetic.")
    now = datetime.now(timezone.utc)
    with psycopg.connect(_plain_url(url), autocommit=False) as conn:
        _guard(conn, url)
        conn.execute("select set_config('app.bypass_rls', 'true', false)")
        org, team = _id("org"), _id("team")
        coach, swimmer = _id("coach"), _id("swimmer")
        # Start clean: a previous demo seed of this team goes first (FK order).
        _wipe(conn, team, org, (coach, swimmer))

        conn.execute("insert into organizations (id, name) values (%s, %s)", (org, "Clube Sintético (demo)"))
        conn.execute(
            "insert into teams (id, organization_id, name, join_code) values (%s, %s, %s, %s)",
            (team, org, "Equipa Sintética", "DEMO" + secrets.token_hex(2).upper()),
        )
        password_hash = hash_password(demo_password(url))
        for user_id, email, role, name, status in (
            (coach, f"treinador@{DEMO_DOMAIN}", "coach", "Treinador Sintético", "owner"),
            (swimmer, f"atleta@{DEMO_DOMAIN}", "swimmer", "Sintético 1", "swimmer"),
        ):
            conn.execute(
                "insert into users (id, email, role, is_active, is_verified, password_hash) values (%s, %s, %s, true, true, %s)",
                (user_id, email, role, password_hash),
            )
            conn.execute("insert into profiles (user_id, full_name) values (%s, %s)", (user_id, name))
            conn.execute("insert into team_members (team_id, user_id, status) values (%s, %s, %s)", (team, user_id, status))

        athletes = data["athletes"]
        # The demo swimmer account is the athlete who trained most recently, so the swimmer screens show this season.
        last_seen = {}
        for w in data["workouts"]:
            for aid in w["athleteIds"]:
                last_seen[aid] = max(last_seen.get(aid, ""), w["date"])
        demo_athlete = max(data["athletes"], key=lambda a: (last_seen.get(a["id"], ""), -data["athletes"].index(a)))["id"]
        with conn.cursor().copy(
            "copy athletes (id, team_id, user_id, name, date_of_birth, primary_stroke, is_placeholder, extra) from stdin"
        ) as copy:
            for index, a in enumerate(athletes):
                extra = {"groupName": a["groupName"], "gender": a["gender"], "wellness": a.get("wellness") or [], "synthetic": True}
                linked = a["id"] == demo_athlete
                copy.write_row((a["id"], team, swimmer if linked else None, a["name"], a["dateOfBirth"], a["primaryStroke"], not linked, Jsonb(extra)))

        with conn.cursor().copy(
            "copy workouts (id, team_id, created_by, title, workout_date, shift, athlete_ids, blocks, extra) from stdin"
        ) as copy:
            for w in data["workouts"]:
                extra = {"course": w.get("course") or "", "groups": w.get("groups") or [], "focus": w.get("focus") or ""}
                title = PHASE_TITLES.get(w["title"].removeprefix("Sintético "), w["title"])
                copy.write_row((w["id"], team, coach, title[:120], w["date"], w["shift"], w["athleteIds"], Jsonb(w["blocks"]), Jsonb(extra)))

        with conn.cursor().copy(
            "copy time_logs (id, workout_id, block_id, athlete_id, rep_number, mm, ss, cc, splits, stroke, recorded_by, recorded_at) from stdin"
        ) as copy:
            for t in data["timeLogs"]:
                splits = [{"skipped": True}] if t.get("skipped") else (t.get("splits") or [])
                copy.write_row((t["id"], t["workoutId"], t["blockId"], t["athleteId"], t["repNumber"], t["mm"], t["ss"], t["cc"],
                                Jsonb(splits), t.get("stroke") or "free", coach, t.get("recordedAt") or now))

        _seed_competitions(conn, data, team, coach)
        for plan in data.get("seasonPlans") or []:
            payload = {"macros": plan["macros"], "mesos": [], "competitions": plan["competitions"], "tests": [], "weeklyVolumes": []}
            conn.execute(
                "insert into season_plans (id, team_id, name, start_date, end_date, description, payload, created_by) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s)",
                (plan["id"], team, plan["name"], plan["start"], plan["end"], "Plano sintético: fases seguidas pelo gerador.", Jsonb(payload), coach),
            )
        for sheet in data.get("attendance") or []:
            marks = [{**m, "volumeM": 0} for m in sheet["marks"]]
            conn.execute(
                "insert into attendance_sessions (id, team_id, workout_id, session_date, group_name, marks, created_by) "
                "values (%s, %s, %s, %s, %s, %s, %s)",
                (sheet["id"], team, sheet["workoutId"], sheet["date"], sheet["groupName"], Jsonb(marks), coach),
            )
        conn.commit()
        counts = {table: conn.execute(f"select count(*) from {table}").fetchone()[0]
                  for table in ("athletes", "workouts", "time_logs", "attendance_sessions", "season_plans", "competitions", "meet_entries", "meet_results")}
    print(f"seeded synthetic team (seed {data['seed']}): {counts}")


def _seed_competitions(conn: psycopg.Connection, data: dict, team: uuid.UUID, coach: uuid.UUID) -> None:
    """Each synthetic meet becomes a competition; each race an entry with its result (first swim kept)."""
    by_date: dict[str, list[dict]] = {}
    for race in data["races"]:
        by_date.setdefault(race["date"], []).append(race)
    for index, (day, races) in enumerate(sorted(by_date.items()), start=1):
        meet = _id(f"meet:{day}")
        course = races[0]["course"]
        athlete_ids = sorted({r["athleteId"] for r in races})
        conn.execute(
            "insert into competitions (id, team_id, created_by, title, meet_date, course, venue, athlete_ids, extra) "
            "values (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (meet, team, coach, f"Competição sintética {index}", day, course, "Piscina de demonstração", athlete_ids,
             Jsonb({"endDate": (date.fromisoformat(day) + timedelta(days=1)).isoformat()})),
        )
        seen: set[tuple] = set()
        for race in races:
            key = (race["athleteId"], race["stroke"], race["distanceM"])
            if key in seen:
                continue
            seen.add(key)
            entry = _id(f"entry:{day}:{key}")
            conn.execute(
                "insert into meet_entries (id, competition_id, athlete_id, stroke, distance_m) values (%s, %s, %s, %s, %s)",
                (entry, meet, race["athleteId"], race["stroke"], race["distanceM"]),
            )
            mm, ss, cc = _time_parts(race["timeS"])
            conn.execute(
                "insert into meet_results (entry_id, mm, ss, cc, splits, recorded_by, extra) values (%s, %s, %s, %s, %s, %s, %s)",
                (entry, mm, ss, cc, Jsonb(race.get("splits") or []), coach,
                 Jsonb({"source": "manual", "reactionS": race.get("reactionS")})),
            )


def _wipe(conn: psycopg.Connection, team: uuid.UUID, org: uuid.UUID, users: tuple[uuid.UUID, ...]) -> None:
    has_ledger = conn.execute("select to_regclass('prediction_ledger') is not null").fetchone()[0]
    if has_ledger:
        conn.execute("set local aquastats.ledger_maintenance = 'on'")
        conn.execute("delete from prediction_ledger where team_id = %s", (team,))
    conn.execute("delete from meet_results where entry_id in (select me.id from meet_entries me join competitions c on c.id = me.competition_id where c.team_id = %s)", (team,))
    conn.execute("delete from meet_entries where competition_id in (select id from competitions where team_id = %s)", (team,))
    conn.execute("delete from time_logs where workout_id in (select id from workouts where team_id = %s)", (team,))
    for table in ("personal_records", "goals", "hr_sessions", "polar_links", "race_sessions", "attendance_sessions",
                  "season_plans", "competitions", "workouts", "athletes", "team_invites", "team_members"):
        column = "athlete_id in (select id from athletes where team_id = %s)" if table == "personal_records" else "team_id = %s"
        conn.execute(f"delete from {table} where {column}", (team,))
    conn.execute("delete from teams where id = %s", (team,))
    conn.execute("delete from audit_logs where organization_id = %s", (org,))
    conn.execute("delete from organizations where id = %s", (org,))
    for user in users:
        for table in ("refresh_tokens", "idempotency_keys", "profiles", "oauth_accounts", "audit_logs"):
            conn.execute(f"delete from {table} where user_id = %s", (user,))
        conn.execute("delete from users where id = %s", (user,))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
