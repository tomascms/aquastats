import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.http_security import RequestIdMiddleware
from app.core.observability import JsonFormatter


def test_one_json_line_per_request_without_query_string(caplog):
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/api/v1/x")
    def x():
        return {"ok": True}

    with caplog.at_level(logging.INFO, logger="aquastats.request"):
        TestClient(app).get("/api/v1/x?t=secret-token", headers={"X-Request-Id": "abc-1"})
    record = next(r for r in caplog.records if r.name == "aquastats.request")
    line = json.loads(JsonFormatter().format(record))
    assert line["severity"] == "INFO" and line["status"] == 200 and line["requestId"] == "abc-1"
    assert line["path"] == "/api/v1/x" and "secret-token" not in json.dumps(line)
