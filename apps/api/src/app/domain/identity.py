from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.client import stored_ip
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
    # Browsers drop tabs/newlines inside URLs, so "/\t/evil.com" would become "//evil.com".
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in value):
        return fallback
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
    target.updated_at = stamp
    # The merged-away account is deleted for good; what it authored now belongs to the account kept.
    from sqlalchemy import text

    session.flush()  # moved OAuth accounts / membership are saved before the bulk updates below
    moved = {"s": source.id, "t": target.id}
    for table, column in (
        ("workouts", "created_by"),
        ("competitions", "created_by"),
        ("season_plans", "created_by"),
        ("attendance_sessions", "created_by"),
        ("race_sessions", "created_by"),
        ("goals", "author_user_id"),
        ("time_logs", "recorded_by"),
        ("meet_results", "recorded_by"),
        ("polar_links", "user_id"),
        ("audit_logs", "user_id"),
    ):
        session.execute(text(f"update {table} set {column} = :t where {column} = :s"), moved)
    for model in (TeamMember, RefreshToken, PasswordResetToken, EmailVerificationToken, IdempotencyKey, OAuthAccount):
        session.execute(delete(model).where(model.user_id == source.id))
    session.execute(delete(Profile).where(Profile.user_id == source.id))
    session.flush()
    session.delete(source)
    session.flush()
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
    # History a previous coach let go with them (removed with "keep the data") moves to this team.
    from .athlete_transfer import migrate_history

    session.flush()
    migrate_history(session, user.id, athlete, stamp)
    session.add(TeamMember(id=uuid4(), team_id=team.id, user_id=user.id, status="swimmer", created_at=stamp))
    session.add(
        AuditLog(
            id=uuid4(),
            organization_id=team.organization_id,
            user_id=user.id,
            action="team.join",
            resource_type="team",
            resource_id=team.id,
            ip_address=stored_ip(request),
            request_id=getattr(request.state, "request_id", None),
            created_at=stamp,
        )
    )
    return "/swimmer/definicoes"


