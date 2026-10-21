import unittest
from unittest import mock

from app.core.config import Settings
from app.core import startup
from app.core.startup import validate_settings, verify_database_role

PRODUCTION_DB = "postgresql+psycopg://someone@ep-rough-unit-b1cgm5pl-pooler.c-5.eu-central-1.aws.neon.tech/neondb"
STAGING_DB = "postgresql+psycopg://someone@ep-long-feather-b12ho9cq-pooler.c-5.eu-central-1.aws.neon.tech/neondb"
LOCAL_DB = "postgresql+psycopg://postgres@127.0.0.1:5544/aquastats"


def settings(**values) -> Settings:
    # _env_file=None: the developer's apps/api/.env must not decide the outcome of a test.
    return Settings(_env_file=None, **values)


class StartupGuardTest(unittest.TestCase):
    def test_production_database_is_recognised_pooled_or_direct(self):
        self.assertTrue(settings(database_url=PRODUCTION_DB).database_is_production)
        self.assertTrue(settings(database_url=PRODUCTION_DB.replace("-pooler", "")).database_is_production)
        self.assertFalse(settings(database_url=STAGING_DB).database_is_production)
        self.assertFalse(settings(database_url=LOCAL_DB).database_is_production)
        self.assertFalse(settings(database_url="").database_is_production)

    def test_local_run_against_production_database_refuses_to_start(self):
        for env in ("development", "staging", "test"):
            with self.assertRaises(RuntimeError) as ctx:
                validate_settings(settings(app_env=env, database_url=PRODUCTION_DB))
            self.assertIn("produção", str(ctx.exception))

    def test_local_run_against_local_or_staging_database_starts(self):
        validate_settings(settings(app_env="development", database_url=LOCAL_DB))
        validate_settings(settings(app_env="development", database_url=STAGING_DB))


class RoleCheckRetryTest(unittest.TestCase):
    """#10: the role guard fails closed in production when the database cannot answer."""

    def _run(self, outcomes, env="production"):
        calls = iter(outcomes)

        def check(*_args):
            value = next(calls)
            if isinstance(value, Exception):
                raise value
            return value

        with mock.patch.object(startup, "_check", side_effect=check), mock.patch.object(startup.time, "sleep") as sleep:
            verify_database_role(object(), settings(app_env=env))
        return sleep

    def test_production_retries_then_starts_when_the_database_answers(self):
        sleep = self._run([OSError("blip"), False, False])
        self.assertEqual(sleep.call_count, 1)

    def test_production_refuses_to_start_when_the_database_never_answers(self):
        with self.assertLogs("aquastats.startup", "ERROR"), self.assertRaises(RuntimeError) as ctx:
            self._run([OSError("down")] * 3)
        self.assertIn("RLS", str(ctx.exception))

    def test_bypassrls_role_still_refuses_after_a_retry(self):
        with self.assertRaises(RuntimeError):
            self._run([OSError("blip"), True, False])

    def test_development_does_not_query_the_database(self):
        sleep = self._run([], env="development")
        sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
