"""Cloudflare Email Routing: forward contact/security/info/noreply to management inbox."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ZONE_ID = "4419eed175c727ec704c16c1358139d2"
DOMAIN = "aquastats.net"
DEST = os.environ.get("AQUASTATS_MAILBOX", "aquastats@outlook.com")
ALIASES = ["contact", "security", "info", "noreply", "confirmation"]


def cf_token() -> str:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if token:
        return token
    candidates = [
        Path.home() / ".wrangler" / "config" / "default.toml",
        Path.home() / "AppData" / "Roaming" / "xdg.config" / ".wrangler" / "config" / "default.toml",
    ]
    for path in candidates:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for key in ("oauth_token", "api_token"):
            match = re.search(rf'{key}\s*=\s*"([^"]+)"', text)
            if match:
                return match.group(1)
    raise SystemExit("CLOUDFLARE_TOKEN_MISSING")


def cf(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        raise RuntimeError(f"{method} {path} -> {exc.code}: {payload}") from exc


def ensure_routing_enabled(token: str) -> None:
    cf("POST", f"/zones/{ZONE_ID}/email/routing/enable", token, {})


def ensure_destination(token: str) -> str:
    listed = cf("GET", f"/zones/{ZONE_ID}/email/routing/addresses", token)
    for item in listed.get("result", []):
        if (item.get("email") or "").lower() == DEST.lower():
            return item["tag"]
    created = cf("POST", f"/zones/{ZONE_ID}/email/routing/addresses", token, {"email": DEST})
    return created["result"]["tag"]


def ensure_rule(token: str, local: str, dest_tag: str) -> None:
    matcher = {"type": "literal", "field": "to", "value": f"{local}@{DOMAIN}"}
    action = {"type": "forward", "value": [dest_tag]}
    listed = cf("GET", f"/zones/{ZONE_ID}/email/routing/rules", token)
    for rule in listed.get("result", []):
        matchers = rule.get("matchers") or []
        if any(m.get("value") == matcher["value"] for m in matchers):
            print("RULE_EXISTS", local)
            return
    cf(
        "POST",
        f"/zones/{ZONE_ID}/email/routing/rules",
        token,
        {"name": f"forward-{local}", "enabled": True, "matchers": [matcher], "actions": [action]},
    )
    print("RULE_CREATE", local)


def main() -> int:
    token = cf_token()
    ensure_routing_enabled(token)
    dest_tag = ensure_destination(token)
    for alias in ALIASES:
        ensure_rule(token, alias, dest_tag)
    print("OK", DEST)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
