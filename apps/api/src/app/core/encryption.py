"""Fernet encryption for OAuth tokens and sensitive data."""
from cryptography.fernet import Fernet, InvalidToken
from typing import Optional
import os
from functools import lru_cache


class TokenEncryption:
    """Encrypt and decrypt OAuth tokens using Fernet (AES-128-CBC)."""

    def __init__(self, key: Optional[str] = None):
        """
        Initialize with encryption key.

        Args:
            key: Base64-encoded Fernet key. If None, uses ENCRYPTION_KEY env var.
        """
        if not key:
            key = os.getenv('ENCRYPTION_KEY')

        if not key:
            raise ValueError('ENCRYPTION_KEY environment variable not set')

        self.cipher_suite = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext token.

        Args:
            plaintext: Token string to encrypt

        Returns:
            Base64-encoded encrypted token
        """
        if not plaintext:
            raise ValueError('Cannot encrypt empty string')

        encrypted = self.cipher_suite.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, encrypted_token: str) -> Optional[str]:
        """
        Decrypt encrypted token.

        Args:
            encrypted_token: Base64-encoded encrypted token

        Returns:
            Decrypted plaintext token, or None if decryption fails
        """
        if not encrypted_token:
            return None

        try:
            decrypted = self.cipher_suite.decrypt(encrypted_token.encode())
            return decrypted.decode()
        except InvalidToken:
            return None
        except Exception:
            return None

    @staticmethod
    def generate_key() -> str:
        """
        Generate a new Fernet encryption key.

        Returns:
            Base64-encoded key ready for environment variable
        """
        key = Fernet.generate_key()
        return key.decode()


@lru_cache(maxsize=1)
def get_encryption_service() -> TokenEncryption:
    """Lazy-load encryption service (singleton)."""
    return TokenEncryption()


class OAuthTokenEncryption:
    """Specialized encryption for OAuth tokens stored in database."""

    def __init__(self):
        self.encryptor = get_encryption_service()

    def encrypt_oauth_token(self, provider: str, token: str, expires_at: int) -> dict:
        """
        Encrypt OAuth token for storage.

        Args:
            provider: OAuth provider (google, facebook, etc)
            token: Access token
            expires_at: Unix timestamp when token expires

        Returns:
            {
                "encrypted_token": "...",
                "provider": "google",
                "expires_at": 1234567890
            }
        """
        return {
            'encrypted_token': self.encryptor.encrypt(token),
            'provider': provider,
            'expires_at': expires_at,
        }

    def decrypt_oauth_token(self, stored_data: dict) -> Optional[str]:
        """
        Decrypt stored OAuth token.

        Args:
            stored_data: Dictionary from database with encrypted_token

        Returns:
            Decrypted token or None if invalid
        """
        if not stored_data or 'encrypted_token' not in stored_data:
            return None

        return self.encryptor.decrypt(stored_data['encrypted_token'])


# Example usage in database models
example_usage = """
# In api/src/app/domain/models.py

class OAuthAccount(Base):
    __tablename__ = 'oauth_accounts'

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'))
    provider: Mapped[str] = mapped_column(Text)
    provider_account_id: Mapped[str] = mapped_column(Text)
    encrypted_token: Mapped[str] = mapped_column(Text)  # Encrypted access token
    token_expires_at: Mapped[int] = mapped_column(Integer)  # Unix timestamp
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    def decrypt_token(self) -> Optional[str]:
        encryptor = OAuthTokenEncryption()
        return encryptor.encryptor.decrypt(self.encrypted_token)

# Usage in routes
@router.post("/api/v1/auth/google/callback")
async def handle_google_callback(code: str):
    # Get token from Google
    token_response = await get_google_token(code)

    # Encrypt before storing
    encryption = OAuthTokenEncryption()
    encrypted = encryption.encrypt_oauth_token(
        provider='google',
        token=token_response['access_token'],
        expires_at=token_response['expires_at']
    )

    # Store encrypted in database
    oauth_account = OAuthAccount(
        user_id=user.id,
        provider='google',
        encrypted_token=encrypted['encrypted_token'],
        token_expires_at=encrypted['expires_at']
    )
    session.add(oauth_account)
    await session.commit()
"""
