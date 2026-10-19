"""Idempotency keys are scoped to the user, so one user's key never blocks another user's write."""
import unittest
from unittest.mock import MagicMock
from uuid import uuid4

from app.core.idempotency import run_idempotent


class IdempotencyScopeTest(unittest.TestCase):
    def test_same_key_from_two_users_is_two_rows(self):
        session = MagicMock()
        session.get.return_value = None
        alice, bob = uuid4(), uuid4()
        for user in (alice, bob):
            run_idempotent(session, user_id=user, operation="op", key="k1", body={}, producer=lambda: (200, {}))
        looked_up = [call.args[1]["key"] for call in session.get.call_args_list]
        self.assertEqual(looked_up, [f"{alice}:k1", f"{bob}:k1"])


if __name__ == "__main__":
    unittest.main()
