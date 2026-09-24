from __future__ import annotations

import hashlib
import hmac
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import get_settings
from .rate_limit import check_rate_limit

# Re-export for existing imports
from .client import client_ip  # noqa: F401


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or secrets.token_hex(16)
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response


class EdgeAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        token = get_settings().edge_auth_token.strip()
        if token and not hmac.compare_digest(request.headers.get("x-edge-auth", ""), token):
            return JSONResponse({"detail": "Origem não autorizada."}, status_code=403)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cache-Control"] = "no-store"
        if get_settings().is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        blocked = check_rate_limit(request)
        if blocked is not None:
            return blocked
        return await call_next(request)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > get_settings().max_request_body_bytes:
            return JSONResponse({"detail": "Pedido demasiado grande."}, status_code=413)
        return await call_next(request)


_PROBE = (
    "/.env",
    "/.git",
    "/.htaccess",
    "/wp-admin",
    "/wp-login.php",
    "/xmlrpc.php",
    "/phpmyadmin",
    "/administrator",
    "/backup.sql",
    "/config.php",
)


class ProbeBlockMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path.lower()
        if any(path == item or path.startswith(f"{item}/") or path.startswith(f"{item}.") for item in _PROBE):
            return JSONResponse({"detail": "Não encontrado."}, status_code=404)
        if path.endswith(".env") or "/.git/" in path or path.endswith(".sql.gz"):
            return JSONResponse({"detail": "Não encontrado."}, status_code=404)
        return await call_next(request)


class CsrfOriginMiddleware(BaseHTTPMiddleware):
    """Mutations must come from the app origin. Complements SameSite cookies."""

    async def dispatch(self, request: Request, call_next):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)
        allowed = set(get_settings().cors_origins)
        origin = request.headers.get("origin") or ""
        if origin:
            if origin not in allowed:
                return JSONResponse({"detail": "Origem recusada."}, status_code=403)
            return await call_next(request)
        referer = request.headers.get("referer") or ""
        if any(referer.startswith(item) for item in allowed):
            return await call_next(request)
        return JSONResponse({"detail": "Origem recusada."}, status_code=403)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)
