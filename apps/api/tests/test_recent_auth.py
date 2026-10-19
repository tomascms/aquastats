"""Only a token minted at login proves recent authentication; /auth/refresh must not renew that proof."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.core.sessions import read_access, sign_access

SETTINGS = SimpleNamespace(session_secret="s" * 32, access_ttl_seconds=900)


@patch("app.core.sessions.get_settings", return_value=SETTINGS)
class RecentAuthTest(unittest.TestCase):
    def test_login_token_carries_auth_time(self, _):
        payload = read_access(sign_access("u", "coach", "t", "o", fresh=True))
        self.assertEqual(payload["auth_time"], payload["iat"])

    def test_refreshed_token_has_no_auth_time(self, _):
        self.assertNotIn("auth_time", read_access(sign_access("u", "coach", "t", "o")))


if __name__ == "__main__":
    unittest.main()