def leave_team(session: Session, user: User, request: Request, purge: bool = False) -> None:
    """`purge`: the swimmer's own choice to delete their data in this team for good, instead of the
    default of leaving it behind (which a coach can also let follow them to their next team)."""
    if user.role != "swimmer":
        raise HTTPException(status_code=409, detail="Só atletas podem sair da equipa.")
    member = session.scalar(select(TeamMember).where(TeamMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=409, detail="Não estás em nenhuma equipa.")
    stamp = now()
    athlete = session.scalar(
        select(Athlete).where(Athlete.user_id == user.id, Athlete.team_id == member.team_id, Athlete.deleted_at.is_(None))
    )
    if athlete and purge:
        from .commands import _purge_athlete

        _purge_athlete(session, member.team_id, athlete)  # also removes this membership row
    else:
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
            ip_address=stored_ip(request),
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
    access = sign_access(str(user.id), user.role, team_id, org_id, fresh=True)
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
    """Deleting an account deletes everything that is theirs, for good (no anonymised leftovers).

    - A swimmer: every athlete record of theirs, in any team (also history kept by a past team).
    - The coach who owns a team without swimmers: the whole team and its organisation.
    - What they created in someone else's team (e.g. as assistant coach) is handed to that team's owner,
      so other people's work isn't lost.
    """
    from .commands import _purge_athlete

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
        if member.status == "owner":
            _delete_team(session, member.team_id)

    for athlete in session.scalars(select(Athlete).where(Athlete.user_id == user.id)).all():
        _purge_athlete(session, athlete.team_id, athlete)
    for athlete in session.scalars(select(Athlete).where(Athlete.deleted_at.is_not(None))).all():
        if (athlete.extra or {}).get("formerUserId") == str(user.id):
            _purge_athlete(session, athlete.team_id, athlete)

    _hand_over(session, user.id)
    for model in (TeamMember, RefreshToken, PasswordResetToken, EmailVerificationToken, IdempotencyKey, OAuthAccount, AuditLog):
        session.execute(delete(model).where(model.user_id == user.id))
    session.execute(delete(Profile).where(Profile.user_id == user.id))
    session.flush()
    session.delete(user)
    session.flush()


def _delete_team(session: Session, team_id: UUID) -> None:
    """A team and everything in it, then its organisation if it has no other team."""
    from .commands import _purge_athlete
    from .models import Goal, HrSession, PolarLink, TeamInvite

    for athlete in session.scalars(select(Athlete).where(Athlete.team_id == team_id)).all():
        _purge_athlete(session, team_id, athlete)
    workouts = select(Workout.id).where(Workout.team_id == team_id)
    competitions = select(Competition.id).where(Competition.team_id == team_id)
    entries = select(MeetEntry.id).where(MeetEntry.competition_id.in_(competitions))
    session.execute(delete(TimeLog).where(TimeLog.workout_id.in_(workouts)))
    session.execute(delete(MeetResult).where(MeetResult.entry_id.in_(entries)))
    session.execute(delete(PersonalRecord).where(PersonalRecord.competition_id.in_(competitions)))
    session.execute(delete(MeetEntry).where(MeetEntry.competition_id.in_(competitions)))
    for model in (Goal, HrSession, PolarLink, RaceSession, AttendanceSession, SeasonPlan, TeamInvite, TeamMember, Workout, Competition):
        session.execute(delete(model).where(model.team_id == team_id))
    team = session.get(Team, team_id)
    if team is not None:
        organization_id = team.organization_id
        session.delete(team)
        session.flush()
        if organization_id and not session.scalar(select(Team.id).where(Team.organization_id == organization_id).limit(1)):
            org = session.get(Organization, organization_id)
            if org is not None:
                session.delete(org)
    session.flush()


def _hand_over(session: Session, user_id: UUID) -> None:
    """Rows they created in teams that stay (another owner's team) go to that team's owner."""
    from sqlalchemy import text

    owner = "(select m.user_id from team_members m where m.team_id = {team} and m.status = 'owner' and m.user_id <> :u limit 1)"
    for table, column in (
        ("workouts", "created_by"),
        ("competitions", "created_by"),
        ("season_plans", "created_by"),
        ("attendance_sessions", "created_by"),
        ("race_sessions", "created_by"),
        ("goals", "author_user_id"),
    ):
        new_owner = owner.format(team="t.team_id")
        session.execute(text(f"update {table} t set {column} = {new_owner} where t.{column} = :u and {new_owner} is not null"), {"u": user_id})
        session.execute(text(f"delete from {table} where {column} = :u"), {"u": user_id})  # no owner to take it
    by_workout = owner.format(team="w.team_id")
    session.execute(
        text(f"update time_logs l set recorded_by = {by_workout} from workouts w where w.id = l.workout_id and l.recorded_by = :u and {by_workout} is not null"),
        {"u": user_id},
    )
    session.execute(
        text(
            f"update meet_results r set recorded_by = {owner.format(team='c.team_id')} from meet_entries e join competitions c on c.id = e.competition_id "
            f"where e.id = r.entry_id and r.recorded_by = :u and {owner.format(team='c.team_id')} is not null"
        ),
        {"u": user_id},
    )
    session.execute(text("delete from time_logs where recorded_by = :u"), {"u": user_id})
    session.execute(text("delete from meet_results where recorded_by = :u"), {"u": user_id})

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
            ip_address=stored_ip(request),
            request_id=getattr(request.state, "request_id", None),
            created_at=stamp,
        )
    )
    saga.status = "completed"
    session.add(SagaLog(id=uuid4(), saga_id=saga.id, step="provision", status="completed", detail={"role": role}, created_at=stamp))
    return user


# One message for every failed sign-in: it never tells whether an email has an account.
LOGIN_FAILED = "Email ou palavra-passe incorrectos. Depois de várias tentativas, espera 15 minutos."


def lock_or_fail(user: User, ip: str | None = None) -> None:
    stamp = now()
    user.failed_login_count = int(user.failed_login_count or 0) + 1
    if user.failed_login_count >= 8:
        from datetime import timedelta

        user.locked_until = stamp + timedelta(minutes=15)
        user.failed_login_count = 0
        # The lock holds for the address that failed, so someone who only knows the email can't lock the owner out.
        user.settings = {**(user.settings or {}), "login_lock_ip": ip}
    raise HTTPException(status_code=401, detail=LOGIN_FAILED)


def login_locked(user: User, ip: str | None) -> bool:
    if not (user.locked_until and user.locked_until > now()):
        return False
    locked_ip = (user.settings or {}).get("login_lock_ip")
    return not locked_ip or not ip or locked_ip == ip
