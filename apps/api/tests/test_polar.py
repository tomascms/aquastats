import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.domain import polar


def test_token_is_encrypted_and_roundtrips():
    sealed = polar._seal("abc-token")
    assert "abc-token" not in sealed
    assert polar._open(sealed) == "abc-token"
    assert polar._seal("abc-token") != sealed  # random nonce


def test_only_swimmers_can_start(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "polar_client_id", "cid")
    monkeypatch.setattr(settings, "polar_client_secret", "sec")
    with pytest.raises(HTTPException) as error:
        polar.authorize_url({"role": "coach", "user_id": "u", "team_uuid": "t"})
    assert error.value.status_code == 403
    url = polar.authorize_url({"role": "swimmer", "athlete_uuid": "a", "user_id": "u", "team_uuid": "t"})
    assert url.startswith(polar.AUTH_URL) and "client_id=cid" in url and "state=" in url


def test_disabled_without_credentials(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "polar_client_id", "")
    assert polar.enabled() is False
    assert polar.sync_for(None, {"role": "coach"}) == {"imported": 0}
