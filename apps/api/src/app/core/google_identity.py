from __future__ import annotations

from functools import lru_cache

import jwt
from jwt import PyJWKClient

GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"


@lru_cache(maxsize=1)
def _jwks() -> PyJWKClient:
    return PyJWKClient(JWKS_URL, cache_jwk_set=True, lifespan=3600)


def verify_google_id_token(credential: str, audience: str) -> dict:
    token = (credential or "").strip()
    if token.count(".") != 2:
        raise ValueError("token")
    signing_key = _jwks().get_signing_key_from_jwt(token)
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=list(GOOGLE_ISSUERS),
        leeway=10,
        options={"require": ["sub", "iss", "aud", "exp"]},
    )
    if not payload.get("sub"):
        raise ValueError("sub")
    return payload
