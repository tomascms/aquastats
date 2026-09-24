from __future__ import annotations

from starlette.requests import Request

from .config import get_settings


def client_ip(request: Request) -> str:
    settings = get_settings()
    if settings.trust_proxy:
        cf = (request.headers.get("cf-connecting-ip") or "").strip()
        if cf:
            return cf
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = (request.headers.get("x-real-ip") or "").strip()
        if real_ip:
            return real_ip
    return request.client.host if request.client else "unknown"
