"""Internationalization (i18n) support for Aquastats."""
from typing import Dict, Optional
import json

# Supported languages
LANGUAGES = {
    'pt-PT': 'Português (Portugal)',
    'en': 'English',
}

# Translations dictionary
TRANSLATIONS: Dict[str, Dict[str, str]] = {
    'pt-PT': {
        # Common
        'common.save': 'Guardar',
        'common.cancel': 'Cancelar',
        'common.delete': 'Eliminar',
        'common.edit': 'Editar',
        'common.loading': 'Carregando...',
        'common.error': 'Erro',
        'common.success': 'Sucesso',
        'common.warning': 'Aviso',
        'common.info': 'Informação',
        'common.offline': 'Offline',
        'common.online': 'Online',
        'common.sync': 'Sincronizar',
        'common.export': 'Exportar',
        'common.import': 'Importar',

        # Auth
        'auth.login': 'Entrar',
        'auth.signup': 'Registar',
        'auth.logout': 'Sair',
        'auth.email': 'Email',
        'auth.password': 'Palavra-passe',
        'auth.name': 'Nome',
        'auth.google': 'Entrar com Google',
        'auth.apple': 'Entrar com Apple',
        'auth.forgot_password': 'Esqueceu a palavra-passe?',
        'auth.remember_me': 'Lembrar-me',
        'auth.already_have_account': 'Já tem conta?',
        'auth.dont_have_account': 'Não tem conta?',
        'auth.athlete': 'Sou atleta',
        'auth.coach': 'Sou treinador',

        # Dashboard
        'dashboard.title': 'Painel de Controlo',
        'dashboard.welcome': 'Bem-vindo',
        'dashboard.stats': 'Estatísticas',
        'dashboard.overview': 'Visão Geral',
        'dashboard.volume': 'Volume',
        'dashboard.compliance': 'Conformidade',
        'dashboard.tss': 'TSS',
        'dashboard.duration': 'Duração',

        # Teams & Athletes
        'team.create': 'Criar Equipa',
        'team.manage': 'Gerir Equipa',
        'team.members': 'Membros da Equipa',
        'athlete.add': 'Adicionar Atleta',
        'athlete.manage': 'Gerir Atleta',
        'athlete.workouts': 'Treinos do Atleta',
        'athlete.times': 'Tempos do Atleta',

        # Workouts
        'workout.create': 'Criar Treino',
        'workout.edit': 'Editar Treino',
        'workout.delete': 'Eliminar Treino',
        'workout.name': 'Nome do Treino',
        'workout.description': 'Descrição',
        'workout.date': 'Data',
        'workout.duration': 'Duração',
        'workout.distance': 'Distância',
        'workout.zone': 'Zona',

        # Times
        'time.record': 'Registar Tempo',
        'time.log': 'Registo de Tempos',
        'time.stroke': 'Estilo',
        'time.distance': 'Distância',
        'time.time': 'Tempo',


        # Errors
        'error.invalid_email': 'Email inválido',
        'error.password_required': 'Palavra-passe obrigatória',
        'error.password_short': 'Palavra-passe deve ter pelo menos 12 caracteres',
        'error.password_mismatch': 'Palavras-passe não coincidem',
        'error.email_taken': 'Este email já está em uso',
        'error.user_not_found': 'Utilizador não encontrado',
        'error.invalid_credentials': 'Email ou palavra-passe inválidos',
        'error.unauthorized': 'Não autorizado',
        'error.server_error': 'Erro no servidor. Tente novamente mais tarde.',
        'error.network_error': 'Erro de conexão',

        # Validation
        'validation.required': 'Este campo é obrigatório',
        'validation.invalid_format': 'Formato inválido',
        'validation.too_short': 'Muito curto',
        'validation.too_long': 'Muito longo',
        'validation.invalid_date': 'Data inválida',
    },
    'en': {
        # Common
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.warning': 'Warning',
        'common.info': 'Information',
        'common.offline': 'Offline',
        'common.online': 'Online',
        'common.sync': 'Sync',
        'common.export': 'Export',
        'common.import': 'Import',

        # Auth
        'auth.login': 'Sign In',
        'auth.signup': 'Sign Up',
        'auth.logout': 'Sign Out',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.name': 'Name',
        'auth.google': 'Sign In with Google',
        'auth.apple': 'Sign In with Apple',
        'auth.forgot_password': 'Forgot password?',
        'auth.remember_me': 'Remember me',
        'auth.already_have_account': 'Already have an account?',
        'auth.dont_have_account': "Don't have an account?",
        'auth.athlete': 'I\'m an athlete',
        'auth.coach': 'I\'m a coach',

        # Dashboard
        'dashboard.title': 'Dashboard',
        'dashboard.welcome': 'Welcome',
        'dashboard.stats': 'Statistics',
        'dashboard.overview': 'Overview',
        'dashboard.volume': 'Volume',
        'dashboard.compliance': 'Compliance',
        'dashboard.tss': 'TSS',
        'dashboard.duration': 'Duration',

        # Teams & Athletes
        'team.create': 'Create Team',
        'team.manage': 'Manage Team',
        'team.members': 'Team Members',
        'athlete.add': 'Add Athlete',
        'athlete.manage': 'Manage Athlete',
        'athlete.workouts': 'Athlete Workouts',
        'athlete.times': 'Athlete Times',

        # Workouts
        'workout.create': 'Create Workout',
        'workout.edit': 'Edit Workout',
        'workout.delete': 'Delete Workout',
        'workout.name': 'Workout Name',
        'workout.description': 'Description',
        'workout.date': 'Date',
        'workout.duration': 'Duration',
        'workout.distance': 'Distance',
        'workout.zone': 'Zone',

        # Times
        'time.record': 'Record Time',
        'time.log': 'Time Log',
        'time.stroke': 'Stroke',
        'time.distance': 'Distance',
        'time.time': 'Time',


        # Errors
        'error.invalid_email': 'Invalid email',
        'error.password_required': 'Password is required',
        'error.password_short': 'Password must be at least 12 characters',
        'error.password_mismatch': 'Passwords do not match',
        'error.email_taken': 'This email is already in use',
        'error.user_not_found': 'User not found',
        'error.invalid_credentials': 'Invalid email or password',
        'error.unauthorized': 'Unauthorized',
        'error.server_error': 'Server error. Please try again later.',
        'error.network_error': 'Network error',

        # Validation
        'validation.required': 'This field is required',
        'validation.invalid_format': 'Invalid format',
        'validation.too_short': 'Too short',
        'validation.too_long': 'Too long',
        'validation.invalid_date': 'Invalid date',
    },
}


