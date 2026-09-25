from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.config import get_settings
from ..core.sessions import issue_refresh, set_auth_cookies, sign_access
from .models import (
    Athlete,
    AttendanceSession,
    AuditLog,
    Competition,
    EmailVerificationToken,
    IdempotencyKey,
    MeetEntry,
    MeetResult,
    OAuthAccount,
    Organization,
    OutboxEvent,
    PasswordResetToken,
    PersonalRecord,
    Profile,
    RaceSession,
    RefreshToken,
    SagaInstance,
    SagaLog,
    SeasonPlan,
    Team,
    TeamMember,
    TimeLog,
    User,
    Workout,
)

EMPTY = ""
INVITE_COOKIE = "sa_invite"


def now() -> datetime:
    return datetime.now(timezone.utc)


def join_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def unique_join_code(session: Session, attempts: int = 12) -> str:
    for _ in range(attempts):
        code = join_code()
        exists = session.scalar(select(Team.id).where(Team.join_code == code))
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Não foi possível gerar código de equipa.")


def normalize_email(value: str | None) -> str | None:
    email = (value or "").strip().lower()
    return email or None


def find_user_by_email(session: Session, email: str | None) -> User | None:
    email = normalize_email(email)
    if not email:
        return None
    return session.scalar(select(User).where(func.lower(User.email) == email, User.deleted_at.is_(None)))


def team_by_join_code(session: Session, code: str | None) -> Team:
    token = (code or "").strip().upper()
    team = session.scalar(select(Team).where(Team.join_code == token, Team.deleted_at.is_(None)))
    if not team:
        raise HTTPException(status_code=404, detail="Este convite não é válido.")
    return team


def remember_invite(response: Response, code: str | None) -> str:
    from ..core.config import get_settings

    token = (code or "").strip().upper()
    if token:
        response.set_cookie(
            INVITE_COOKIE,
            token,
            max_age=3600,
            httponly=True,
            secure=get_settings().is_production,
            samesite="lax",
            path="/",
        )
    return token


def safe_app_path(path: str, fallback: str = "/") -> str:
    value = (path or "").strip()
    if not value.startswith("/") or value.startswith("//") or "\\" in value or "://" in value:
        return fallback
    return value


def invite_next_path(request: Request, fallback: str, invite: str | None = None, *, allow_cookie: bool = False) -> str:
    code = (invite or "").strip().upper()
    if not code and allow_cookie:
        code = (request.cookies.get(INVITE_COOKIE) or "").strip().upper()
    if code.isalnum() and 4 <= len(code) <= 12:
        return f"/entrar/{code}"
    return safe_app_path(fallback)


def absorb_user(session: Session, source: User, target: User) -> User:
    if source.id == target.id:
        return target
    stamp = now()
    for account in session.scalars(select(OAuthAccount).where(OAuthAccount.user_id == source.id)).all():
        clash = session.scalar(
            select(OAuthAccount).where(OAuthAccount.user_id == target.id, OAuthAccount.provider == account.provider)
        )
        if clash:
            session.delete(account)
        else:
            account.user_id = target.id
            account.updated_at = stamp
    source_member = session.scalar(select(TeamMember).where(TeamMember.user_id == source.id))
    target_member = session.scalar(select(TeamMember).where(TeamMember.user_id == target.id))
    if source_member and not target_member:
        source_member.user_id = target.id
    elif source_member:
        session.delete(source_member)
    for athlete in session.scalars(select(Athlete).where(Athlete.user_id == source.id)).all():
        athlete.user_id = target.id
        athlete.updated_at = stamp
    if source.password_hash and not target.password_hash:
        target.password_hash = source.password_hash
    if source.is_verified:
        target.is_verified = True
    if not target.email and source.email:
        target.email = normalize_email(source.email)
    if target.role == "pending" and source.role in {"coach", "swimmer"}:
        target.role = source.role
    source.email = None
    source.is_active = False
    source.deleted_at = stamp
    source.updated_at = stamp
    target.updated_at = stamp
    return target


def _copy_profile_to_athlete(session: Session, user: User, athlete: Athlete) -> None:
    profile = session.get(Profile, user.id)
    if not profile:
        return
    if profile.full_name:
        athlete.name = profile.full_name[:80]
    if profile.date_of_birth:
        athlete.date_of_birth = profile.date_of_birth
    if profile.primary_stroke:
        athlete.primary_stroke = profile.primary_stroke
    profile_extra = profile.extra or {}
    extra = dict(athlete.extra or {})
    for key in ("gender", "seedRecords", "groupName"):
        if key in profile_extra:
            extra[key] = profile_extra[key]
    athlete.extra = extra


