"""Audit logging service for compliance and security."""
from datetime import datetime
from typing import Optional, Any, Dict
from uuid import UUID
import json
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

logger = structlog.get_logger(__name__)


class AuditLogger:
    """Log all user actions for compliance and security."""

    # Severidade dos eventos
    SEVERITY_INFO = "info"
    SEVERITY_WARN = "warning"
    SEVERITY_ERROR = "error"

    # Tipos de ações
    ACTION_CREATE = "create"
    ACTION_READ = "read"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_LOGIN = "login"
    ACTION_LOGOUT = "logout"
    ACTION_FAILED_LOGIN = "failed_login"
    ACTION_PERMISSION_DENIED = "permission_denied"
    ACTION_EXPORT = "export"
    ACTION_IMPORT = "import"

    @staticmethod
    async def log_action(
        user_id: UUID,
        organization_id: UUID,
        action: str,
        entity: str,
        entity_id: Optional[UUID] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        severity: str = SEVERITY_INFO,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session: Optional[AsyncSession] = None,
    ) -> None:
        """
        Log an audit event.

        Args:
            user_id: UUID of user performing action
            organization_id: UUID of organization
            action: Type of action (create, update, delete, etc)
            entity: Entity type (athlete, workout, team, etc)
            entity_id: ID of entity affected
            old_value: Previous state (for updates)
            new_value: New state (for updates/creates)
            severity: Event severity (info, warning, error)
            ip_address: Client IP address
            user_agent: Client user agent string
            session: AsyncSession for database write
        """

        # Log to structured logging first
        logger.info(
            "audit_event",
            user_id=str(user_id),
            organization_id=str(organization_id),
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id else None,
            severity=severity,
            ip_address=ip_address,
            timestamp=datetime.utcnow().isoformat(),
        )

        # Persist to database if session provided
        if session:
            await AuditLogger._persist_to_db(
                user_id=user_id,
                organization_id=organization_id,
                action=action,
                entity=entity,
                entity_id=entity_id,
                old_value=old_value,
                new_value=new_value,
                ip_address=ip_address,
                user_agent=user_agent,
                session=session,
            )

    @staticmethod
    async def _persist_to_db(
        user_id: UUID,
        organization_id: UUID,
        action: str,
        entity: str,
        entity_id: Optional[UUID],
        old_value: Optional[Dict],
        new_value: Optional[Dict],
        ip_address: Optional[str],
        user_agent: Optional[str],
        session: AsyncSession,
    ) -> None:
        """Persist audit log to database."""
        try:
            # Raw SQL insert to avoid complex ORM mapping
            query = """
            INSERT INTO audit_logs
            (user_id, organization_id, action, entity, entity_id, old_value, new_value, ip_address, user_agent)
            VALUES (:user_id, :org_id, :action, :entity, :entity_id, :old_val, :new_val, :ip, :ua)
            """

            await session.execute(
                query,
                {
                    "user_id": str(user_id),
                    "org_id": str(organization_id),
                    "action": action,
                    "entity": entity,
                    "entity_id": str(entity_id) if entity_id else None,
                    "old_val": json.dumps(old_value) if old_value else None,
                    "new_val": json.dumps(new_value) if new_value else None,
                    "ip": ip_address,
                    "ua": user_agent,
                },
            )

            await session.commit()
        except Exception as e:
            logger.error("audit_db_error", error=str(e))
            # Don't re-raise; audit logging should not break main request


class AuditContext:
    """Context manager for audit logging."""

    def __init__(
        self,
        user_id: UUID,
        organization_id: UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        self.user_id = user_id
        self.organization_id = organization_id
        self.ip_address = ip_address
        self.user_agent = user_agent

    async def log(
        self,
        action: str,
        entity: str,
        entity_id: Optional[UUID] = None,
        old_value: Optional[Dict] = None,
        new_value: Optional[Dict] = None,
        severity: str = AuditLogger.SEVERITY_INFO,
        session: Optional[AsyncSession] = None,
    ) -> None:
        """Log action in this context."""
        await AuditLogger.log_action(
            user_id=self.user_id,
            organization_id=self.organization_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            severity=severity,
            ip_address=self.ip_address,
            user_agent=self.user_agent,
            session=session,
        )


# Usage examples
usage_examples = """
# Em routes/data_routes.py

from .core.audit import AuditLogger, AuditContext

@router.post("/api/v1/athletes")
async def create_athlete(
    body: dict,
    request: Request,
    payload: dict = Depends(require_coach),
    session: AsyncSession = Depends(get_session),
):
    audit = AuditContext(
        user_id=UUID(payload['user_id']),
        organization_id=UUID(payload['org_id']),
        ip_address=request.client.host,
        user_agent=request.headers.get('user-agent'),
    )

    # Create athlete
    athlete = commands.create_athlete(session, payload, body)

    # Log to audit trail
    await audit.log(
        action=AuditLogger.ACTION_CREATE,
        entity='athlete',
        entity_id=athlete.id,
        new_value={'name': athlete.name, 'team_id': str(athlete.team_id)},
        session=session,
    )

    return athlete


@router.patch("/api/v1/athletes/{athlete_id}")
async def update_athlete(
    athlete_id: str,
    body: dict,
    request: Request,
    payload: dict = Depends(require_coach),
    session: AsyncSession = Depends(get_session),
):
    audit = AuditContext(
        user_id=UUID(payload['user_id']),
        organization_id=UUID(payload['org_id']),
        ip_address=request.client.host,
        user_agent=request.headers.get('user-agent'),
    )

    # Get old state
    athlete = await session.get(Athlete, UUID(athlete_id))
    old_state = {'name': athlete.name, 'primary_stroke': athlete.primary_stroke}

    # Update
    updated = commands.update_athlete(session, payload, athlete_id, body)

    # Log difference
    new_state = {'name': updated.name, 'primary_stroke': updated.primary_stroke}
    await audit.log(
        action=AuditLogger.ACTION_UPDATE,
        entity='athlete',
        entity_id=updated.id,
        old_value=old_state,
        new_value=new_state,
        session=session,
    )

    return updated


@router.delete("/api/v1/athletes/{athlete_id}")
async def delete_athlete(
    athlete_id: str,
    request: Request,
    payload: dict = Depends(require_coach),
    session: AsyncSession = Depends(get_session),
):
    audit = AuditContext(
        user_id=UUID(payload['user_id']),
        organization_id=UUID(payload['org_id']),
        ip_address=request.client.host,
        user_agent=request.headers.get('user-agent'),
    )

    # Delete
    commands.delete_athlete(session, payload, athlete_id)

    # Log deletion
    await audit.log(
        action=AuditLogger.ACTION_DELETE,
        entity='athlete',
        entity_id=UUID(athlete_id),
        severity=AuditLogger.SEVERITY_WARN,
        session=session,
    )

    return {'status': 'deleted'}
"""
