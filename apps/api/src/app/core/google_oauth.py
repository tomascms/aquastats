from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import urllib.parse

import httpx

from .config import get_settings
from .http_security import compare
from .ssrf import assert_safe_url

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
OAUTH_COOKIE = "sa_google_oauth"
OAUTH_TTL_SECONDS = 600


def _secret() -> bytes:
    raw = get_settings().session_secret.strip()
    if len(raw) < 32:
        raise RuntimeError("SESSION_SECRET (>=32 caracteres) é obrigatório")
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64d(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def google_redirect_uri() -> str:
    return f"{get_settings().app_url.rstrip('/')}/api/v1/auth/google/callback"


def pkce_verifier() -> str:
    return secrets.token_urlsafe(64)


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return _b64(digest)


def sign_oauth_state(payload: dict) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64(hmac.new(_secret(), body.encode("utf-8"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_oauth_state(token: str | None) -> dict | None:
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    expected = _b64(hmac.new(_secret(), body.encode("utf-8"), hashlib.sha256).digest())
    if not compare(sig, expected):
        return None
    try:
        payload = json.loads(_b64d(body).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp") or 0) < int(time.time()):
        return None
    return payload


def build_authorize_url(*, client_id: str, state: str, code_challenge: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code(*, code: str, code_verifier: str, client_id: str, client_secret: str = "") -> dict:
    payload = {
        "code": code,
        "client_id": client_id,
        "redirect_uri": google_redirect_uri(),
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    if client_secret.strip():
        payload["client_secret"] = client_secret.strip()
    assert_safe_url(GOOGLE_TOKEN_URL)
    with httpx.Client(timeout=20.0) as client:
        response = client.post(GOOGLE_TOKEN_URL, data=payload)
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict):
        raise ValueError("token")
    return body