def get_translation(language: str, key: str, default: Optional[str] = None) -> str:
    """Get translation for key in language."""
    if language not in TRANSLATIONS:
        language = 'pt-PT'  # Fallback to Portuguese

    translations = TRANSLATIONS[language]
    return translations.get(key, default or key)


def get_language_name(language: str) -> str:
    """Get display name for language."""
    return LANGUAGES.get(language, 'Unknown')


def is_valid_language(language: str) -> bool:
    """Check if language is supported."""
    return language in LANGUAGES


def get_supported_languages() -> Dict[str, str]:
    """Get all supported languages."""
    return LANGUAGES.copy()


# Translation helper class
class I18n:
    """Internationalization helper."""

    def __init__(self, language: str = 'pt-PT'):
        if not is_valid_language(language):
            language = 'pt-PT'
        self.language = language

    def t(self, key: str, default: Optional[str] = None) -> str:
        """Translate key."""
        return get_translation(self.language, key, default)

    def set_language(self, language: str) -> None:
        """Set language."""
        if is_valid_language(language):
            self.language = language
        else:
            self.language = 'pt-PT'

    def get_language(self) -> str:
        """Get current language."""
        return self.language

    def get_all_translations(self) -> Dict[str, str]:
        """Get all translations for current language."""
        if self.language not in TRANSLATIONS:
            return TRANSLATIONS['pt-PT']
        return TRANSLATIONS[self.language].copy()
