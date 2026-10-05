from __future__ import annotations

import logging
from urllib.parse import urlparse

from sqlalchemy import text

from .config import Settings, get_settings

_logger = logging.getLogger("aquastats.startup")

# The API's database role (migration 011): no BYPASSRLS, no CREATEROLE/CREATEDB, not a superuser.
API_ROLE = "aquastats_api"
_ROLE_CHECK = text(
    "SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = current_user"
)


def verify_database_role(engine, settings: Settings | None = None) -> None:
    """In production, refuse to start with a role that skips row-level security.

    The name check in validate_settings is not enough: a role can be altered by hand (as aquastats_app was).
    If the database cannot be reached the check is logged and skipped, so a database blip never stops new
    instances from starting; a role that bypasses RLS always does.
    """
    settings = settings or get_settings()
    if engine is None or not settings.is_production:
        return
    try:
        with engine.connect() as conn:
            privileged = bool(conn.execute(_ROLE_CHECK).scalar())
    except Exception as exc:  # connectivity, not a verdict on the role
        _logger.warning("Database role check skipped: %s", type(exc).__name__)
        return
    if privileged:
        raise RuntimeError(
            "A role da base de dados contorna a RLS (superuser, BYPASSRLS, CREATEROLE ou CREATEDB). "
            f"Usa {API_ROLE} (migração 011)."
        )


def validate_settings(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    errors: list[str] = []

    if not settings.is_production and settings.database_is_production:
        # Local and test runs apply DDL and migrations at startup: against production that is an unreviewed schema change.
        errors.append("DATABASE_URL aponta para a base de produção fora de APP_ENV=production. Usa a base local ou de staging.")

    if settings.is_production:
        if not settings.database_url.strip():
            errors.append("DATABASE_URL em falta em produção.")
        if len(settings.session_secret.strip()) < 32:
            errors.append("SESSION_SECRET deve ter >=32 caracteres em produção.")
        if not settings.app_url.startswith("https://"):
            errors.append("APP_URL deve ser https:// em produção.")
        if not settings.trust_proxy:
            errors.append("TRUST_PROXY=true em produção (Cloud Run + Cloudflare).")
        if not settings.database_enable_rls:
            errors.append("DATABASE_ENABLE_RLS=true é obrigatório em produção.")

        db = settings.database_url.strip()
        if db:
            parsed = urlparse(db.replace("postgresql+psycopg://", "postgresql://", 1))
            user = (parsed.username or "").lower()
            if user != API_ROLE:
                errors.append(f"DATABASE_URL deve usar a role {API_ROLE} em produção (migração 011).")

    if errors:
        raise RuntimeError("Configuração inválida: " + "; ".join(errors))

    _logger.info(
        "Startup OK env=%s rls=%s redis=%s sentry=%s",
        settings.app_env,
        settings.database_enable_rls,
        bool(settings.redis_url.strip()),
        bool(settings.sentry_dsn.strip()),
    )
