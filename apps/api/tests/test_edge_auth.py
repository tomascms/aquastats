"""The origin only answers the Cloudflare Worker once EDGE_AUTH_TOKEN is set (Phase G step: close the origin)."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.http_security import EdgeAuthMiddleware

TOKEN = "edge-token-for-tests-only"


def app_with_edge_auth() -> TestClient:
    app = FastAPI()
    app.add_middleware(EdgeAuthMiddleware)

    @app.get("/api/v1/health")
    def health():
        return {"ok": True}

    return TestClient(app)


class EdgeAuthTest(unittest.TestCase):
    @patch("app.core.http_security.get_settings", return_value=SimpleNamespace(edge_auth_token=TOKEN))
    def test_direct_calls_without_the_token_are_refused(self, _):
        client = app_with_edge_auth()
        self.assertEqual(client.get("/api/v1/health").status_code, 403)
        self.assertEqual(client.get("/api/v1/health", headers={"X-Edge-Auth": "wrong"}).status_code, 403)
        self.assertEqual(client.get("/api/v1/health", headers={"X-Edge-Auth": TOKEN}).status_code, 200)

    @patch("app.core.http_security.get_settings", return_value=SimpleNamespace(edge_auth_token=""))
    def test_without_a_configured_token_the_origin_stays_open(self, _):
        # Today's production state (measured 06/10/2026): the Cloud Run URL answers anyone.
        self.assertEqual(app_with_edge_auth().get("/api/v1/health").status_code, 200)


if __name__ == "__main__":
    unittest.main()
