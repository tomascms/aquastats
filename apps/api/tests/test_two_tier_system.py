"""Tests for two-tier system (Athlete/Coach) and OAuth consolidation."""
import pytest
from uuid import uuid4
from app.domain.user_models import UserType, AuthProvider
from app.core.i18n import I18n, get_translation, is_valid_language, get_supported_languages


class TestUserTypes:
    """Tests for user type enum."""

    def test_athlete_type(self):
        """Test athlete user type."""
        assert UserType.ATHLETE.value == "athlete"

    def test_coach_type(self):
        """Test coach user type."""
        assert UserType.COACH.value == "coach"

    def test_user_types_count(self):
        """Test there are exactly 2 user types."""
        types = list(UserType)
        assert len(types) == 2


class TestAuthProviders:
    """Tests for auth provider enum."""

    def test_email_provider(self):
        """Test email auth provider."""
        assert AuthProvider.EMAIL.value == "email"

    def test_google_provider(self):
        """Test Google auth provider."""
        assert AuthProvider.GOOGLE.value == "google"

    def test_apple_provider(self):
        """Test Apple auth provider."""
        assert AuthProvider.APPLE.value == "apple"

    def test_providers_count(self):
        """Test there are 3 auth providers."""
        providers = list(AuthProvider)
        assert len(providers) == 3


class TestInternationalization:
    """Tests for i18n system."""

    def test_supported_languages(self):
        """Test supported languages."""
        langs = get_supported_languages()
        assert "pt-PT" in langs
        assert "en" in langs
        assert len(langs) == 2

    def test_portuguese_translations_exist(self):
        """Test Portuguese translations exist."""
        translation = get_translation("pt-PT", "common.save")
        assert translation == "Guardar"

    def test_english_translations_exist(self):
        """Test English translations exist."""
        translation = get_translation("en", "common.save")
        assert translation == "Save"

    def test_language_validation(self):
        """Test language validation."""
        assert is_valid_language("pt-PT")
        assert is_valid_language("en")
        assert not is_valid_language("invalid")

    def test_translation_fallback(self):
        """Test fallback for missing language."""
        translation = get_translation("invalid_lang", "common.save")
        assert translation in ["Guardar", "common.save"]

    def test_translation_fallback_key(self):
        """Test fallback for missing key."""
        translation = get_translation("pt-PT", "invalid.key")
        assert translation == "invalid.key"

    def test_i18n_class_initialization(self):
        """Test I18n class initialization."""
        i18n = I18n("pt-PT")
        assert i18n.language == "pt-PT"

    def test_i18n_class_default_language(self):
        """Test I18n class defaults to Portuguese."""
        i18n = I18n("invalid")
        assert i18n.language == "pt-PT"

    def test_i18n_translation_method(self):
        """Test I18n translation method."""
        i18n = I18n("en")
        assert i18n.t("common.save") == "Save"

    def test_i18n_language_switch(self):
        """Test switching language in I18n."""
        i18n = I18n("pt-PT")
        assert i18n.t("common.save") == "Guardar"

        i18n.set_language("en")
        assert i18n.t("common.save") == "Save"

    def test_i18n_get_language(self):
        """Test getting current language."""
        i18n = I18n("en")
        assert i18n.get_language() == "en"

    def test_i18n_get_all_translations(self):
        """Test getting all translations for language."""
        i18n = I18n("pt-PT")
        translations = i18n.get_all_translations()

        assert isinstance(translations, dict)
        assert len(translations) > 0
        assert "common.save" in translations

    def test_auth_translations_portuguese(self):
        """Test auth-related translations in Portuguese."""
        i18n = I18n("pt-PT")

        assert i18n.t("auth.login") == "Entrar"
        assert i18n.t("auth.signup") == "Registar"
        assert i18n.t("auth.logout") == "Sair"
        assert i18n.t("auth.google") == "Entrar com Google"
        assert i18n.t("auth.apple") == "Entrar com Apple"

    def test_auth_translations_english(self):
        """Test auth-related translations in English."""
        i18n = I18n("en")

        assert i18n.t("auth.login") == "Sign In"
        assert i18n.t("auth.signup") == "Sign Up"
        assert i18n.t("auth.logout") == "Sign Out"
        assert i18n.t("auth.google") == "Sign In with Google"
        assert i18n.t("auth.apple") == "Sign In with Apple"

    def test_error_translations_portuguese(self):
        """Test error translations in Portuguese."""
        i18n = I18n("pt-PT")

        assert i18n.t("error.invalid_email") == "Email inválido"
        assert i18n.t("error.user_not_found") == "Utilizador não encontrado"

    def test_error_translations_english(self):
        """Test error translations in English."""
        i18n = I18n("en")

        assert i18n.t("error.invalid_email") == "Invalid email"
        assert i18n.t("error.user_not_found") == "User not found"

    def test_billing_translations_portuguese(self):
        """Test billing translations in Portuguese."""
        i18n = I18n("pt-PT")

        assert i18n.t("billing.free") == "Grátis"
        assert i18n.t("billing.starter") == "Iniciante"
        assert i18n.t("billing.professional") == "Profissional"
        assert i18n.t("billing.elite") == "Elite"

    def test_billing_translations_english(self):
        """Test billing translations in English."""
        i18n = I18n("en")

        assert i18n.t("billing.free") == "Free"
        assert i18n.t("billing.starter") == "Starter"
        assert i18n.t("billing.professional") == "Professional"
        assert i18n.t("billing.elite") == "Elite"

    def test_coverage_all_keys_translated(self):
        """Test that all keys exist in both languages."""
        from app.core.i18n import TRANSLATIONS

        pt_keys = set(TRANSLATIONS["pt-PT"].keys())
        en_keys = set(TRANSLATIONS["en"].keys())

        # Check all keys exist in both languages
        assert pt_keys == en_keys, f"Missing keys: {pt_keys ^ en_keys}"

    def test_translation_consistency(self):
        """Test translation consistency (same structure in both languages)."""
        from app.core.i18n import TRANSLATIONS

        pt_translations = TRANSLATIONS["pt-PT"]
        en_translations = TRANSLATIONS["en"]

        # Same number of keys
        assert len(pt_translations) == len(en_translations)

        # Same key prefixes
        pt_prefixes = {k.split(".")[0] for k in pt_translations.keys()}
        en_prefixes = {k.split(".")[0] for k in en_translations.keys()}
        assert pt_prefixes == en_prefixes
