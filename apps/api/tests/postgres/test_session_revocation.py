"""#16: an access token stops working at once after logout or a password change, not 15 min later."""
from __future__ import annotations

from app.core.sessions import ACCESS_COOKIE

PASSWORD = "Teste-sintetico-2026"
NEW_PASSWORD = PASSWORD + "-nova"


def _login(client, email: str, password: str = PASSWORD) -> str:
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return client.cookies.get(ACCESS_COOKIE)


def _with_old_token(client, token: str):
    client.cookies.clear()
    client.cookies.set(ACCESS_COOKIE, token)
    return client.get("/api/v1/auth/me"), client.get("/api/v1/snapshot")


def test_old_access_token_is_rejected_after_logout(team_factory, api_engine, client_for):
    team = team_factory("Logout")
    client = client_for(api_engine, team.coach, "coach", team)
    old = _login(client, "treinador.logout@logout.test")
    assert [r.status_code for r in _with_old_token(client, old)] == [200, 200]

    client.cookies.set(ACCESS_COOKIE, old)
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert [r.status_code for r in _with_old_token(client, old)] == [401, 401]
    # A new login works as before.
    fresh = _login(client, "treinador.logout@logout.test")
    assert [r.status_code for r in _with_old_token(client, fresh)] == [200, 200]


def test_old_access_token_is_rejected_after_password_change(team_factory, api_engine, client_for):
    team = team_factory("Pwchange")
    client = client_for(api_engine, team.coach, "coach", team)
    old = _login(client, "treinador.pwchange@pwchange.test")
    changed = client.post("/api/v1/auth/change-password", json={"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD})
    assert changed.status_code == 200, changed.text
    new = client.cookies.get(ACCESS_COOKIE)
    assert new and new != old
    assert [r.status_code for r in _with_old_token(client, old)] == [401, 401]
    # The session the change issued is signed at the new version and keeps working.
    assert [r.status_code for r in _with_old_token(client, new)] == [200, 200]
