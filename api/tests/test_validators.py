"""Unit tests for validators."""
import pytest
from app.core.validators import (
    SwimTimeValidator,
    PhoneValidator,
    SanitizedStr,
    EmailDomainValidator,
    NameValidator,
    DistanceValidator,
    StrokeValidator,
    DateOfBirthValidator,
)


class TestSwimTimeValidator:
    """Tests for swim time validation."""

    def test_valid_time(self):
        """Test valid time format."""
        result = SwimTimeValidator.validate("01'23\"45")
        assert result == (1, 23, 45)

    def test_valid_time_zero(self):
        """Test zero values."""
        result = SwimTimeValidator.validate("00'00\"00")
        assert result == (0, 0, 0)

    def test_valid_time_max(self):
        """Test maximum values."""
        result = SwimTimeValidator.validate("59'59\"99")
        assert result == (59, 59, 99)

    def test_invalid_minutes_60(self):
        """Test minutes > 59."""
        with pytest.raises(ValueError):
            SwimTimeValidator.validate("60'00\"00")

    def test_invalid_seconds_60(self):
        """Test seconds > 59."""
        with pytest.raises(ValueError):
            SwimTimeValidator.validate("01'60\"00")

    def test_invalid_centiseconds_100(self):
        """Test centiseconds > 99."""
        with pytest.raises(ValueError):
            SwimTimeValidator.validate("01'23\"100")

    def test_invalid_format(self):
        """Test invalid format."""
        with pytest.raises(ValueError):
            SwimTimeValidator.validate("1:23:45")

    def test_invalid_negative(self):
        """Test negative values."""
        with pytest.raises(ValueError):
            SwimTimeValidator.validate("-01'23\"45")


class TestEmailDomainValidator:
    """Tests for email domain validation."""

    def test_valid_email(self):
        """Test valid email."""
        result = EmailDomainValidator.validate("user@example.com")
        assert result == "user@example.com"

    def test_valid_email_business(self):
        """Test valid business email."""
        result = EmailDomainValidator.validate("coach@aquastats.net")
        assert result == "coach@aquastats.net"

    def test_blocks_tempmail(self):
        """Test tempmail domain blocked."""
        with pytest.raises(ValueError):
            EmailDomainValidator.validate("user@tempmail.com")

    def test_blocks_guerrillamail(self):
        """Test guerrillamail domain blocked."""
        with pytest.raises(ValueError):
            EmailDomainValidator.validate("user@guerrillamail.com")

    def test_blocks_10minutemail(self):
        """Test 10minutemail domain blocked."""
        with pytest.raises(ValueError):
            EmailDomainValidator.validate("user@10minutemail.com")

    def test_case_insensitive(self):
        """Test case insensitivity."""
        result = EmailDomainValidator.validate("user@EXAMPLE.COM")
        assert result.lower() == "user@example.com"


class TestSanitizedStr:
    """Tests for HTML sanitization."""

    def test_removes_script_tags(self):
        """Test script tags removed."""
        result = SanitizedStr.validate("<script>alert('xss')</script>test")
        assert "<script>" not in result
        assert "alert" not in result
        assert "test" in result

    def test_removes_onclick(self):
        """Test onclick attributes removed."""
        result = SanitizedStr.validate("<img onclick=\"alert('xss')\" />")
        assert "onclick" not in result

    def test_keeps_safe_html(self):
        """Test safe HTML preserved."""
        result = SanitizedStr.validate("<b>bold</b> <i>italic</i>")
        assert "bold" in result
        assert "italic" in result

    def test_removes_style_tags(self):
        """Test style tags removed."""
        result = SanitizedStr.validate("<style>body{display:none}</style>content")
        assert "<style>" not in result
        assert "content" in result


