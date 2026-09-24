from __future__ import annotations

import logging

import truststore

truststore.inject_into_ssl()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text

from .core.config import get_settings
from .core.db import engine
from .core.migrations import run_migrations
from .core.observability import init_observability
from .core.schema_sync import ensure_analysis_schema, ensure_auth_schema
from .core.startup import validate_settings
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
from .routes.prediction_routes import router as prediction_router

init_observability()
settings = get_settings()
validate_settings(settings)
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

app.include_router(auth_router)
app.include_router(data_router)
app.include_router(prediction_router)


@app.exception_handler(RuntimeError)
async def runtime_errors(request: Request, exc: RuntimeError):
    message = str(exc)
    if "DATABASE_URL" in message or "SESSION_SECRET" in message:
        detail = message if not settings.is_production else "Serviço indisponível."
        return JSONResponse({"detail": detail, "requestId": getattr(request.state, "request_id", None)}, status_code=503)
    return JSONResponse({"detail": "Erro interno.", "requestId": getattr(request.state, "request_id", None)}, status_code=500)


@app.exception_handler(StarletteHTTPException)
async def http_errors(request: Request, exc: StarletteHTTPException):
    detail = exc.detail if exc.status_code < 500 else "Erro interno."
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
