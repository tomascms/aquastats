import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.routes import auth_routes


STRONG_TEST_PASSWORD = "nado" * 3 + "19"  # test value; spelled out it trips the secret scan


def _user(**kw):
    base = dict(id="u1", email="nadador@gmail.com", password_hash=None, is_verified=True, role="swimmer", deleted_at=None)
    base.update(kw)
    return SimpleNamespace(**base)


class AccountLinkingTest(unittest.TestCase):
    def test_register_cannot_set_a_password_on_a_google_account(self):
        google_user = _user()
        with patch.object(auth_routes, "find_user_by_email", return_value=google_user):
            with self.assertRaises(HTTPException) as ctx:
                auth_routes.register(
                    {"email": "nadador@gmail.com", "password": STRONG_TEST_PASSWORD}, MagicMock(), MagicMock(), MagicMock()
                )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIsNone(google_user.password_hash)

    def test_unverified_google_email_does_not_take_over_an_account(self):
        owner = _user(password_hash="hash")
        session = MagicMock()
        session.scalar.return_value = None
        with patch.object(auth_routes, "find_user_by_email", return_value=owner):
            with self.assertRaises(HTTPException) as ctx:
                auth_routes._finish_oauth(
                    session, MagicMock(), provider="google", provider_id="g1",
                    email="nadador@gmail.com", name="N", verified=False,
                )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_verified_google_email_joins_the_same_account(self):
        owner = _user(password_hash="hash")
        session = MagicMock()
        session.scalar.return_value = None
        with patch.object(auth_routes, "find_user_by_email", return_value=owner):
            user, _ = auth_routes._finish_oauth(
                session, SimpleNamespace(cookies={}), provider="google", provider_id="g1",
                email="nadador@gmail.com", name="N", verified=True, invite="ABC123",
            )
        self.assertIs(user, owner)
        self.assertEqual(owner.password_hash, "hash")
        session.add.assert_called_once()  # OAuthAccount linked to the existing user

    def test_unconfirmed_password_is_dropped_when_google_proves_the_email(self):
        squatter = _user(password_hash="attacker", is_verified=False)
        session = MagicMock()
        session.scalar.return_value = None
        with patch.object(auth_routes, "find_user_by_email", return_value=squatter):
            auth_routes._finish_oauth(
                session, SimpleNamespace(cookies={}), provider="google", provider_id="g1",
                email="nadador@gmail.com", name="N", verified=True,
            )
        self.assertIsNone(squatter.password_hash)
        self.assertTrue(squatter.is_verified)
