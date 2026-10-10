from __future__ import annotations

import ipaddress

from starlette.requests import Request

from .config import get_settings


def _valid_ip(value: str | None) -> str | None:
    try:
        return str(ipaddress.ip_address((value or "").strip()))
    except ValueError:
        return None


def client_ip(request: Request) -> str:
    """The caller's address, for rate limits. Proxy headers count only behind our proxy (TRUST_PROXY) and only
    when they hold a real address: anything else falls through to the next source."""
    settings = get_settings()
    if settings.trust_proxy:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0]
        for candidate in (request.headers.get("cf-connecting-ip"), forwarded, request.headers.get("x-real-ip")):
            ip = _valid_ip(candidate)
            if ip:
                return ip
    return (_valid_ip(request.client.host) if request.client else None) or "unknown"


def stored_ip(request: Request) -> str | None:
    """The caller's address for audit rows and sessions (an inet column): a valid address or nothing."""
    return _valid_ip(client_ip(request))
