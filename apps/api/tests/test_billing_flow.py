import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_auth_session
from app.domain import billing
from app.main import app

SECRET = "whsec_test_secret"


@pytest.fixture
def client(monkeypatch):
    settings = SimpleNamespace(
        stripe_webhook_secret=SECRET,
        billing_enforced_from="2026-10-01",
        billing_enabled=False,
        stripe_secret_key="",
        stripe_price_coach_monthly="",
    )
    monkeypatch.setattr("app.routes.billing_routes.get_settings", lambda: settings)
    monkeypatch.setattr(billing, "get_settings", lambda: settings)
    app.dependency_overrides[get_auth_session] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


def _signed(payload: bytes, secret: str = SECRET) -> str:
    stamp = int(time.time())
    digest = hmac.new(secret.encode(), f"{stamp}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={stamp},v1={digest}"


def _event() -> bytes:
    return json.dumps(
        {"id": "evt_1", "object": "event", "type": "customer.subscription.updated", "data": {"object": {"id": "sub_1"}}}
    ).encode()


def test_webhook_rejects_bad_signature(client, monkeypatch):
    called = []
    monkeypatch.setattr(billing, "handle_event", lambda *args: called.append(args))
    payload = _event()
    response = client.post(
        "/api/v1/billing/webhook", content=payload, headers={"stripe-signature": _signed(payload, "whsec_wrong")}
    )
    assert response.status_code == 400
    assert not called


def test_webhook_accepts_valid_signature(client, monkeypatch):
    called = []
    monkeypatch.setattr(billing, "handle_event", lambda session, event, request: called.append(event["id"]))
    payload = _event()
    response = client.post("/api/v1/billing/webhook", content=payload, headers={"stripe-signature": _signed(payload)})
    assert response.status_code == 200
    assert called == ["evt_1"]


def test_webhook_skips_origin_checks(client, monkeypatch):
    monkeypatch.setattr(billing, "handle_event", lambda *args: None)
    payload = _event()
    response = client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"stripe-signature": _signed(payload), "origin": "https://evil.example"},
    )
    assert response.status_code == 200


def test_checkout_requires_consents(client, monkeypatch):
    user = SimpleNamespace(id=uuid4(), is_active=True, deleted_at=None, password_hash=None, is_verified=True, role="pending")
    monkeypatch.setattr("app.routes.billing_routes._session_user", lambda request, session: user)
    monkeypatch.setattr(billing, "create_checkout", lambda *args: "https://checkout.stripe.com/x")
    base = {"teamName": "Clube Teste"}
    origin = {"origin": "http://localhost:3000"}
    assert client.post("/api/v1/billing/checkout", json=base, headers=origin).status_code == 422
    assert client.post("/api/v1/billing/checkout", json={**base, "acceptTerms": True}, headers=origin).status_code == 422
    ok = client.post("/api/v1/billing/checkout", json={**base, "acceptTerms": True, "immediateStart": True}, headers=origin)
    assert ok.status_code == 200
    assert ok.json()["url"].startswith("https://checkout.stripe.com/")


class FakeSession:
    def __init__(self, org_created_at, subscription=None):
        self.org = SimpleNamespace(created_at=org_created_at)
        self.subscription = subscription

    def get(self, model, key):
        return self.org

    def scalar(self, query):
        return self.subscription


def test_existing_clubs_are_exempt(monkeypatch):
    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(billing_enforced_from="2026-10-01"))
    session = FakeSession(datetime(2026, 9, 1, tzinfo=timezone.utc))
    assert billing.org_has_access(session, uuid4())


def test_new_club_needs_active_subscription(monkeypatch):
    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(billing_enforced_from="2026-10-01"))
    created = datetime(2026, 10, 5, tzinfo=timezone.utc)
    assert not billing.org_has_access(FakeSession(created), uuid4())
    assert billing.org_has_access(FakeSession(created, SimpleNamespace(status="active")), uuid4())
    assert billing.org_has_access(FakeSession(created, SimpleNamespace(status="past_due")), uuid4())
    assert not billing.org_has_access(FakeSession(created, SimpleNamespace(status="canceled")), uuid4())
    assert not billing.org_has_access(FakeSession(created, SimpleNamespace(status="unpaid")), uuid4())


def test_no_enforcement_date_means_everyone_has_access(monkeypatch):
    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(billing_enforced_from=""))
    assert billing.org_has_access(FakeSession(datetime(2027, 1, 1, tzinfo=timezone.utc)), uuid4())
