from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerifyMismatchError

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
_DUMMY = _hasher.hash("timing-dummy-not-a-real-account")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        try:
            _hasher.verify(_DUMMY, password)
        except (VerifyMismatchError, InvalidHash):
            pass
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHash):
        return False


_COMMON = frozenset(
    {
        "1234567890",
        "password12",
        "password123",
        "qwerty1234",
        "qwertyuiop",
        "1111111111",
        "0000000000",
        "abcdefghij",
        "letmein123",
        "welcome123",
        "admin12345",
        "passw0rd12",
        "iloveyou12",
        "monkey1234",
        "dragon1234",
        "baseball12",
        "football12",
        "s3nha12345",
        "palavrapasse",
        "treinador1",
    }
)


def valid_password(password: str) -> bool:
    value = password or ""
    if not (8 <= len(value) <= 128):
        return False
    if value.lower() in _COMMON:
        return False
    if not any(char.isalpha() for char in value):
        return False
    if not any(char.isdigit() for char in value):
        return False
    return True


def clean_text(value: str, limit: int = 200) -> str:
    return "".join(char for char in (value or "") if char.isprintable() and char not in "\x00\x1b").strip()[:limit]


def is_honeypot(body: dict | None) -> bool:
    if not body:
        return False
    return bool(str(body.get("sa_hp") or "").strip())


def valid_email(email: str) -> bool:
    if "@" not in email or len(email) > 254:
        return False
    local, _, domain = email.partition("@")
    return bool(local) and "." in domain
