from __future__ import annotations

from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings
from .rls import set_system_context


class Base(DeclarativeBase):
    pass


def _normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _connect_args(url: str) -> dict:
    parsed = urlparse(url.replace("postgresql+psycopg://", "postgresql://", 1))
    host = (parsed.hostname or "").lower()
    local = host in {"localhost", "127.0.0.1", "::1"}
    sslmode = get_settings().database_sslmode.strip().lower()
    if sslmode in {"", "auto"}:
        sslmode = "disable" if local else "require"
    args: dict = {"sslmode": sslmode}
    if parsed.port == 6543 or "pooler" in host:
        args["prepare_threshold"] = None
    return args


def _engine():
    settings = get_settings()
    if not settings.database_url:
        return None
    url = _normalize_url(settings.database_url.strip())
    eng = create_engine(
        url,
        pool_pre_ping=True,
        pool_size=3,
        max_overflow=7,
        pool_recycle=300,
        pool_timeout=10,
        future=True,
        connect_args=_connect_args(url),
    )
    timeout_ms = get_settings().db_statement_timeout_ms
    if timeout_ms > 0:

        @event.listens_for(eng, "connect")
        def _set_timeouts(dbapi_conn, _connection_record):
            ms = max(1000, min(int(timeout_ms), 120_000))
            with dbapi_conn.cursor() as cur:
                cur.execute(f"SET statement_timeout = '{ms}ms'")
                cur.execute("SET idle_in_transaction_session_timeout = '60s'")

    return eng


engine = _engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None


def _session_lifecycle(session):
    try:
        yield session
        session.commit()
    except HTTPException:
        try:
            session.commit()
        except Exception:
            session.rollback()
        raise
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session():
    if SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="A base de dados ainda não está ligada. Cola a DATABASE_URL PostgreSQL no api/.env e reinicia a API.",
        )
    session = SessionLocal()
    yield from _session_lifecycle(session)


def get_auth_session():
    """Login/signup — bypass RLS for global auth tables."""
    if SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="A base de dados ainda não está ligada. Cola a DATABASE_URL PostgreSQL no api/.env e reinicia a API.",
        )
    session = SessionLocal()
    set_system_context(session)
    yield from _session_lifecycle(session)