def _purge_athlete_data(session: Session, athlete_id: UUID, stamp: datetime) -> None:
    session.execute(delete(TimeLog).where(TimeLog.athlete_id == athlete_id))
    session.execute(delete(PersonalRecord).where(PersonalRecord.athlete_id == athlete_id))
    entries = session.scalars(select(MeetEntry).where(MeetEntry.athlete_id == athlete_id)).all()
    for entry in entries:
        session.execute(delete(MeetResult).where(MeetResult.entry_id == entry.id))
        session.delete(entry)
    for row in session.scalars(
        select(RaceSession).where(RaceSession.athlete_id == athlete_id, RaceSession.deleted_at.is_(None))
    ):
        row.deleted_at = stamp
        row.updated_at = stamp
    for workout in session.scalars(select(Workout).where(Workout.deleted_at.is_(None))):
        ids = workout.athlete_ids or []
        if athlete_id in ids:
            workout.athlete_ids = [item for item in ids if item != athlete_id]
    for meet in session.scalars(select(Competition).where(Competition.deleted_at.is_(None))):
        ids = meet.athlete_ids or []
        if athlete_id in ids:
            meet.athlete_ids = [item for item in ids if item != athlete_id]


def _soft_delete_athlete(session: Session, athlete: Athlete, stamp: datetime) -> None:
    _purge_athlete_data(session, athlete.id, stamp)
    athlete.user_id = None
    athlete.deleted_at = stamp
    athlete.updated_at = stamp


def _purge_team_operational_data(session: Session, team_id: UUID, stamp: datetime) -> None:
    for workout in session.scalars(select(Workout).where(Workout.team_id == team_id, Workout.deleted_at.is_(None))):
        session.execute(delete(TimeLog).where(TimeLog.workout_id == workout.id))
        workout.deleted_at = stamp
        workout.updated_at = stamp
    for meet in session.scalars(select(Competition).where(Competition.team_id == team_id, Competition.deleted_at.is_(None))):
        meet.deleted_at = stamp
        meet.updated_at = stamp
    for row in session.scalars(select(RaceSession).where(RaceSession.team_id == team_id, RaceSession.deleted_at.is_(None))):
        row.deleted_at = stamp
        row.updated_at = stamp
    for row in session.scalars(select(SeasonPlan).where(SeasonPlan.team_id == team_id, SeasonPlan.deleted_at.is_(None))):
        row.deleted_at = stamp
        row.updated_at = stamp
    for row in session.scalars(select(AttendanceSession).where(AttendanceSession.team_id == team_id, AttendanceSession.deleted_at.is_(None))):
        row.deleted_at = stamp
        row.updated_at = stamp


def join_team(session: Session, user: User, code: str, request: Request) -> str:
    team = team_by_join_code(session, code)
    if user.role == "coach":
        raise HTTPException(status_code=409, detail="Uma conta de treinador não pode entrar como atleta.")
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user.id))
    if member:
        if member.team_id == team.id:
            return "/swimmer"
        raise HTTPException(status_code=409, detail="Esta conta já está noutra equipa. Sai da equipa actual primeiro.")
    stamp = now()
    if user.role == "pending":
        user.role = "swimmer"
        user.updated_at = stamp
    elif user.role != "swimmer":
        raise HTTPException(status_code=409, detail="Esta conta não pode entrar como atleta.")
    profile = session.get(Profile, user.id)
    name = (profile.full_name if profile else None) or (user.email or "Atleta")
    athlete = session.scalar(
        select(Athlete).where(Athlete.user_id == user.id, Athlete.team_id == team.id, Athlete.deleted_at.is_(None))
    )
    if not athlete:
        alumni = next(
            (
                row
                for row in session.scalars(
                    select(Athlete).where(Athlete.team_id == team.id, Athlete.deleted_at.is_not(None))
                ).all()
                if (row.extra or {}).get("formerUserId") == str(user.id)
            ),
            None,
        )
        if alumni:
            alumni.user_id = user.id
            alumni.deleted_at = None
            alumni.updated_at = stamp
            extra = dict(alumni.extra or {})
            extra.pop("formerUserId", None)
            alumni.extra = extra
            flag_modified(alumni, "extra")
            _copy_profile_to_athlete(session, user, alumni)
            athlete = alumni
        else:
            athlete = Athlete(
                id=uuid4(),
                team_id=team.id,
                user_id=user.id,
                name=name[:80],
                primary_stroke="",
                is_placeholder=False,
                created_at=stamp,
                updated_at=stamp,
            )
            _copy_profile_to_athlete(session, user, athlete)
            session.add(athlete)
            session.flush()
            seed_records = (athlete.extra or {}).get("seedRecords")
            if isinstance(seed_records, list) and seed_records:
                from .commands import _upsert_seed_records

                _upsert_seed_records(session, athlete.id, seed_records)
    session.add(TeamMember(id=uuid4(), team_id=team.id, user_id=user.id, status="swimmer", created_at=stamp))
    session.add(
        AuditLog(
            id=uuid4(),
            organization_id=team.organization_id,
            user_id=user.id,
            action="team.join",
            resource_type="team",
            resource_id=team.id,
            ip_address=request.client.host if request.client else None,
            request_id=getattr(request.state, "request_id", None),
            created_at=stamp,
        )
    )
    return "/swimmer/definicoes"


