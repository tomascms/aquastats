from __future__ import annotations

import logging
import time
from urllib.parse import urlparse

from sqlalchemy import text

from .config import Settings, get_settings

_logger = logging.getLogger("aquastats.startup")

# The API's database roles: no BYPASSRLS, no CREATEROLE/CREATEDB, not superusers. aquastats_api serves every
# team request (migration 011); aquastats_auth only the auth flows, the one role allowed to cross tenants (012).
API_ROLE = "aquastats_api"
AUTH_ROLE = "aquastats_auth"
_ROLE_CHECK = text(
    "SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = current_user"
)
_CAN_BECOME_AUTH = text("SELECT pg_has_role(current_user, :auth, 'MEMBER')")
# 3 attempts over ~10 s (plus the connect timeouts) before refusing to start.
_RETRY_DELAYS = (3, 7)


def _check(engine, query, params=None):
    with engine.connect() as conn:
        return bool(conn.execute(query, params or {}).scalar())


def verify_database_role(engine, settings: Settings | None = None, auth_engine=None) -> None:
    """In production, refuse to start with a role that skips row-level security, or with an API role that
    could act as the auth role.

    The name check in validate_settings is not enough: a role can be altered by hand (as aquastats_app was).
    The check fails closed: if the database stays unreachable after the retries the instance does not start
    (Cloud Run starts another), because an unverified role could be one that skips RLS.
    """
    settings = settings or get_settings()
    if engine is None or not settings.is_production:
        return
    for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
        try:
            privileged = _check(engine, _ROLE_CHECK) or (auth_engine is not None and _check(auth_engine, _ROLE_CHECK))
            api_is_auth = _check(engine, _CAN_BECOME_AUTH, {"auth": AUTH_ROLE})
            break
        except Exception as exc:  # connectivity, not a verdict on the roles
            if delay is None:
                _logger.error("Database role check failed %d times (%s): refusing to start", attempt, type(exc).__name__)
                raise RuntimeError(
                    "Não consegui confirmar que as roles da base de dados respeitam a RLS (base inacessível). "
                    "A API não arranca sem essa confirmação."
                ) from exc
            _logger.warning("Database role check attempt %d failed (%s), retrying in %ss", attempt, type(exc).__name__, delay)
            time.sleep(delay)
    if privileged:
        raise RuntimeError(
            "Uma role da base de dados contorna a RLS (superuser, BYPASSRLS, CREATEROLE ou CREATEDB). "
            f"Usa {API_ROLE} e {AUTH_ROLE} (migrações 011 e 012)."
        )
    if api_is_auth:
        raise RuntimeError(f"A role da API não pode pertencer a {AUTH_ROLE}: os pedidos normais passariam a ignorar a RLS.")


def validate_settings(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    errors: list[str] = []

    if not settings.is_production and settings.database_is_production:
        # Local and test runs apply DDL and migrations at startup: against production that is an unreviewed schema change.
        errors.append("DATABASE_URL aponta para a base de produção fora de APP_ENV=production. Usa a base local ou de staging.")

    if settings.is_production:
        if not settings.database_url.strip():
            errors.append("DATABASE_URL em falta em produção.")
        if not settings.auth_database_url.strip():
            errors.append(f"AUTH_DATABASE_URL em falta em produção (role {AUTH_ROLE}, migração 012).")
        if len(settings.session_secret.strip()) < 32:
            errors.append("SESSION_SECRET deve ter >=32 caracteres em produção.")
        if not settings.app_url.startswith("https://"):
            errors.append("APP_URL deve ser https:// em produção.")
        if not settings.trust_proxy:
            errors.append("TRUST_PROXY=true em produção (Cloud Run + Cloudflare).")
        if len(settings.edge_auth_token.strip()) < 32:
            errors.append("EDGE_AUTH_TOKEN (>=32 caracteres) é obrigatório em produção: sem ele a origem aceita qualquer pedido.")
        if not settings.database_enable_rls:
            errors.append("DATABASE_ENABLE_RLS=true é obrigatório em produção.")

        db = settings.database_url.strip()
        if db:
            parsed = urlparse(db.replace("postgresql+psycopg://", "postgresql://", 1))
            user = (parsed.username or "").lower()
            if user != API_ROLE:
                errors.append(f"DATABASE_URL deve usar a role {API_ROLE} em produção (migração 011).")
        auth_db = settings.auth_database_url.strip()
        if auth_db:
            auth_user = (urlparse(auth_db.replace("postgresql+psycopg://", "postgresql://", 1)).username or "").lower()
            if auth_user != AUTH_ROLE:
                errors.append(f"AUTH_DATABASE_URL deve usar a role {AUTH_ROLE} em produção (migração 012).")

    if errors:
        raise RuntimeError("Configuração inválida: " + "; ".join(errors))

    _logger.info(
        "Startup OK env=%s rls=%s redis=%s sentry=%s",
        settings.app_env,
        settings.database_enable_rls,
        bool(settings.redis_url.strip()),
        bool(settings.sentry_dsn.strip()),
    )
