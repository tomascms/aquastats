from __future__ import annotations

import hmac
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
    # The Cloudflare Worker passes the visitor's address in x-aquastats-client-ip; its own subrequest headers
    # carry the Worker's egress address. Believed only with a valid x-edge-auth, so a direct caller can't forge it.
    token = getattr(settings, "edge_auth_token", "")
    if token and hmac.compare_digest(request.headers.get("x-edge-auth") or "", token):
        ip = _valid_ip(request.headers.get("x-aquastats-client-ip"))
        if ip:
            return ip
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
