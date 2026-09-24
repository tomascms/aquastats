-- Migration 003: Grants + timeouts for aquastats_app (skipped until role exists)
-- Create role in Neon: CREATE ROLE aquastats_app LOGIN PASSWORD '...';
-- Then set DATABASE_URL to aquastats_app and DATABASE_ENABLE_RLS=true on Cloud Run.

DO $$
DECLARE
  db text := current_database();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aquastats_app') THEN
    RAISE NOTICE 'aquastats_app role missing — create in Neon, migrations will apply grants on next deploy.';
    RETURN;
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aquastats_app', db);
  GRANT USAGE ON SCHEMA public TO aquastats_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aquastats_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aquastats_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aquastats_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO aquastats_app;
  REVOKE CREATE ON SCHEMA public FROM aquastats_app;

  ALTER ROLE aquastats_app SET statement_timeout = '30s';
  ALTER ROLE aquastats_app SET idle_in_transaction_session_timeout = '60s';
  ALTER ROLE aquastats_app SET lock_timeout = '10s';
END$$;
