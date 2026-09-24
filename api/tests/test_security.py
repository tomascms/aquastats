import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.core.passwords import clean_text, is_honeypot, valid_email, valid_password
from app.domain.identity import assert_role_signup_allowed, safe_app_path


class SecurityHelpersTest(unittest.TestCase):
    def test_password_rejects_short_and_common(self):
        self.assertFalse(valid_password("short"))
        self.assertFalse(valid_password("password123"))
        self.assertFalse(valid_password("abcdefghij"))
        self.assertTrue(valid_password("NadoForte19"))
        self.assertTrue(valid_password("treinadorok19"))

    def test_email(self):
        self.assertTrue(valid_email("treinador@clube.pt"))
        self.assertFalse(valid_email("sem-dominio"))

    def test_open_redirect(self):
        self.assertEqual(safe_app_path("//evil.com"), "/")
        self.assertEqual(safe_app_path("https://evil.com"), "/")
        self.assertEqual(safe_app_path("/coach"), "/coach")

    def test_honeypot_and_clean(self):
        self.assertTrue(is_honeypot({"sa_hp": "http://spam"}))
        self.assertFalse(is_honeypot({"sa_hp": ""}))
        self.assertFalse(is_honeypot({"website": "autofill"}))
        self.assertEqual(clean_text("  ola\x00  "), "ola")

    @patch("app.domain.identity.get_settings")
    def test_coach_signup_blocked_by_default(self, mock_settings):
        mock_settings.return_value.coach_signup_enabled = False
        with self.assertRaises(HTTPException) as ctx:
            assert_role_signup_allowed("coach")
        self.assertEqual(ctx.exception.status_code, 403)
        assert_role_signup_allowed("swimmer")

    @patch("app.domain.identity.get_settings")
    def test_coach_signup_allowed_when_enabled(self, mock_settings):
        mock_settings.return_value.coach_signup_enabled = True
        assert_role_signup_allowed("coach")


if __name__ == "__main__":
    unittest.main()
