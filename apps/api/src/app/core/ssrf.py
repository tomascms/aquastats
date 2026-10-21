from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx

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
    _public_addresses(host)


def _public_addresses(host: str) -> list[str]:
    """Every address the name resolves to, refused if any of them is private."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise ValueError("Host resolution failed") from exc
    addresses = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError("Host resolves to private address")
        addresses.append(str(ip))
    if not addresses:
        raise ValueError("Host resolution failed")
    return addresses


class PinnedTransport(httpx.HTTPTransport):
    """Connects to the address it has just vetted, so a second DNS answer (DNS rebinding) is never used.

    The name is resolved and checked once per request, and the connection goes to that IP. The Host header
    keeps the original name (httpx set it from the URL), and TLS sends it as SNI and checks the certificate
    against it. Redirects stay off in the client: each hop would be a new, unchecked request.
    """

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host
        request.url = request.url.copy_with(host=_public_addresses(host)[0])
        request.extensions = {**request.extensions, "sni_hostname": host}
        return super().handle_request(request)
