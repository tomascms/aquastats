"""GDPR: parental consent for athletes under 13, accepted terms, data export and inactive-account retention.

Health and wellbeing data (sleep, RPE, recovery, heart rate) of an athlete under 13 is only stored once
someone with parental responsibility has authorised it through a signed link (Lei 58/2019, art. 16.º).
Withdrawing that consent deletes what was stored on it. Accounts inactive for 3 years are deleted, after a
warning by email 30 days before.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.config import get_settings
from ..core.google_oauth import read_oauth_state, sign_oauth_state
from ..core.http_security import compare, new_token
from ..core.mail import send_guardian_confirmation, send_guardian_request, send_inactivity_notice
from ..core.passwords import valid_email
from .models import (
    Athlete,
    AuditLog,
    Goal,
    HrSession,
    MeetEntry,
    MeetResult,
    OAuthAccount,
    ParentalConsent,
    PersonalRecord,
    PolarLink,
    Profile,
    RaceSession,
    RefreshToken,
    Team,
    TeamMember,
    TimeLog,
    User,
)

log = logging.getLogger("aquastats.privacy")

CONSENT_AGE = 13  # Lei 58/2019, art. 16.º
# Date of the terms and privacy policy in force (apps/web/src/app/termos, /privacidade). Bump both together.
TERMS_VERSION = "2026-10-20"
GRANT_LINK_TTL = timedelta(days=7)
REQUEST_COOLDOWN = timedelta(minutes=5)
INACTIVE_AFTER = timedelta(days=3 * 365 + 1)
NOTICE_BEFORE = timedelta(days=30)

HEALTH_BLOCKED = (
    "Falta a autorização do responsável parental. Até lá, a Aquastats não guarda sono, RPE, recuperação "
    "nem frequência cardíaca."
)
LINK_INVALID = "Este link já não é válido. Pede um novo ao atleta."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def age_on(birth: date, today: date) -> int:
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def needs_guardian(birth: date | None, today: date | None = None) -> bool:
    return birth is not None and age_on(birth, today or date.today()) < CONSENT_AGE


def parse_birth_date(raw) -> date:
    try:
        birth = date.fromisoformat(str(raw or "")[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail="Indica uma data de nascimento válida.")
    today = date.today()
    if birth > today or age_on(birth, today) > 100 or age_on(birth, today) < 3:
        raise HTTPException(status_code=400, detail="Indica uma data de nascimento válida.")
    return birth


def _thirteenth_birthday(birth: date) -> date:
    try:
        return birth.replace(year=birth.year + CONSENT_AGE)
    except ValueError:  # 29 February
        return date(birth.year + CONSENT_AGE, 3, 1)


# ── Consent state and the gate on health data ────────────────────────────────


def consent_state(session: Session, user_id: UUID | None, birth: date | None) -> str:
    """"not_required", "missing" (under 13, never asked), "pending", "granted" or "withdrawn".

    The birth date declared when consent was asked wins over the profile's, so editing the profile does not
    lift the block. Turning 13 does."""
    row = session.get(ParentalConsent, user_id) if user_id else None
    if row:
        birth = row.birth_date
    if not needs_guardian(birth):
        return "not_required"
    return row.status if row else "missing"


def require_health_consent(session: Session, user_id: UUID | None, birth: date | None) -> None:
    if consent_state(session, user_id, birth) not in {"not_required", "granted"}:
        raise HTTPException(status_code=403, detail=HEALTH_BLOCKED)


def require_athlete_health_consent(session: Session, athlete: Athlete) -> None:
    require_health_consent(session, athlete.user_id, athlete.date_of_birth)


# ── Asking, granting, withdrawing ────────────────────────────────────────────


def guardian_token(row: ParentalConsent, expires: datetime) -> str:
    return sign_oauth_state({"p": "guardian", "u": str(row.user_id), "n": row.nonce, "exp": int(expires.timestamp())})


def _read_token(session: Session, token: str) -> ParentalConsent:
    data = read_oauth_state(token)
    if not data or data.get("p") != "guardian":
        raise HTTPException(status_code=400, detail=LINK_INVALID)
    try:
        row = session.get(ParentalConsent, UUID(str(data.get("u"))))
    except ValueError:
        row = None
    if not row or not compare(row.nonce, str(data.get("n") or "")):
        raise HTTPException(status_code=400, detail=LINK_INVALID)
    return row


def _child_name(session: Session, user_id: UUID) -> str:
    profile = session.get(Profile, user_id)
    return (profile.full_name if profile else "") or "o atleta"


def request_consent(session: Session, user: User, birth: date, guardian_email: str) -> str | None:
    """Asks the guardian by email. Outside production the link is returned instead of sent."""
    email = (guardian_email or "").strip().lower()
    if not valid_email(email):
        raise HTTPException(status_code=400, detail="Indica o email de um responsável parental.")
    if email == (user.email or "").lower():
        raise HTTPException(status_code=400, detail="O email do responsável parental tem de ser diferente do teu.")
    stamp = _now()
    row = session.get(ParentalConsent, user.id)
    if row and row.guardian_email == email and row.status == "granted":
        return None
    if row and row.guardian_email == email and row.status == "pending" and stamp - row.requested_at < REQUEST_COOLDOWN:
        raise HTTPException(status_code=429, detail="Já enviámos o pedido. Aguarda alguns minutos antes de reenviar.")
    if not row:
        row = ParentalConsent(user_id=user.id, created_at=stamp)
        session.add(row)
    row.birth_date = birth
    row.guardian_email = email
    row.status = "pending"
    row.nonce = new_token(16)
    row.requested_at = stamp
    row.decided_at = None
    row.updated_at = stamp
    session.flush()
    path = f"/responsavel/{guardian_token(row, stamp + GRANT_LINK_TTL)}"
    if not get_settings().is_production:
        return path
    send_guardian_request(email, _child_name(session, user.id), f"{get_settings().app_url.rstrip('/')}{path}")
    return None


def declare_birth(session: Session, user: User, raw_birth, guardian_email: str = "") -> str | None:
    """The birth date given at signup or when joining a team; under 13 it starts the guardian's consent."""
    birth = parse_birth_date(raw_birth)
    profile = session.get(Profile, user.id)
    if profile:
        profile.date_of_birth = birth
    if needs_guardian(birth):
        return request_consent(session, user, birth, guardian_email)
    return None


