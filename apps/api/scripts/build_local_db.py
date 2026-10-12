"""Builds a LOCAL database with the full schema and every migration, ready for scripts/seed_synthetic.py.

    python scripts/build_local_db.py postgresql://postgres@127.0.0.1:5432/postgres aquastats_demo

Recreates the database (drops it first). Refuses anything but localhost. The two application roles
(aquastats_api, aquastats_auth) get LOGIN so a local server with trust authentication accepts them without a password.
"""
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg

DB_DIR = Path(__file__).resolve().parents[1] / "db"


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    admin_url, name = sys.argv[1], sys.argv[2]
    host = (urlsplit(admin_url).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1", "::1"}:
        sys.exit(f"Refused: {host!r} is not a local server.")
    if not name.replace("_", "").isalnum():
        sys.exit("Refused: database name must be letters, digits and underscores.")
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")
        admin.execute(f"CREATE DATABASE {name}")
    parts = urlsplit(admin_url)
    target = urlunsplit(parts._replace(path=f"/{name}"))
    with psycopg.connect(target, autocommit=True) as conn:
        # pgcrypto is optional locally: gen_random_uuid() is built in since PostgreSQL 13.
        conn.execute((DB_DIR / "schema.sql").read_text(encoding="utf-8").replace("create extension if not exists pgcrypto;", ""))
        conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())")
        for path in sorted((DB_DIR / "migrations").glob("*.sql")):
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT DO NOTHING", (path.name,))
        conn.execute("ALTER ROLE aquastats_api LOGIN")
        conn.execute("ALTER ROLE aquastats_auth LOGIN")
    print(f"ready: {name} (schema + migrations)")


if __name__ == "__main__":
    main()
