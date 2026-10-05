"""Pytest setup for the Aquastats API.

Tests never read the developer's apps/api/.env (it may hold production settings) and never touch a
database unless they bring their own (TEST_DATABASE_URL, used by the Postgres suites). Runs the same on
a laptop and in CI.
"""
import os

os.environ["AQUASTATS_ENV_FILE"] = ""
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "")
os.environ["SESSION_SECRET"] = "test-only-session-secret-not-a-real-one"
os.environ["DATABASE_ENABLE_RLS"] = "true"  # as in production: every request sets its RLS context
