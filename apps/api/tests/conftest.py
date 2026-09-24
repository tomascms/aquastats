"""Pytest configuration and fixtures for Aquastats API tests."""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from typing import Generator

# Use in-memory SQLite for tests (fast, no external DB needed)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture
def test_engine():
    """Create test database engine."""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Import models to create tables
    from app.domain.models import Base as ModelsBase
    from app.domain.billing import Base as BillingBase

    ModelsBase.metadata.create_all(bind=engine)
    BillingBase.metadata.create_all(bind=engine)

    yield engine

    engine.dispose()


@pytest.fixture
def test_session(test_engine):
    """Create test database session."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()

    yield session

    session.close()


@pytest.fixture
def test_settings():
    """Create test settings."""
    from app.core.config import Settings

    return Settings(
        app_env="test",
        app_url="http://localhost:3000",
        api_url="http://localhost:8000",
        database_url=SQLALCHEMY_DATABASE_URL,
        session_secret="test-secret-key-" * 3,
        redis_url="redis://localhost:6379/1",  # Use DB 1 for tests
        stripe_publishable_key="pk_test_mock",
        stripe_secret_key="sk_test_mock",
        stripe_webhook_secret="whsec_test_mock",
    )


@pytest.fixture
def test_user_data():
    """Sample user data for tests."""
    return {
        "email": "test@example.com",
        "name": "Test User",
        "password": "SecurePassword123!",
    }


@pytest.fixture
def test_coach_data():
    """Sample coach data for tests."""
    return {
        "email": "coach@example.com",
        "name": "Coach Name",
        "password": "CoachPass123!",
        "team_name": "Test Team",
    }


@pytest.fixture
def test_athlete_data():
    """Sample athlete data for tests."""
    return {
        "name": "João Silva",
        "date_of_birth": "2005-05-15",
        "stroke": "free",
    }


@pytest.fixture
def test_time_log_data():
    """Sample time log data for tests."""
    return {
        "distance_m": 100,
        "stroke": "free",
        "mm": 1,
        "ss": 5,
        "cc": 42,
        "date": "2024-01-15",
    }


@pytest.fixture
def test_stripe_payment_data():
    """Sample Stripe payment data for tests."""
    return {
        "customer_id": "cus_test123",
        "price_id": "price_starter_eur",
        "success_url": "https://app.test/success",
        "cancel_url": "https://app.test/cancel",
    }


# Markers for test categorization
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests (fast)")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "security: Security tests")
    config.addinivalue_line("markers", "performance: Performance tests")
    config.addinivalue_line("markers", "workflow: Workflow/E2E tests")
    config.addinivalue_line("markers", "slow: Slow tests")
    config.addinivalue_line("markers", "asyncio: Async tests")
