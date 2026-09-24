from __future__ import annotations

import logging

from .config import get_settings


def init_observability() -> None:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

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
