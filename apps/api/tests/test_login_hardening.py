import unittest

from app.core.passwords import MIN_PASSWORD_LENGTH, valid_password
from app.domain.identity import LOGIN_FAILED


class LoginHardeningTest(unittest.TestCase):
    def test_new_passwords_need_twelve_characters_letters_and_digits(self):
        self.assertEqual(MIN_PASSWORD_LENGTH, 12)
        self.assertFalse(valid_password("NadoForte19"))  # 11
        self.assertTrue(valid_password("NadoForte190"))
        self.assertFalse(valid_password("apenasletrasaqui"))
        self.assertFalse(valid_password("123456789012345"))

    def test_common_passwords_are_refused_whatever_the_case(self):
        for value in ("Password1234", "PORTUGAL2026", "Natacao12345", "aquastats123"):
            self.assertFalse(valid_password(value), value)

    def test_one_message_for_every_failed_sign_in(self):
        self.assertNotIn("Google", LOGIN_FAILED)
        self.assertNotIn("bloqueada", LOGIN_FAILED)


class LoginLockTest(unittest.TestCase):
    def _fail(self, user, ip, times):
        from fastapi import HTTPException

        from app.domain.identity import lock_or_fail

        for _ in range(times):
            with self.assertRaises(HTTPException):
                lock_or_fail(user, ip)

    def test_lock_holds_only_for_the_address_that_failed(self):
        from types import SimpleNamespace

        from app.domain.identity import login_locked

        user = SimpleNamespace(failed_login_count=0, locked_until=None, settings={})
        self._fail(user, "198.51.100.1", 8)
        self.assertTrue(login_locked(user, "198.51.100.1"))
        # The owner, from another address, still signs in: knowing the email is not enough to lock them out.
        self.assertFalse(login_locked(user, "203.0.113.5"))

    def test_rotating_addresses_still_hits_an_account_wide_lock(self):
        from types import SimpleNamespace

        from app.domain.identity import login_locked

        user = SimpleNamespace(failed_login_count=0, locked_until=None, settings={})
        for n in range(5):
            self._fail(user, f"198.51.100.{n}", 8)
        self.assertTrue(login_locked(user, "203.0.113.5"))
