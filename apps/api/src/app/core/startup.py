from __future__ import annotations

import logging
from urllib.parse import urlparse

from .config import Settings, get_settings

_logger = logging.getLogger("aquastats.startup")


def validate_settings(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    errors: list[str] = []

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
            if user != "aquastats_app":
                errors.append("DATABASE_URL deve usar a role aquastats_app em produção.")

    if errors:
        raise RuntimeError("Configuração inválida: " + "; ".join(errors))

    _logger.info(
        "Startup OK env=%s rls=%s redis=%s sentry=%s",
        settings.app_env,
        settings.database_enable_rls,
        bool(settings.redis_url.strip()),
        bool(settings.sentry_dsn.strip()),
    )
