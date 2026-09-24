"""Extended user models for two-tier system (Athlete/Coach)."""
from enum import Enum
from datetime import datetime
from uuid import UUID
from sqlalchemy import Column, String, DateTime, UUID as UUIDType, Enum as SQLEnum, Boolean, ARRAY, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UserType(str, Enum):
    """User type: athlete or coach."""
    ATHLETE = "athlete"
    COACH = "coach"


class AuthProvider(str, Enum):
    """Authentication providers."""
    EMAIL = "email"
    GOOGLE = "google"
    APPLE = "apple"


class UserProfile(Base):
    """Extended user profile (two-tier system)."""
    __tablename__ = "user_profiles"

    id = Column(UUIDType(as_uuid=True), primary_key=True)
    user_id = Column(UUIDType(as_uuid=True), nullable=False, unique=True, index=True)

    # User type and tier
    user_type = Column(SQLEnum(UserType), default=UserType.ATHLETE, nullable=False)
    is_verified_email = Column(Boolean, default=False)
    is_verified_phone = Column(Boolean, default=False)

    # Profile data
    bio = Column(Text, nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    preferred_language = Column(String(10), default="pt-PT")  # pt-PT or en

    # Auth providers
    auth_providers = Column(ARRAY(String), default=["email"])  # ["email", "google", "apple"]
    google_id = Column(String(255), nullable=True, unique=True, index=True)
    apple_id = Column(String(255), nullable=True, unique=True, index=True)

    # Terms & Privacy
    accepted_terms_at = Column(DateTime, nullable=True)
    accepted_privacy_at = Column(DateTime, nullable=True)
    accepted_marketing_at = Column(DateTime, nullable=True)

    # Tracking
    last_login_at = Column(DateTime, nullable=True)
    last_login_provider = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class CoachProfile(Base):
    """Coach-specific profile (for paid plans)."""
    __tablename__ = "coach_profiles"

    id = Column(UUIDType(as_uuid=True), primary_key=True)
    user_id = Column(UUIDType(as_uuid=True), nullable=False, unique=True, index=True)

    # Coach info
    coach_name = Column(String(255), nullable=False)
    coach_bio = Column(Text, nullable=True)
    coach_image_url = Column(String(500), nullable=True)
    specialties = Column(ARRAY(String), default=[])  # ["sprint", "distance", "technique"]

    # Qualifications
    certifications = Column(ARRAY(String), default=[])  # ["ISSF", "ASCA", etc]
    experience_years = Column(Integer, nullable=True)

    # Contact
    phone = Column(String(20), nullable=True)
    website = Column(String(500), nullable=True)
    social_media = Column(Text, nullable=True)  # JSON with social links

    # Verification
    is_verified_coach = Column(Boolean, default=False)
    verification_date = Column(DateTime, nullable=True)
    verification_badge = Column(Boolean, default=False)

    # Stats
    total_athletes = Column(Integer, default=0)
    total_teams = Column(Integer, default=0)
    avg_rating = Column(Float, nullable=True)
    total_reviews = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AthleteProfile(Base):
    """Athlete-specific profile (free tier)."""
    __tablename__ = "athlete_profiles"

    id = Column(UUIDType(as_uuid=True), primary_key=True)
    user_id = Column(UUIDType(as_uuid=True), nullable=False, unique=True, index=True)

    # Athlete info
    athlete_name = Column(String(255), nullable=False)
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String(1), nullable=True)  # M/F

    # Swimming info
    primary_strokes = Column(ARRAY(String), default=[])  # ["free", "back", "breast", "fly"]
    primary_distances = Column(ARRAY(Integer), default=[])  # [100, 200, 400]
    current_best_times = Column(Text, nullable=True)  # JSON with best times

    # Coach relationship
    coach_id = Column(UUIDType(as_uuid=True), nullable=True, index=True)

    # Stats
    total_workouts = Column(Integer, default=0)
    total_times_logged = Column(Integer, default=0)
    last_workout_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