def guardian_view(session: Session, token: str) -> dict:
    row = _read_token(session, token)
    return {"name": _child_name(session, row.user_id), "status": row.status}


def guardian_decide(session: Session, token: str, decision: str) -> dict:
    row = _read_token(session, token)
    stamp = _now()
    if decision == "grant":
        if row.status == "withdrawn":
            raise HTTPException(status_code=400, detail=LINK_INVALID)  # a new request is needed
        row.status = "granted"
        # The confirmation carries a link to withdraw, valid until the athlete turns 13.
        until = datetime.combine(_thirteenth_birthday(row.birth_date), datetime.min.time(), tzinfo=timezone.utc)
        manage = f"{get_settings().app_url.rstrip('/')}/responsavel/{guardian_token(row, max(until, stamp + GRANT_LINK_TTL))}"
        if get_settings().is_production:
            send_guardian_confirmation(row.guardian_email, _child_name(session, row.user_id), manage)
    elif decision == "withdraw":
        row.status = "withdrawn"
        purge_health_data(session, row.user_id)
    else:
        raise HTTPException(status_code=400, detail="Decisão inválida.")
    row.decided_at = stamp
    row.updated_at = stamp
    session.add(
        AuditLog(user_id=row.user_id, action=f"consent.{decision}", resource_type="user", resource_id=row.user_id, created_at=stamp)
    )
    return {"status": row.status, "name": _child_name(session, row.user_id)}


def purge_health_data(session: Session, user_id: UUID) -> None:
    """What was stored on the guardian's consent: wellness (sleep, RPE, recovery) and heart rate."""
    for athlete in session.scalars(select(Athlete).where(Athlete.user_id == user_id)).all():
        if "wellness" in (athlete.extra or {}):
            athlete.extra = {k: v for k, v in athlete.extra.items() if k != "wellness"}
            flag_modified(athlete, "extra")
        session.execute(delete(HrSession).where(HrSession.athlete_id == athlete.id))
        session.execute(delete(PolarLink).where(PolarLink.athlete_id == athlete.id))
    profile = session.get(Profile, user_id)
    if profile and "wellness" in (profile.extra or {}):
        profile.extra = {k: v for k, v in profile.extra.items() if k != "wellness"}
        flag_modified(profile, "extra")
    session.flush()


def accept_terms(user: User) -> None:
    user.terms_version = TERMS_VERSION
    user.terms_accepted_at = _now()


# ── Right of access / portability ────────────────────────────────────────────


def _row(obj, *skip: str) -> dict:
    return {column.key: getattr(obj, column.key) for column in obj.__table__.columns if column.key not in skip}


