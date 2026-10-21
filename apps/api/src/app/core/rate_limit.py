from __future__ import annotations

import time
from collections import defaultdict
from urllib.parse import urlparse

from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import get_settings
from .client import client_ip

_hits: dict[str, list[float]] = defaultdict(list)
_EXEMPT = frozenset({"/api/v1/health", "/api/v1/health/ready", "/health"})


def _limit(path: str, method: str) -> int:
    # API fica acima da edge (Cloudflare) — segunda linha, não o gargalo no uso normal.
    if path == "/api/v1/auth/refresh":
        return 180
    if path == "/api/v1/client-errors":
        return 10  # browser error reports: a broken page must not flood the logs
    if method in {"POST", "PUT", "PATCH", "DELETE"}:
        if path.startswith("/api/v1/auth"):
            return 80
        if path.startswith("/api/v1/times"):
            return 900
        return 480
    if "/auth/join/" in path:
        return 40
    if path.startswith("/api/v1/auth"):
        return 120
    return 600


def _redis_incr(key: str, window_sec: int) -> int | None:
    url = get_settings().redis_url.strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in {"redis", "rediss"}:
        return None
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    password = parsed.password
    use_tls = parsed.scheme == "rediss"
    try:
        import redis  # type: ignore[import-untyped]
    except ImportError:
        return None
    try:
        client = redis.Redis(
            host=host,
            port=port,
            password=password,
            ssl=use_tls,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_sec)
        count, _ = pipe.execute()
        return int(count)
    except Exception:
        return None


_last_sweep = 0.0


def _sweep(now: float, window_sec: int) -> None:
    """Forget buckets with no hit inside the window, at most once a minute (memory stays bounded)."""
    global _last_sweep
    if now - _last_sweep < 60:
        return
    _last_sweep = now
    for key in [key for key, stamps in _hits.items() if not stamps or now - stamps[-1] >= window_sec]:
        _hits.pop(key, None)


def check_rate_limit(request: Request) -> Response | None:
    if not get_settings().is_production:
        return None
    path = request.url.path
    if path in _EXEMPT:
        return None
    ip = client_ip(request)
    now = time.time()
    window_sec = 60
    parts = [part for part in path.split("/") if part]
    family = "/".join(parts[2:4]) if len(parts) >= 4 else (parts[2] if len(parts) >= 3 else "root")
    bucket = f"rl:{ip}:{request.method}:{family}"
    limit = _limit(path, request.method)

    redis_count = _redis_incr(bucket, window_sec)
    if redis_count is not None:
        if redis_count > limit:
            return JSONResponse({"detail": "Demasiados pedidos. Espera um pouco."}, status_code=429)
        return None

    _sweep(now, window_sec)
    window = [stamp for stamp in _hits[bucket] if now - stamp < window_sec]
    if len(window) >= limit:
        return JSONResponse({"detail": "Demasiados pedidos. Espera um pouco."}, status_code=429)
    window.append(now)
    _hits[bucket] = window
    return None