def leave_team(session: Session, user: User, request: Request) -> None:
    if user.role != "swimmer":
        raise HTTPException(status_code=409, detail="Só atletas podem sair da equipa.")
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=409, detail="Não estás em nenhuma equipa.")
    stamp = now()
    athlete = session.scalar(
        select(Athlete).where(Athlete.user_id == user.id, Athlete.team_id == member.team_id, Athlete.deleted_at.is_(None))
    )
    if athlete:
        extra = dict(athlete.extra or {})
        extra["formerUserId"] = str(user.id)
        athlete.extra = extra
        flag_modified(athlete, "extra")
        athlete.user_id = None
        athlete.deleted_at = stamp
        athlete.updated_at = stamp
    session.delete(member)
    session.add(
        AuditLog(
            id=uuid4(),
            user_id=user.id,
            action="team.leave",
            resource_type="team",
            resource_id=member.team_id,
            ip_address=request.client.host if request.client else None,
            request_id=getattr(request.state, "request_id", None),
            created_at=stamp,
        )
    )


def home_path(role: str) -> str:
    if role == "coach":
        return "/coach"
    if role == "swimmer":
        return "/swimmer"
    return "/escolher"


def membership(session: Session, user_id: UUID) -> tuple[str, str]:
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user_id))
    if not member:
        return EMPTY, EMPTY
    team = session.get(Team, member.team_id)
    if not team:
        return EMPTY, EMPTY
    return str(team.id), str(team.organization_id)


def issue_session(session: Session, user: User, request: Request, response: Response) -> str:
    team_id, org_id = membership(session, user.id)
    refresh = issue_refresh(session, user.id, None, request)
    access = sign_access(str(user.id), user.role, team_id, org_id)
    set_auth_cookies(response, access, refresh)
    return home_path(user.role)


def create_pending_user(session: Session, *, email: str | None, name: str, verified: bool, password_hash: str | None = None) -> User:
    stamp = now()
    user = User(
        id=uuid4(),
        email=normalize_email(email),
        role="pending",
        is_active=True,
        is_verified=verified,
        password_hash=password_hash,
        last_login_at=stamp,
        created_at=stamp,
        updated_at=stamp,
    )
    session.add(user)
    session.flush()
    session.add(Profile(user_id=user.id, full_name=name[:80] or "Utilizador", created_at=stamp, updated_at=stamp))
    return user


