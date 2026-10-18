"""CSRF origin check and body size cap at the HTTP edge of the API."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.http_security import BodySizeLimitMiddleware, CsrfOriginMiddleware

SETTINGS = SimpleNamespace(cors_origins=["https://aquastats.net"], max_request_body_bytes=1000)


def client(middleware) -> TestClient:
    app = FastAPI()
    app.add_middleware(middleware)

    @app.post("/api/v1/echo")
    async def echo(request: Request):
        return {"size": len(await request.body())}

    return TestClient(app)


@patch("app.core.http_security.get_settings", return_value=SETTINGS)
class HttpGuardsTest(unittest.TestCase):
    def test_referer_must_match_the_origin_exactly(self, _):
        c = client(CsrfOriginMiddleware)
        self.assertEqual(c.post("/api/v1/echo", headers={"Referer": "https://aquastats.net/x"}).status_code, 200)
        self.assertEqual(c.post("/api/v1/echo", headers={"Referer": "https://aquastats.net.evil.com/x"}).status_code, 403)
        self.assertEqual(c.post("/api/v1/echo").status_code, 403)

    def test_chunked_body_over_the_limit_is_refused(self, _):
        c = client(BodySizeLimitMiddleware)
        self.assertEqual(c.post("/api/v1/echo", content=b"x" * 500).status_code, 200)
        self.assertEqual(c.post("/api/v1/echo", content=b"x" * 2000).status_code, 413)
        # No Content-Length (a generator is sent chunked): the running count still stops it.
        response = c.post("/api/v1/echo", content=(b"x" * 400 for _ in range(5)))
        self.assertEqual(response.status_code, 413)


if __name__ == "__main__":
    unittest.main()
