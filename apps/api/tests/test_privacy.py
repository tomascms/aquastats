"""Parental consent (under 13), the health-data gate and the guardian's signed link — without a database."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.domain import privacy


def _session(row=None):
    session = MagicMock()
    session.get.side_effect = lambda model, key: row if model is privacy.ParentalConsent else None
    return session


def _years_ago(years: int, days: int = 0) -> date:
    today = date.today()
    return today.replace(year=today.year - years) - timedelta(days=days)


def test_thirteen_is_the_age_of_digital_consent():
    assert privacy.needs_guardian(_years_ago(12, 300))
    assert not privacy.needs_guardian(_years_ago(13))
    assert not privacy.needs_guardian(None)


def test_birth_dates_in_the_future_or_absurd_are_refused():
    for raw in ("", "x", (date.today() + timedelta(days=1)).isoformat(), "1900-01-01"):
        with pytest.raises(HTTPException):
            privacy.parse_birth_date(raw)
    assert privacy.parse_birth_date("2012-05-01") == date(2012, 5, 1)


def test_under_13_without_consent_stores_no_health_data():
    with pytest.raises(HTTPException) as ctx:
        privacy.require_health_consent(_session(), "u1", _years_ago(10))
    assert ctx.value.status_code == 403
    for status in ("pending", "withdrawn"):
        row = SimpleNamespace(birth_date=_years_ago(10), status=status)
        with pytest.raises(HTTPException):
            privacy.require_health_consent(_session(row), "u1", _years_ago(10))
    granted = SimpleNamespace(birth_date=_years_ago(10), status="granted")
    privacy.require_health_consent(_session(granted), "u1", _years_ago(10))
    privacy.require_health_consent(_session(), "u1", _years_ago(20))


def test_editing_the_profile_birth_date_does_not_lift_the_block():
    row = SimpleNamespace(birth_date=_years_ago(10), status="pending")
    assert privacy.consent_state(_session(row), "u1", _years_ago(30)) == "pending"


def test_turning_13_lifts_the_block():
    row = SimpleNamespace(birth_date=_years_ago(13), status="pending")
    assert privacy.consent_state(_session(row), "u1", None) == "not_required"


def test_guardian_link_is_signed_and_bound_to_the_latest_request():
    row = SimpleNamespace(user_id="11111111-1111-1111-1111-111111111111", nonce="n1", status="pending", birth_date=_years_ago(10))
    session = _session(row)
    token = privacy.guardian_token(row, datetime.now(timezone.utc) + timedelta(days=7))
    assert privacy._read_token(session, token) is row
    for bad in (token[:-2] + "xx", privacy.guardian_token(row, datetime.now(timezone.utc) - timedelta(seconds=5))):
        with pytest.raises(HTTPException):
            privacy._read_token(session, bad)
    row.nonce = "n2"  # a newer request was sent: older links stop working
    with pytest.raises(HTTPException):
        privacy._read_token(session, token)


def test_guardian_email_must_be_someone_else():
    user = SimpleNamespace(id="u1", email="atleta@example.test")
    for email in ("", "not-an-email", "Atleta@example.test"):
        with pytest.raises(HTTPException):
            privacy.request_consent(_session(), user, _years_ago(10), email)


def test_request_returns_a_link_outside_production():
    user = SimpleNamespace(id="u1", email="atleta@example.test")
    session = _session()
    link = privacy.request_consent(session, user, _years_ago(10), "mae@example.test")
    assert link and link.startswith("/responsavel/")
    row = session.add.call_args[0][0]
    assert (row.status, row.guardian_email) == ("pending", "mae@example.test")


def test_cron_needs_a_long_secret(monkeypatch):
    monkeypatch.setattr(privacy, "get_settings", lambda: SimpleNamespace(cron_secret="short"))
    assert not privacy.cron_allowed("short")
    secret = "k" * 40
    monkeypatch.setattr(privacy, "get_settings", lambda: SimpleNamespace(cron_secret=secret))
    assert privacy.cron_allowed(secret) and not privacy.cron_allowed("k" * 39) and not privacy.cron_allowed(None)