def delete_user_account(session: Session, user: User, request: Request) -> None:
    stamp = now()
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user.id))

    if user.role == "coach" and member and member.status in {"owner", "coach"}:
        swimmers = session.scalars(
            select(TeamMember).where(TeamMember.team_id == member.team_id, TeamMember.status == "swimmer")
        ).all()
        if swimmers:
            raise HTTPException(
                status_code=409,
                detail="Tens atletas na equipa. Remove-os ou transfere a equipa antes de eliminar a conta.",
            )
        _purge_team_operational_data(session, member.team_id, stamp)
        team = session.get(Team, member.team_id)
        if team:
            team.deleted_at = stamp
            team.updated_at = stamp
            org = session.get(Organization, team.organization_id)
            if org:
                org.deleted_at = stamp
                org.updated_at = stamp
        session.delete(member)

    for athlete in session.scalars(select(Athlete).where(Athlete.user_id == user.id, Athlete.deleted_at.is_(None))).all():
        _soft_delete_athlete(session, athlete, stamp)

    if user.role == "swimmer" and member:
        session.delete(member)

    session.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    session.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    session.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    session.execute(delete(IdempotencyKey).where(IdempotencyKey.user_id == user.id))
    for account in session.scalars(select(OAuthAccount).where(OAuthAccount.user_id == user.id)).all():
        session.delete(account)
    profile = session.get(Profile, user.id)
    if profile:
        session.delete(profile)

    user.is_active = False
    user.deleted_at = stamp
    user.email = None
    user.password_hash = None
    user.updated_at = stamp
    session.add(
        AuditLog(
            id=uuid4(),
            user_id=user.id,
            action="auth.delete_account",
            resource_type="user",
            resource_id=user.id,
            ip_address=request.client.host if request.client else None,
            request_id=getattr(request.state, "request_id", None),
            created_at=stamp,
        )
    )


def assert_role_signup_allowed(role: str) -> None:
    if role == "coach" and not get_settings().coach_signup_enabled:
        raise HTTPException(status_code=403, detail="Registo de treinador indisponível. Pagamentos em breve.")


def provision_role(
    session: Session, user: User, role: str, request: Request, team_name: str = "", approved: bool = False
) -> User:
    if user.role != "pending":
        raise HTTPException(status_code=409, detail="Esta conta já escolheu o tipo.")
    if role not in {"coach", "swimmer"}:
        raise HTTPException(status_code=400, detail="Escolhe treinador ou atleta.")
    if not approved:
        assert_role_signup_allowed(role)
    stamp = now()
    saga = SagaInstance(
        id=uuid4(),
        saga_type="choose_role",
        status="running",
        payload={"user_id": str(user.id), "role": role},
        created_at=stamp,
        updated_at=stamp,
    )
    session.add(saga)
    session.flush()
    profile = session.get(Profile, user.id)
    name = profile.full_name if profile else (user.email or "Utilizador")

    if role == "coach":
        club = (team_name or "").strip()[:80] or f"Equipa de {name}"
        org = Organization(id=uuid4(), name=club, created_at=stamp, updated_at=stamp)
        team = Team(id=uuid4(), organization_id=org.id, name=club, join_code=unique_join_code(session), created_at=stamp, updated_at=stamp)
        session.add_all(
            [
                org,
                team,
                TeamMember(id=uuid4(), team_id=team.id, user_id=user.id, status="owner", created_at=stamp),
                OutboxEvent(
                    id=uuid4(),
                    organization_id=org.id,
                    event_type="coach.registered",
                    payload={"user_id": str(user.id), "email": user.email},
                    status="pending",
                    next_retry_at=stamp,
                    created_at=stamp,
                ),
            ]
        )
        org_id = org.id
    else:
        org_id = None
        session.add(
            OutboxEvent(
                id=uuid4(),
                event_type="swimmer.registered",
                payload={"user_id": str(user.id), "email": user.email},
                status="pending",
                next_retry_at=stamp,
                created_at=stamp,
            )
        )

    user.role = role
    user.updated_at = stamp
    session.add(
        AuditLog(
            id=uuid4(),
            organization_id=org_id,
            user_id=user.id,
            action="auth.choose_role",
            resource_type="user",
            resource_id=user.id,
            ip_address=request.client.host if request.client else None,
            request_id=getattr(request.state, "request_id", None),
            created_at=stamp,
        )
    )
    saga.status = "completed"
    session.add(SagaLog(id=uuid4(), saga_id=saga.id, step="provision", status="completed", detail={"role": role}, created_at=stamp))
    return user


def lock_or_fail(user: User) -> None:
    stamp = now()
    if user.locked_until and user.locked_until > stamp:
        raise HTTPException(status_code=423, detail="Conta temporariamente bloqueada. Tenta mais tarde.")
    user.failed_login_count = int(user.failed_login_count or 0) + 1
    if user.failed_login_count >= 8:
        from datetime import timedelta

        user.locked_until = stamp + timedelta(minutes=15)
        user.failed_login_count = 0
    raise HTTPException(status_code=401, detail="Email ou palavra-passe incorrectos.")
