from __future__ import annotations

import json
import logging

from .config import get_settings


class JsonFormatter(logging.Formatter):
    """One JSON object per line: Cloud Logging reads `severity` and keeps the other fields searchable."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {"severity": record.levelname, "logger": record.name, "message": record.getMessage(), **getattr(record, "fields", {})}
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


def init_observability() -> None:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    if settings.is_production:
        for handler in logging.getLogger().handlers:
            handler.setFormatter(JsonFormatter())

    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=settings.app_env,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            send_default_pii=False,
        )
    except ImportError:
        logging.getLogger("aquastats").warning("sentry-sdk not installed — skip SENTRY_DSN")