def export_user_data(session: Session, user: User) -> dict:
    """Everything that is the user's own, as JSON. Team plans (workouts, meets) are the club's, not here."""
    athletes = session.scalars(select(Athlete).where(Athlete.user_id == user.id)).all()
    ids = [athlete.id for athlete in athletes]
    entries = session.scalars(select(MeetEntry).where(MeetEntry.athlete_id.in_(ids))).all() if ids else []
    members = session.scalars(select(TeamMember).where(TeamMember.user_id == user.id)).all()
    consent = session.get(ParentalConsent, user.id)
    settings = {k: v for k, v in (user.settings or {}).items() if k != "login_lock_ips"}

    def by_athlete(model, *skip: str) -> list[dict]:
        return [_row(row, *skip) for row in session.scalars(select(model).where(model.athlete_id.in_(ids))).all()] if ids else []

    data = {
        "exportedAt": _now(),
        "account": {**_row(user, "password_hash", "settings", "failed_login_count", "locked_until"), "settings": settings},
        "profile": _row(session.get(Profile, user.id)) if session.get(Profile, user.id) else None,
        "signInMethods": [{"provider": a.provider, "email": a.email, "createdAt": a.created_at} for a in session.scalars(select(OAuthAccount).where(OAuthAccount.user_id == user.id)).all()],
        "teams": [{"team": (session.get(Team, m.team_id).name if session.get(Team, m.team_id) else None), "status": m.status, "since": m.created_at} for m in members],
        "parentalConsent": _row(consent, "nonce") if consent else None,
        "athletes": [_row(athlete) for athlete in athletes],
        "times": by_athlete(TimeLog),
        "meetEntries": [_row(entry) for entry in entries],
        "meetResults": [_row(r) for r in session.scalars(select(MeetResult).where(MeetResult.entry_id.in_([e.id for e in entries]))).all()] if entries else [],
        "personalRecords": by_athlete(PersonalRecord),
        "raceSessions": by_athlete(RaceSession),
        "goals": by_athlete(Goal),
        "heartRate": by_athlete(HrSession),
        "polar": by_athlete(PolarLink, "token"),
        "activityLog": [_row(a) for a in session.scalars(select(AuditLog).where(AuditLog.user_id == user.id).order_by(AuditLog.created_at)).all()],
    }
    return jsonable_encoder(data)


# ── Retention: inactive for 3 years → warning → deleted 30 days later ────────


def _last_seen():
    refreshed = select(func.max(RefreshToken.created_at)).where(RefreshToken.user_id == User.id).scalar_subquery()
    return func.greatest(User.created_at, User.last_login_at, refreshed)  # greatest() skips NULLs


def run_retention(session: Session, stamp: datetime | None = None, limit: int = 200, dry_run: bool = False) -> dict:
    """dry_run: sends no email, lists the account ids it would warn or delete, and rolls everything back."""
    from .identity import delete_user_account

    stamp = stamp or _now()
    last_seen = _last_seen()
    counts = {"reactivated": 0, "warned": 0, "deleted": 0, "skipped": 0}
    # Signed in after the warning: the clock starts again.
    for user in session.scalars(select(User).where(User.inactivity_notice_at.is_not(None), last_seen > User.inactivity_notice_at)).all():
        user.inactivity_notice_at = None
        counts["reactivated"] += 1
    session.flush()

    due = session.scalars(
        select(User)
        .where(User.deleted_at.is_(None), User.inactivity_notice_at.is_(None), last_seen < stamp - INACTIVE_AFTER + NOTICE_BEFORE)
        .limit(limit)
    ).all()
    listed: dict[str, list[str]] = {"warn": [str(u.id) for u in due]}
    for user in due:
        when = (stamp + NOTICE_BEFORE).date()
        if not dry_run and user.email and not send_inactivity_notice(user.email, when.strftime("%d/%m/%Y")) and get_settings().is_production:
            continue  # mail down: warn on the next run, never delete unwarned
        user.inactivity_notice_at = stamp
        counts["warned"] += 1
    session.flush()

    expired = session.scalars(
        select(User)
        .where(User.inactivity_notice_at <= stamp - NOTICE_BEFORE, last_seen <= User.inactivity_notice_at)
        .limit(limit)
    ).all()
    listed["delete"] = [str(u.id) for u in expired]
    for user in expired:
        try:
            with session.begin_nested():
                delete_user_account(session, user, None)
            counts["deleted"] += 1
        except HTTPException as exc:  # e.g. a coach whose team still has athletes
            log.warning("retention: account %s kept: %s", user.id, exc.detail)
            counts["skipped"] += 1
    if dry_run:
        session.rollback()
        return {**counts, "dryRun": True, "accounts": listed}
    return counts


def cron_allowed(presented: str | None) -> bool:
    secret = get_settings().cron_secret.strip()
    return len(secret) >= 32 and compare(presented or "", secret)