class TestDistanceValidator:
    """Tests for swimming distance validation."""

    def test_valid_distances(self):
        """Test all valid distances."""
        valid = [25, 50, 100, 200, 400, 800, 1500, 3000, 5000, 10000]
        for distance in valid:
            assert DistanceValidator.validate(distance) == distance

    def test_invalid_distance_49(self):
        """Test invalid distance 49m."""
        with pytest.raises(ValueError):
            DistanceValidator.validate(49)

    def test_invalid_distance_75(self):
        """Test invalid distance 75m."""
        with pytest.raises(ValueError):
            DistanceValidator.validate(75)

    def test_invalid_distance_negative(self):
        """Test negative distance."""
        with pytest.raises(ValueError):
            DistanceValidator.validate(-100)

    def test_invalid_distance_zero(self):
        """Test zero distance."""
        with pytest.raises(ValueError):
            DistanceValidator.validate(0)


class TestStrokeValidator:
    """Tests for swim stroke validation."""

    def test_valid_strokes(self):
        """Test all valid strokes."""
        valid = ["free", "back", "breast", "fly", "im"]
        for stroke in valid:
            assert StrokeValidator.validate(stroke) == stroke

    def test_case_insensitive(self):
        """Test case insensitivity."""
        assert StrokeValidator.validate("FREE") == "free"
        assert StrokeValidator.validate("Freestyle") == "free"

    def test_invalid_stroke_butterfly(self):
        """Test invalid stroke 'butterfly'."""
        with pytest.raises(ValueError):
            StrokeValidator.validate("butterfly")

    def test_invalid_stroke_other(self):
        """Test invalid stroke 'other'."""
        with pytest.raises(ValueError):
            StrokeValidator.validate("other")


class TestNameValidator:
    """Tests for name validation."""

    def test_valid_names(self):
        """Test valid names."""
        valid = ["João Silva", "Mary Jane", "José da Silva", "Anne-Marie"]
        for name in valid:
            assert NameValidator.validate(name) == name

    def test_valid_single_name(self):
        """Test single name."""
        result = NameValidator.validate("Madonna")
        assert result == "Madonna"

    def test_blocks_numbers(self):
        """Test numbers blocked."""
        with pytest.raises(ValueError):
            NameValidator.validate("User123")

    def test_blocks_special_chars(self):
        """Test special characters blocked."""
        with pytest.raises(ValueError):
            NameValidator.validate("User@Domain")

    def test_blocks_empty(self):
        """Test empty name blocked."""
        with pytest.raises(ValueError):
            NameValidator.validate("")

    def test_blocks_too_short(self):
        """Test name too short."""
        with pytest.raises(ValueError):
            NameValidator.validate("A")

    def test_blocks_too_long(self):
        """Test name too long (>100 chars)."""
        with pytest.raises(ValueError):
            NameValidator.validate("A" * 101)


class TestDateOfBirthValidator:
    """Tests for date of birth validation."""

    def test_valid_dob(self):
        """Test valid DOB."""
        result = DateOfBirthValidator.validate("2000-01-01")
        assert "2000-01-01" in str(result)

    def test_valid_recent_dob(self):
        """Test recent DOB (16 years old)."""
        # Date ~16 years ago
        result = DateOfBirthValidator.validate("2008-01-01")
        assert result is not None

    def test_blocks_too_young(self):
        """Test age < 8 years blocked."""
        # Date ~7 years ago
        with pytest.raises(ValueError):
            DateOfBirthValidator.validate("2019-01-01")

    def test_blocks_too_old(self):
        """Test age > 120 years blocked."""
        # Date >120 years ago
        with pytest.raises(ValueError):
            DateOfBirthValidator.validate("1900-01-01")

    def test_invalid_format(self):
        """Test invalid date format."""
        with pytest.raises(ValueError):
            DateOfBirthValidator.validate("01/01/2000")

    def test_invalid_date(self):
        """Test invalid date (Feb 30)."""
        with pytest.raises(ValueError):
            DateOfBirthValidator.validate("2000-02-30")
