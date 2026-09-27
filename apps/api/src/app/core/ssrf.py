from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

_ALLOWED_HOSTS = frozenset(
    {
        "accounts.google.com",
        "oauth2.googleapis.com",
        "www.googleapis.com",
        "api.resend.com",
        "polarremote.com",
        "www.polaraccesslink.com",
        "live.swimrankings.net",
    }
)


def assert_safe_url(url: str, *, allowed_hosts: frozenset[str] | None = None, any_public_host: bool = False) -> None:
    """Block SSRF on outbound HTTP — only known provider hosts, or (for the live-results pages a coach
    pastes, which can be any organiser's site) any host that resolves only to public addresses."""
    allowed = allowed_hosts or _ALLOWED_HOSTS
    parsed = urlparse(url)
    if parsed.scheme not in {"https"}:
        raise ValueError("URL must use HTTPS")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host or (not any_public_host and host not in allowed):
        raise ValueError("Host not allowed")
    if parsed.port not in (None, 443):
        raise ValueError("Port not allowed")
    try:
        for info in socket.getaddrinfo(host, None):
            addr = info[4][0]
            ip = ipaddress.ip_address(addr)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise ValueError("Host resolves to private address")
    except socket.gaierror as exc:
        raise ValueError("Host resolution failed") from exc
