from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

# AQUASTATS_ENV_FILE picks another env file; empty means none (tests must not read a developer's .env).
_ENV = os.environ.get("AQUASTATS_ENV_FILE", str(Path(__file__).resolve().parents[3] / ".env")) or None
_PRODUCTION_HOSTS = frozenset({"aquastats.net", "www.aquastats.net"})
# Neon endpoint of the production branch (an id, not a secret). Outside APP_ENV=production the API runs its
# startup DDL and migrations, so it must never start against this database.
_PRODUCTION_DB_ENDPOINTS = frozenset({"ep-rough-unit-b1cgm5pl"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV, extra="ignore")

    app_env: str = "development"
    app_url: str = "http://127.0.0.1:3000"
    api_url: str = "http://127.0.0.1:8000"
    database_url: str = ""
    # aquastats_auth (migration 012): login, signup, tokens and account deletion. Empty = DATABASE_URL.
    auth_database_url: str = ""
    database_sslmode: str = "auto"
    session_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    redis_url: str = ""
    trust_proxy: bool = False
    cors_origins_extra: str = ""
    max_request_body_bytes: int = 1_048_576
    access_ttl_seconds: int = 900
    refresh_ttl_seconds: int = 60 * 60 * 24 * 7
    mail_from: str = ""
    contact_email: str = ""
    security_email: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    coach_signup_enabled: bool = False
    database_enable_rls: bool = False
    db_statement_timeout_ms: int = 30_000
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.05
    recent_auth_seconds: int = 300
    edge_auth_token: str = ""
    outbox_batch_size: int = 20
    coach_request_email: str = "aquastats@outlook.com"
    polar_client_id: str = ""
    polar_client_secret: str = ""
    # Google AI Studio key: meet regulations are read by Gemini when set, by the local parser otherwise.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    # Our own reader on Workers AI (apps/ai-worker): tried first, Gemini is the fallback.
    ai_worker_url: str = ""
    ai_worker_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def database_is_production(self) -> bool:
        for url in (self.database_url, self.auth_database_url):
            host = (urlparse(url.strip().replace("postgresql+psycopg://", "postgresql://", 1)).hostname or "").lower()
            if any(host.startswith(endpoint) for endpoint in _PRODUCTION_DB_ENDPOINTS):
                return True
        return False

    @staticmethod
    def _production_origin_allowed(origin: str) -> bool:
        parsed = urlparse(origin)
        if parsed.scheme != "https":
            return False
        host = (parsed.hostname or "").lower()
        return host in _PRODUCTION_HOSTS

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.app_url.rstrip("/")]
        if not self.is_production:
            origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])
        for item in self.cors_origins_extra.split(","):
            origin = item.strip().rstrip("/")
            if not origin:
                continue
            if self.is_production:
                if self._production_origin_allowed(origin):
                    origins.append(origin)
            else:
                origins.append(origin)
        if self.is_production:
            origins = [origin for origin in origins if self._production_origin_allowed(origin)]
        return list(dict.fromkeys(origin for origin in origins if origin))


@lru_cache
def get_settings() -> Settings:
    return Settings()
