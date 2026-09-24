"""OAuth account consolidation - same email = same account."""
from uuid import UUID, uuid4
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
import structlog

from ..domain.models import User
from ..domain.user_models import UserProfile, AuthProvider
from .audit import audit_logger, AuditContext

logger = structlog.get_logger(__name__)


async def consolidate_user_account(
    session: Session,
    email: str,
    provider: str,
    provider_id: Optional[str] = None,
    user_data: Optional[Dict[str, Any]] = None,
    audit_context: Optional[AuditContext] = None,
) -> Dict[str, Any]:
    """
    Consolidate user account by email.

    Logic:
    1. Check if user exists by email
    2. If exists: add provider to auth_providers
    3. If not: create new user with provider

    This ensures same email = same account across Google, Apple, Email signup.

    Args:
        session: Database session
        email: User email
        provider: Auth provider (email, google, apple)
        provider_id: Provider-specific user ID (google_id, apple_id)
        user_data: Additional user data (name, picture, etc)
        audit_context: Audit context for logging

    Returns:
        Dict with user_id, is_new_user, providers_added
    """

    # 1. Find existing user by email
    existing_user = session.scalar(
        select(User).where(User.email == email.lower())
    )

    is_new_user = not existing_user
    providers_added = []

    if existing_user:
        # User exists - add provider if new
        user = existing_user

        if provider not in (user.auth_providers or []):
            # Add new provider
            providers = list(user.auth_providers or [])
            providers.append(provider)
            user.auth_providers = providers
            providers_added = [provider]

            # Store provider-specific ID
            if provider == 'google' and provider_id:
                user.google_id = provider_id
            elif provider == 'apple' and provider_id:
                user.apple_id = provider_id

            session.add(user)
            session.commit()

            logger.info(
                'oauth_provider_added',
                user_id=str(user.id),
                email=email,
                provider=provider
            )

            # Audit log
            if audit_context:
                audit_logger.log_action(
                    user_id=user.id,
                    action='LOGIN_PROVIDER_ADDED',
                    details={
                        'provider': provider,
                        'email': email,
                    },
                    context=audit_context
                )
        else:
            logger.debug(
                'oauth_provider_already_exists',
                user_id=str(user.id),
                provider=provider
            )
    else:
        # New user - create with provider
        user = User(
            id=uuid4(),
            email=email.lower(),
            name=user_data.get('name', email.split('@')[0]) if user_data else email.split('@')[0],
            password_hash=None,  # OAuth users don't have password
            auth_providers=[provider],
            user_type='athlete',  # Default to athlete
            google_id=provider_id if provider == 'google' else None,
            apple_id=provider_id if provider == 'apple' else None,
        )

        session.add(user)
        session.commit()

        # Create user profile
        profile = UserProfile(
            id=uuid4(),
            user_id=user.id,
            auth_providers=[provider],
            preferred_language='pt-PT',
        )

        if provider == 'google' and provider_id:
            profile.google_id = provider_id
        elif provider == 'apple' and provider_id:
            profile.apple_id = provider_id

        session.add(profile)
        session.commit()

        providers_added = [provider]

        logger.info(
            'oauth_user_created',
            user_id=str(user.id),
            email=email,
            provider=provider
        )

        # Audit log
        if audit_context:
            audit_logger.log_action(
                user_id=user.id,
                action='SIGNUP',
                details={
                    'provider': provider,
                    'email': email,
                    'method': 'oauth',
                },
                context=audit_context
            )

    return {
        'user_id': str(user.id),
        'email': email,
        'is_new_user': is_new_user,
        'providers_added': providers_added,
        'auth_providers': user.auth_providers or [],
    }


async def link_provider_to_user(
    session: Session,
    user_id: UUID,
    provider: str,
    provider_id: str,
) -> bool:
    """
    Link OAuth provider to existing user account.

    Used when user is already logged in and wants to add another provider.
    """

    user = session.scalar(select(User).where(User.id == user_id))

    if not user:
        logger.warning('user_not_found_for_provider_link', user_id=str(user_id))
        return False

    # Add provider to list
    providers = list(user.auth_providers or [])
    if provider not in providers:
        providers.append(provider)
        user.auth_providers = providers

    # Store provider-specific ID
    if provider == 'google':
        user.google_id = provider_id
    elif provider == 'apple':
        user.apple_id = provider_id

    session.add(user)
    session.commit()

    logger.info(
        'provider_linked_to_user',
        user_id=str(user_id),
        provider=provider
    )

    return True


async def unlink_provider_from_user(
    session: Session,
    user_id: UUID,
    provider: str,
) -> bool:
    """
    Unlink OAuth provider from user account.

    Prevent: User must have at least one provider/password method.
    """

    user = session.scalar(select(User).where(User.id == user_id))

    if not user:
        logger.warning('user_not_found_for_provider_unlink', user_id=str(user_id))
        return False

    providers = list(user.auth_providers or [])

    # Don't remove if it's the only auth method
    if len(providers) <= 1 and not user.password_hash:
        logger.warning(
            'cannot_unlink_only_provider',
            user_id=str(user_id),
            provider=provider
        )
        return False

    # Remove provider
    if provider in providers:
        providers.remove(provider)
        user.auth_providers = providers

    # Clear provider-specific ID
    if provider == 'google':
        user.google_id = None
    elif provider == 'apple':
        user.apple_id = None

    session.add(user)
    session.commit()

    logger.info(
        'provider_unlinked_from_user',
        user_id=str(user_id),
        provider=provider
    )

    return True


async def get_user_auth_methods(
    session: Session,
    user_id: UUID,
) -> Dict[str, bool]:
    """Get list of auth methods available for user."""

    user = session.scalar(select(User).where(User.id == user_id))

    if not user:
        return {}

    methods = {}

    # Check providers
    providers = user.auth_providers or []
    methods['email'] = 'email' in providers
    methods['google'] = 'google' in providers
    methods['apple'] = 'apple' in providers

    # Check password
    methods['password'] = bool(user.password_hash)

    return methods


async def merge_duplicate_accounts(
    session: Session,
    primary_user_id: UUID,
    secondary_user_id: UUID,
) -> bool:
    """
    Merge secondary user into primary user.

    Used when we detect duplicate accounts (same email, different providers).

    WARNING: This is destructive - reassigns all data to primary user.
    """

    primary = session.scalar(select(User).where(User.id == primary_user_id))
    secondary = session.scalar(select(User).where(User.id == secondary_user_id))

    if not primary or not secondary:
        logger.error('users_not_found_for_merge', primary_id=str(primary_user_id))
        return False

    # Merge providers
    primary_providers = list(primary.auth_providers or [])
    secondary_providers = list(secondary.auth_providers or [])

    for provider in secondary_providers:
        if provider not in primary_providers:
            primary_providers.append(provider)

    primary.auth_providers = primary_providers

    # Merge provider IDs
    if secondary.google_id and not primary.google_id:
        primary.google_id = secondary.google_id

    if secondary.apple_id and not primary.apple_id:
        primary.apple_id = secondary.apple_id

    # TODO: Reassign all data from secondary to primary:
    # - Workouts
    # - Times
    # - Teams
    # - Subscriptions
    # etc...

    session.add(primary)

    # Delete secondary account
    session.delete(secondary)
    session.commit()

    logger.info(
        'accounts_merged',
        primary_user_id=str(primary_user_id),
        secondary_user_id=str(secondary_user_id)
    )

    return True
