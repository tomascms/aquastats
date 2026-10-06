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
