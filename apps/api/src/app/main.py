from __future__ import annotations

import logging

import truststore

truststore.inject_into_ssl()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text

from .core.config import get_settings
from .core.db import auth_engine, engine
from .core.migrations import run_migrations
from .core.observability import init_observability
from .core.schema_sync import ensure_analysis_schema, ensure_auth_schema
from .core.startup import validate_settings, verify_database_role
from .core.http_security import (
    BodySizeLimitMiddleware,
    CsrfOriginMiddleware,
    EdgeAuthMiddleware,
    ProbeBlockMiddleware,
    RateLimitMiddleware,
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
)
from .routes.auth_routes import router as auth_router
from .routes.data_routes import router as data_router
from .routes.coach_request_routes import router as coach_request_router
from .routes.integration_routes import router as integration_router

init_observability()
settings = get_settings()
validate_settings(settings)
verify_database_role(engine, settings, auth_engine if auth_engine is not engine else None)
ensure_auth_schema()
ensure_analysis_schema()
run_migrations()
app = FastAPI(
    title="Aquastats API",
    version="0.2.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(CsrfOriginMiddleware)
app.add_middleware(EdgeAuthMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(ProbeBlockMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Idempotency-Key", "X-Request-Id"],
)
# Outermost: compresses what the Worker fetches (a team snapshot is mostly repetitive JSON).
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)

app.include_router(auth_router)
app.include_router(data_router)
app.include_router(coach_request_router)
app.include_router(integration_router)


@app.exception_handler(RuntimeError)
async def runtime_errors(request: Request, exc: RuntimeError):
    message = str(exc)
    if "DATABASE_URL" in message or "SESSION_SECRET" in message:
        detail = message if not settings.is_production else "Serviço indisponível."
        return JSONResponse({"detail": detail, "requestId": getattr(request.state, "request_id", None)}, status_code=503)
    return JSONResponse({"detail": "Erro interno.", "requestId": getattr(request.state, "request_id", None)}, status_code=500)


@app.exception_handler(StarletteHTTPException)
async def http_errors(request: Request, exc: StarletteHTTPException):
    # 503s are raised on purpose with a message for the user (e.g. mail provider down); other 5xx stay opaque.
    detail = exc.detail if exc.status_code < 500 or exc.status_code == 503 else "Erro interno."
    if exc.status_code == 404:
        detail = "Não encontrado."
    return JSONResponse({"detail": detail, "requestId": getattr(request.state, "request_id", None)}, status_code=exc.status_code)


@app.exception_handler(Exception)
async def hidden_errors(request: Request, exc: Exception):
    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        return await http_errors(request, exc)  # type: ignore[arg-type]
    logging.exception("API error %s %s", request.method, request.url.path)
    detail = str(exc) if not settings.is_production else "Erro interno."
    return JSONResponse({"detail": detail, "requestId": getattr(request.state, "request_id", None)}, status_code=500)


@app.get("/api/v1/health")
def health():
    return {"ok": True, "service": "aquastats-api"}


@app.get("/api/v1/health/ready")
def ready():
    if engine is None:
        return JSONResponse({"ok": False, "detail": "DATABASE_URL em falta"}, status_code=503)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse({"ok": False, "detail": "Base de dados indisponível"}, status_code=503)
    return {"ok": True}


@app.get("/api/v1/sync")
@app.put("/api/v1/sync")
def sync_removed():
    return JSONResponse({"detail": "Sincronização anónima removida. Entra com Google ou email."}, status_code=410)
