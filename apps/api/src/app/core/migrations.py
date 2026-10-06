from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text

from .config import get_settings
from .db import can_change_schema, engine

_MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "db" / "migrations"
_logger = logging.getLogger("aquastats.migrations")


def _ensure_table(conn) -> None:
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version text PRIMARY KEY,
              applied_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )
    )


def _applied(conn) -> set[str]:
    rows = conn.execute(text("SELECT version FROM schema_migrations")).fetchall()
    return {row[0] for row in rows}


def run_migrations() -> None:
    if engine is None:
        return
    settings = get_settings()
    if settings.is_production or settings.database_is_production or not can_change_schema():
        return
    if not _MIGRATIONS_DIR.is_dir():
        return
    files = sorted(_MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        return
    with engine.begin() as conn:
        # Prevent concurrent application replicas from applying the same migration.
        conn.execute(text("SELECT pg_advisory_xact_lock(hashtext('aquastats:migrations'))"))
        _ensure_table(conn)
        done = _applied(conn)
        for path in files:
            version = path.name
            if version in done:
                continue
            sql = path.read_text(encoding="utf-8")
            conn.execute(text(sql))
            conn.execute(text("INSERT INTO schema_migrations (version) VALUES (:v)"), {"v": version})
            _logger.info("Applied migration %s", version)
