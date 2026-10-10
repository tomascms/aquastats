import unittest

from app.core.config import Settings
from app.core.startup import validate_settings

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


if __name__ == "__main__":
    unittest.main()
