"""Unit tests for billing domain."""
import pytest
from app.domain.billing import Plan, PlanType, SubscriptionStatus


class TestPlanDefinitions:
    """Tests for subscription plan definitions."""

    def test_free_plan_exists(self):
        """Test Free plan defined."""
        plan = Plan.get_plan(PlanType.FREE)
        assert plan["name"] == "Free"
        assert plan["price_cents"] == 0
        assert plan["features"]["athletes"] == 2

    def test_starter_plan_exists(self):
        """Test Starter plan defined."""
        plan = Plan.get_plan(PlanType.STARTER)
        assert plan["name"] == "Starter"
        assert plan["price_cents"] == 900  # €9.00
        assert plan["features"]["athletes"] == 10
        assert plan["stripe_price_id"] is not None

    def test_professional_plan_exists(self):
        """Test Professional plan defined."""
        plan = Plan.get_plan(PlanType.PROFESSIONAL)
        assert plan["name"] == "Professional"
        assert plan["price_cents"] == 2900  # €29.00
        assert plan["features"]["athletes"] == 50
        assert plan["features"]["custom_branding"] is True
        assert plan["features"]["team_collaboration"] is True

    def test_elite_plan_exists(self):
        """Test Elite plan defined."""
        plan = Plan.get_plan(PlanType.ELITE)
        assert plan["name"] == "Elite"
        assert plan["price_cents"] == 9900  # €99.00
        assert plan["features"]["athletes"] == "unlimited"
        assert plan["features"]["sso"] is True
        assert plan["features"]["dedicated_account_manager"] is True

    def test_all_plans_have_features(self):
        """Test all plans have features defined."""
        for plan_type in PlanType:
            plan = Plan.get_plan(plan_type)
            assert "features" in plan
            assert len(plan["features"]) > 0

    def test_feature_access_free(self):
        """Test Free plan has basic features only."""
        assert Plan.get_feature(PlanType.FREE, "athletes") == 2
        assert Plan.get_feature(PlanType.FREE, "custom_branding") is None

    def test_feature_access_professional(self):
        """Test Professional plan has advanced features."""
        assert Plan.get_feature(PlanType.PROFESSIONAL, "athletes") == 50
        assert Plan.get_feature(PlanType.PROFESSIONAL, "custom_branding") is True
        assert Plan.get_feature(PlanType.PROFESSIONAL, "api_access") is True

    def test_has_feature_unlimited(self):
        """Test unlimited feature detection."""
        assert Plan.has_feature(PlanType.ELITE, "athletes") is True
        assert Plan.has_feature(PlanType.ELITE, "workouts_per_month") is True
        assert Plan.has_feature(PlanType.ELITE, "api_calls_per_day") is True

    def test_has_feature_limited(self):
        """Test limited feature detection."""
        assert Plan.has_feature(PlanType.STARTER, "athletes") is True
        assert Plan.has_feature(PlanType.STARTER, "custom_branding") is False

    def test_feature_not_in_free_plan(self):
        """Test advanced features not in Free plan."""
        assert Plan.has_feature(PlanType.FREE, "sso") is False
        assert Plan.has_feature(PlanType.FREE, "api_access") is False

    def test_pricing_progression(self):
        """Test pricing increases with tier."""
        free = Plan.get_plan(PlanType.FREE)["price_cents"]
        starter = Plan.get_plan(PlanType.STARTER)["price_cents"]
        professional = Plan.get_plan(PlanType.PROFESSIONAL)["price_cents"]
        elite = Plan.get_plan(PlanType.ELITE)["price_cents"]

        assert free < starter < professional < elite
        assert free == 0
        assert starter == 900
        assert professional == 2900
        assert elite == 9900

    def test_feature_limits_increase(self):
        """Test feature limits increase with tiers."""
        free_athletes = Plan.get_feature(PlanType.FREE, "athletes")
        starter_athletes = Plan.get_feature(PlanType.STARTER, "athletes")
        professional_athletes = Plan.get_feature(PlanType.PROFESSIONAL, "athletes")

        assert free_athletes < starter_athletes < professional_athletes


class TestSubscriptionStatus:
    """Tests for subscription status enum."""

    def test_valid_statuses(self):
        """Test all valid subscription statuses."""
        statuses = [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.CANCELED,
            SubscriptionStatus.PAUSED,
            SubscriptionStatus.EXPIRED,
        ]
        assert len(statuses) == 5

    def test_status_values(self):
        """Test status string values."""
        assert SubscriptionStatus.ACTIVE.value == "active"
        assert SubscriptionStatus.PAST_DUE.value == "past_due"
        assert SubscriptionStatus.CANCELED.value == "canceled"
        assert SubscriptionStatus.PAUSED.value == "paused"
        assert SubscriptionStatus.EXPIRED.value == "expired"

    def test_status_comparison(self):
        """Test status can be compared."""
        assert SubscriptionStatus.ACTIVE == SubscriptionStatus.ACTIVE
        assert SubscriptionStatus.ACTIVE != SubscriptionStatus.CANCELED


class TestPlanType:
    """Tests for plan type enum."""

    def test_valid_plan_types(self):
        """Test all valid plan types."""
        plan_types = list(PlanType)
        assert len(plan_types) == 4
        assert PlanType.FREE in plan_types
        assert PlanType.STARTER in plan_types
        assert PlanType.PROFESSIONAL in plan_types
        assert PlanType.ELITE in plan_types

    def test_plan_type_values(self):
        """Test plan type string values."""
        assert PlanType.FREE.value == "free"
        assert PlanType.STARTER.value == "starter"
        assert PlanType.PROFESSIONAL.value == "professional"
        assert PlanType.ELITE.value == "elite"

    def test_plan_type_from_string(self):
        """Test creating plan type from string."""
        assert PlanType("free") == PlanType.FREE
        assert PlanType("starter") == PlanType.STARTER
        assert PlanType("professional") == PlanType.PROFESSIONAL
        assert PlanType("elite") == PlanType.ELITE

    def test_invalid_plan_type(self):
        """Test invalid plan type raises error."""
        with pytest.raises(ValueError):
            PlanType("invalid")
