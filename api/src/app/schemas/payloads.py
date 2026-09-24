from __future__ import annotations

from typing import Any, TypeVar
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

STROKES = frozenset({"free", "back", "breast", "fly", "im"})
SHIFTS = frozenset({"morning", "afternoon"})

T = TypeVar("T", bound=BaseModel)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def parse_body(model: type[T], raw: dict | None) -> T:
    try:
        return model.model_validate(raw or {})
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Dados inválidos.") from exc


class SaveTimeBody(StrictModel):
    id: UUID | str | None = None
    workoutId: UUID
    blockId: str = Field(min_length=1, max_length=64)
    athleteId: UUID
    repNumber: int = Field(ge=1, le=400)
    mm: int = Field(ge=0, le=99, default=0)
    ss: int = Field(ge=0, le=59, default=0)
    cc: int = Field(ge=0, le=99, default=0)
    stroke: str = "free"
    splits: list[Any] = Field(default_factory=list, max_length=64)
    recordedAt: str | None = Field(default=None, max_length=40)
    skipped: bool = False

    @field_validator("stroke")
    @classmethod
    def stroke_ok(cls, value: str) -> str:
        if value not in STROKES:
            raise ValueError("stroke")
        return value


class UpdateAthleteBody(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    dateOfBirth: str | None = Field(default=None, max_length=10)
    primaryStroke: str | None = None
    isPlaceholder: bool | None = None
    gender: str | None = Field(default=None, max_length=16)
    seedRecords: list[Any] | None = Field(default=None, max_length=64)
    wellness: list[Any] | None = Field(default=None, max_length=400)

    @field_validator("primaryStroke")
    @classmethod
    def stroke_ok(cls, value: str | None) -> str | None:
        if value is not None and value not in STROKES:
            raise ValueError("primaryStroke")
        return value


class SwimmerProfilePatch(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    dateOfBirth: str | None = Field(default=None, max_length=10)
    primaryStroke: str | None = None
    isPlaceholder: bool | None = None
    gender: str | None = Field(default=None, max_length=16)
    seedRecords: list[Any] | None = Field(default=None, max_length=64)
    wellness: list[Any] | None = Field(default=None, max_length=400)

    @field_validator("primaryStroke")
    @classmethod
    def stroke_ok(cls, value: str | None) -> str | None:
        if value is not None and value not in STROKES:
            raise ValueError("primaryStroke")
        return value


class WorkoutCreateBody(StrictModel):
    title: str | None = Field(default=None, max_length=120)
    date: str = Field(min_length=10, max_length=10)
    shift: str = "morning"
    course: str | None = None
    athleteIds: list[UUID] = Field(default_factory=list, max_length=200)
    blocks: list[Any] = Field(default_factory=list, max_length=64)

    @field_validator("shift")
    @classmethod
    def shift_ok(cls, value: str) -> str:
        if value not in SHIFTS:
            raise ValueError("shift")
        return value


class WorkoutPatchBody(StrictModel):
    title: str | None = Field(default=None, max_length=120)
    date: str | None = Field(default=None, max_length=10)
    shift: str | None = None
    course: str | None = None
    athleteIds: list[UUID] | None = Field(default=None, max_length=200)
    blocks: list[Any] | None = Field(default=None, max_length=64)


class CompetitionCreateBody(StrictModel):
    title: str | None = Field(default=None, max_length=120)
    date: str = Field(min_length=10, max_length=10)
    endDate: str | None = Field(default=None, max_length=10)
    course: str = "scm"
    venue: str | None = Field(default=None, max_length=120)
    athleteIds: list[UUID] = Field(default_factory=list, max_length=200)


class TeamPatchBody(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)


class ProfilePatchBody(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)


class ChangePasswordBody(StrictModel):
    currentPassword: str | None = Field(default=None, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)


class DeleteAccountBody(StrictModel):
    password: str | None = Field(default=None, max_length=128)
    confirm: str = Field(min_length=1, max_length=32)

    @field_validator("confirm")
    @classmethod
    def confirm_phrase(cls, value: str) -> str:
        if value.strip().upper() != "ELIMINAR":
            raise ValueError("confirm")
        return value.strip().upper()
