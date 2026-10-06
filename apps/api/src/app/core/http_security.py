from __future__ import annotations

import hashlib
import hmac
import re
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import get_settings
from .rate_limit import check_rate_limit

_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

# Re-export for existing imports
from .client import client_ip  # noqa: F401


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # A caller's id is kept only if it is a plain token (it ends up in logs and audit rows).
        incoming = request.headers.get("x-request-id") or ""
        request_id = incoming if _REQUEST_ID.fullmatch(incoming) else secrets.token_hex(16)
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

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Frame-Options"] = "DENY"

        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Restrict feature permissions
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=(), "
            "accelerometer=(), vr=(), xr-spatial-tracking=()"
        )

        # Cross-origin policies
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"

        # Additional security
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["X-Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.aquastats.net; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "upgrade-insecure-requests; "
            "block-all-mixed-content;"
        )

        # Cache control
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # HTTPS only in production
        if get_settings().is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        blocked = check_rate_limit(request)
        if blocked is not None:
            return blocked
        return await call_next(request)


# Official meet files (Lenex/PDF, base64) are bigger than normal JSON; bounded separately.
_UPLOAD_PREFIXES = ("/api/v1/meet-files/", "/api/v1/hr/")
UPLOAD_BODY_BYTES = 21 * 1024 * 1024  # 15 MB files, base64-encoded


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        length = request.headers.get("content-length")
        limit = UPLOAD_BODY_BYTES if request.url.path.startswith(_UPLOAD_PREFIXES) else get_settings().max_request_body_bytes
        if length and length.isdigit() and int(length) > limit:
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
