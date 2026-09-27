from urllib.parse import parse_qs, urlparse

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
        polar.authorize_url({"role": "coach", "user_id": "u", "team_uuid": "t"}, "n")
    assert error.value.status_code == 403
    url = polar.authorize_url({"role": "swimmer", "athlete_uuid": "a", "user_id": "u", "team_uuid": "t"}, "n")
    assert url.startswith(polar.AUTH_URL) and "client_id=cid" in url and "state=" in url


def _state(monkeypatch, nonce: str) -> str:
    settings = get_settings()
    monkeypatch.setattr(settings, "polar_client_id", "cid")
    monkeypatch.setattr(settings, "polar_client_secret", "sec")
    url = polar.authorize_url({"role": "swimmer", "athlete_uuid": "a", "user_id": "u", "team_uuid": "t"}, nonce)
    return parse_qs(urlparse(url).query)["state"][0]


@pytest.mark.parametrize("cookie", [None, "", "someone-elses-nonce"])
def test_callback_rejected_in_another_browser(monkeypatch, cookie):
    """A consent link started by one person can't be finished in someone else's browser."""
    state = _state(monkeypatch, "mine")
    monkeypatch.setattr(polar, "_client", lambda: pytest.fail("must not reach Polar"))
    with pytest.raises(HTTPException) as error:
        polar.finish(None, "code", state, cookie)
    assert error.value.status_code == 400


def test_disabled_without_credentials(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "polar_client_id", "")
    assert polar.enabled() is False
    assert polar.sync_for(None, {"role": "coach"}) == {"imported": 0}
