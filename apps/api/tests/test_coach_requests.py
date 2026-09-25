from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routes import coach_request_routes as routes


class FakeSession:
    def __init__(self, user):
        self.user = user

    def get(self, model, key):
        return self.user if key == self.user.id else None


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setattr(routes, "get_settings", lambda: SimpleNamespace(session_secret="s" * 40))


def _user(nonce="abc"):
    return SimpleNamespace(id=uuid4(), email="x@y.pt", role="pending", settings={"coach_request": {"nonce": nonce, "team_name": "Clube"}})


def test_valid_token_reads_request():
    user = _user()
    user_found, info = routes._read_token(FakeSession(user), routes._make_token(user.id, "abc"))
    assert user_found is user and info["team_name"] == "Clube"


def test_tampered_token_rejected():
    user = _user()
    token = routes._make_token(user.id, "abc")
    with pytest.raises(HTTPException):
        routes._read_token(FakeSession(user), token[:-2] + "xx")


def test_used_or_replaced_request_invalidates_link():
    user = _user(nonce="new")
    with pytest.raises(HTTPException):
        routes._read_token(FakeSession(user), routes._make_token(user.id, "old"))
    user.settings = {}
    with pytest.raises(HTTPException):
        routes._read_token(FakeSession(user), routes._make_token(user.id, "new"))


def test_expired_token_rejected(monkeypatch):
    user = _user()
    token = routes._make_token(user.id, "abc")
    monkeypatch.setattr(routes.time, "time", lambda: 10**12)
    with pytest.raises(HTTPException):
        routes._read_token(FakeSession(user), token)
