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


# Frequent passwords (and their obvious variants) that pass the length and letters+digits rules; lower-cased.
_COMMON = frozenset(
    {
        "1234567890ab", "123456789abc", "abc123456789", "password1234", "password12345", "passw0rd1234",
        "qwerty123456", "qwertyuiop12", "qwertyuiop123", "asdfghjkl123", "zaq12wsxcde3", "1q2w3e4r5t6y",
        "iloveyou1234", "letmein12345", "welcome12345", "admin1234567", "monkey123456", "dragon123456",
        "football1234", "baseball1234", "sunshine1234", "princess1234", "superman1234", "trustno12345",
        "palavrapasse1", "palavrapasse123", "palavra12345", "senha1234567", "s3nha1234567", "portugal1234",
        "portugal2024", "portugal2025", "portugal2026", "benfica12345", "sporting1234", "fcporto12345",
        "lisboa123456", "aquastats123", "aquastats2026", "natacao12345", "natacao2026", "piscina12345",
        "nadador12345", "treinador123", "treinador2026", "atleta123456", "swimming1234", "swimmer12345",
        "1234qwerasdf", "qwer1234asdf", "abcd1234efgh", "a1b2c3d4e5f6",
    }
)


MIN_PASSWORD_LENGTH = 12  # docs/security: new passwords only; existing ones keep working at login


def valid_password(password: str) -> bool:
    value = password or ""
    if not (MIN_PASSWORD_LENGTH <= len(value) <= 128):
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
