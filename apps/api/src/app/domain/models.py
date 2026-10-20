from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


def uuid_pk() -> uuid.UUID:
    return uuid.uuid4()


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    name: Mapped[str] = mapped_column(Text)
    country: Mapped[str] = mapped_column(Text, default="PT")
    timezone: Mapped[str] = mapped_column(Text, default="Europe/Lisbon")
    locale: Mapped[str] = mapped_column(Text, default="pt-PT")
    currency: Mapped[str] = mapped_column(Text, default="EUR")
    region: Mapped[str] = mapped_column(Text, default="eu")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(Text)
    join_code: Mapped[str] = mapped_column(Text)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(SmallInteger, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(Text)
    provider_account_id: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(Text)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    full_name: Mapped[str] = mapped_column(Text)
    date_of_birth: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    primary_stroke: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TeamMember(Base):
    __tablename__ = "team_members"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Athlete(Base):
    __tablename__ = "athletes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(Text)
    date_of_birth: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    primary_stroke: Mapped[str] = mapped_column(Text, default="free")
    is_placeholder: Mapped[bool] = mapped_column(Boolean, default=True)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Workout(Base):
    __tablename__ = "workouts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    workout_date: Mapped[datetime] = mapped_column(Date)
    shift: Mapped[str] = mapped_column(Text)
    athlete_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    blocks: Mapped[list] = mapped_column(JSONB, default=list)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TimeLog(Base):
    __tablename__ = "time_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    workout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workouts.id"))
    block_id: Mapped[str] = mapped_column(Text)
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"))
    rep_number: Mapped[int] = mapped_column(SmallInteger)
    mm: Mapped[int] = mapped_column(SmallInteger, default=0)
    ss: Mapped[int] = mapped_column(SmallInteger, default=0)
    cc: Mapped[int] = mapped_column(SmallInteger, default=0)
    splits: Mapped[list] = mapped_column(JSONB, default=list)
    stroke: Mapped[str] = mapped_column(Text, default="free")
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # When the edit was made on the device (migration 013): later edits win, late retries do not.
    client_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Competition(Base):
    __tablename__ = "competitions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    meet_date: Mapped[datetime] = mapped_column(Date)
    course: Mapped[str] = mapped_column(Text)
    venue: Mapped[str] = mapped_column(Text, default="")
    athlete_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MeetEntry(Base):
    __tablename__ = "meet_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    competition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("competitions.id"))
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"))
    stroke: Mapped[str] = mapped_column(Text)
    distance_m: Mapped[int] = mapped_column(Integer)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)


class MeetResult(Base):
    __tablename__ = "meet_results"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("meet_entries.id"))
    mm: Mapped[int] = mapped_column(SmallInteger, default=0)
    ss: Mapped[int] = mapped_column(SmallInteger, default=0)
    cc: Mapped[int] = mapped_column(SmallInteger, default=0)
    splits: Mapped[list] = mapped_column(JSONB, default=list)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RaceSession(Base):
    __tablename__ = "race_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"))
    competition_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    session_date: Mapped[datetime] = mapped_column(Date)
    tournament: Mapped[str] = mapped_column(Text, default="")
    course: Mapped[str] = mapped_column(Text)
    distance_m: Mapped[int] = mapped_column(Integer)
    stroke: Mapped[str] = mapped_column(Text)
    day_part: Mapped[str] = mapped_column(Text, default="am")
    reaction_s: Mapped[float] = mapped_column(Float, default=0)
    flight_s: Mapped[float] = mapped_column(Float, default=0)
    laps: Mapped[list] = mapped_column(JSONB, default=list)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SeasonPlan(Base):
    __tablename__ = "season_plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    name: Mapped[str] = mapped_column(Text)
    start_date: Mapped[datetime] = mapped_column(Date)
    end_date: Mapped[datetime] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    workout_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    session_date: Mapped[datetime] = mapped_column(Date)
    group_name: Mapped[str] = mapped_column(Text, default="")
    marks: Mapped[list] = mapped_column(JSONB, default=list)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthState(Base):
    __tablename__ = "oauth_states"
    state: Mapped[str] = mapped_column(Text, primary_key=True)
    code_verifier: Mapped[str] = mapped_column(Text)
    nonce: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    operation: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    request_hash: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text)
    response_status: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    response_body: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_type: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, default="pending")
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    max_attempts: Mapped[int] = mapped_column(SmallInteger, default=5)
    next_retry_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    error_log: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SagaInstance(Base):
    __tablename__ = "saga_instances"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    saga_type: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SagaLog(Base):
    __tablename__ = "saga_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    saga_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("saga_instances.id"))
    step: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text)
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(Text)
    resource_type: Mapped[str] = mapped_column(Text)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PersonalRecord(Base):
    __tablename__ = "personal_records"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"))
    stroke: Mapped[str] = mapped_column(Text)
    distance_m: Mapped[int] = mapped_column(Integer)
    course: Mapped[str] = mapped_column(Text)
    mm: Mapped[int] = mapped_column(SmallInteger)
    ss: Mapped[int] = mapped_column(SmallInteger)
    cc: Mapped[int] = mapped_column(SmallInteger)
    competition_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=True)
    result_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    meet_date: Mapped[datetime] = mapped_column(Date)
    source: Mapped[str] = mapped_column(Text, default="meet")
    splits: Mapped[list] = mapped_column(JSONB, default=list)


class Goal(Base):
    """A target for one athlete, set by the coach ("o que espero de ti") or by the athlete ("o que quero")."""

    __tablename__ = "goals"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"))
    author_role: Mapped[str] = mapped_column(Text)
    author_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(Text, default="time")
    stroke: Mapped[str | None] = mapped_column(Text, nullable=True)
    distance_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    course: Mapped[str | None] = mapped_column(Text, nullable=True)
    metric: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    competition_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    text: Mapped[str] = mapped_column(Text, default="")
    response: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(Text, default="active")
    achieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HrSession(Base):
    """Heart rate from a watch (FIT/TCX upload, Polar, Whoop), attached to the workout it belongs to."""

    __tablename__ = "hr_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"))
    workout_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    avg_hr: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    max_hr: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    samples: Mapped[list] = mapped_column(JSONB, default=list)
    laps: Mapped[list] = mapped_column(JSONB, default=list)
    summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PredictionLedger(Base):
    """A training prediction, stored when it was made, before the time it predicts existed. Append-only."""

    __tablename__ = "prediction_ledger"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    # Cascades: deleting the workout, athlete, team or account removes its predictions (right to erasure).
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"))
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id", ondelete="CASCADE"))
    workout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="CASCADE"))
    block_id: Mapped[str] = mapped_column(Text)
    rep_number: Mapped[int] = mapped_column(SmallInteger)
    target_date: Mapped[datetime] = mapped_column(Date)
    model: Mapped[str] = mapped_column(Text)
    model_version: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    horizon: Mapped[str] = mapped_column(Text, default="day")
    mean_s: Mapped[float] = mapped_column(Float)
    lo_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    hi_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    nominal: Mapped[float | None] = mapped_column(Float, nullable=True)
    sd_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    predicted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    predicted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PolarLink(Base):
    """An athlete's Polar AccessLink authorisation (token encrypted at rest)."""

    __tablename__ = "polar_links"
    athlete_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("athletes.id"), primary_key=True)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    polar_user_id: Mapped[str] = mapped_column(Text)
    token: Mapped[str] = mapped_column(Text)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TeamInvite(Base):
    __tablename__ = "team_invites"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    email: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    token_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
