"""Browser error reports: CSRF-protected, rate limited, logged without personal data."""
import json
import logging
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.http_security import CsrfOriginMiddleware, RateLimitMiddleware
from app.core.observability import JsonFormatter
from app.routes.client_error_routes import clean_route, router

SETTINGS = SimpleNamespace(cors_origins=["https://aquastats.net"], is_production=True, redis_url="")
ORIGIN = {"Origin": "https://aquastats.net"}


def make_client() -> TestClient:
    app = FastAPI()
    app.add_middleware(CsrfOriginMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.include_router(router)
    return TestClient(app)


@patch("app.core.rate_limit.get_settings", return_value=SETTINGS)
@patch("app.core.http_security.get_settings", return_value=SETTINGS)
def test_report_is_logged_without_personal_data(_a, _b, caplog):
    long_id = "Q" * 45  # masked like a session token
    body = {
        "route": "/coach/team/7b0c6a3e-1111-4222-8333-944445555666/atleta/42?token=abc#x",
        "message": f"Falhou para ana.silva@example.pt com {long_id}",
        "stack": "Error\n at f (https://aquastats.net/_next/static/chunks/app-page-1a2b3c.js?v=1:1:2)\n" * 90,
    }
    with caplog.at_level(logging.WARNING, logger="aquastats.client_error"):
        response = make_client().post("/api/v1/client-errors", json=body, headers=ORIGIN)
    assert response.status_code == 204
    line = json.loads(JsonFormatter().format(next(r for r in caplog.records if r.name == "aquastats.client_error")))
    text = json.dumps(line)
    assert line["severity"] == "WARNING" and line["route"] == "/coach/team/:id/atleta/:id"
    assert "ana.silva" not in text and long_id not in text and "token=abc" not in text and "?v=1" not in text
    assert "[email]" in line["error"] and "[token]" in line["error"]
    assert "app-page-1a2b3c.js" in line["stack"] and len(line["stack"]) == 2000


@patch("app.core.rate_limit.get_settings", return_value=SETTINGS)
@patch("app.core.http_security.get_settings", return_value=SETTINGS)
def test_other_origins_are_refused_and_bursts_are_capped(_a, _b):
    rate_limit._hits.clear()
    client = make_client()
    assert client.post("/api/v1/client-errors", json={"message": "x"}).status_code == 403
    assert client.post("/api/v1/client-errors", json={"message": "x"}, headers={"Origin": "https://evil.example"}).status_code == 403
    rate_limit._hits.clear()  # refused requests count too (the limiter runs first)
    codes = [client.post("/api/v1/client-errors", json={"message": "x"}, headers=ORIGIN).status_code for _ in range(12)]
    assert codes[:10] == [204] * 10 and codes[10:] == [429, 429]
    rate_limit._hits.clear()


def test_route_keeps_page_names():
    assert clean_route("/swimmer/definicoes") == "/swimmer/definicoes"
    assert clean_route("/entrar?next=/coach") == "/entrar"
