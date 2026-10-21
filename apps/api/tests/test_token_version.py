import unittest
from types import SimpleNamespace

from app.core.sessions import read_access, sign_access, token_is_current


class TokenVersionTest(unittest.TestCase):
    def test_token_matches_only_the_current_version(self):
        payload = read_access(sign_access("u", "coach", "t", "o", version=3))
        self.assertTrue(token_is_current(payload, SimpleNamespace(token_version=3)))
        self.assertFalse(token_is_current(payload, SimpleNamespace(token_version=4)))

    def test_tokens_signed_before_the_migration_count_as_version_zero(self):
        legacy = read_access(sign_access("u", "coach", "t", "o"))
        legacy.pop("tv")
        self.assertTrue(token_is_current(legacy, SimpleNamespace(token_version=0)))
        self.assertFalse(token_is_current(legacy, SimpleNamespace(token_version=1)))


if __name__ == "__main__":
    unittest.main()
