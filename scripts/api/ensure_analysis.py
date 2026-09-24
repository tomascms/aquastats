"""Corre a partir da raiz: PYTHONPATH=api/src python scripts/api/ensure_analysis.py"""

from sqlalchemy import text

from app.core.db import engine
from app.core.schema_sync import ensure_analysis_schema

ensure_analysis_schema()
assert engine is not None
with engine.connect() as conn:
    rows = conn.execute(
        text(
            """
            select tablename
            from pg_tables
            where schemaname = 'public'
              and tablename in ('race_sessions', 'season_plans', 'attendance_sessions')
            order by 1
            """
        )
    ).fetchall()
    print([row[0] for row in rows])
