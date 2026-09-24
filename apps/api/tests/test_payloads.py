from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.passwords import valid_password
from app.schemas.payloads import (
    DeleteAccountBody,
    SaveTimeBody,
    SwimmerProfilePatch,
    UpdateAthleteBody,
    parse_body,
)
from app.domain.outbox import fail_outbox


def test_valid_password_requires_eight_chars_and_mix():
    assert valid_password("short") is False
    assert valid_password("abcdefgh") is False
    assert valid_password("validpass123") is True


def test_delete_account_confirm_phrase():
    body = parse_body(DeleteAccountBody, {"confirm": "ELIMINAR", "password": "validpass123"})
    assert body.confirm == "ELIMINAR"


def test_delete_account_rejects_bad_confirm():
    with pytest.raises(HTTPException):
        parse_body(DeleteAccountBody, {"confirm": "apagar"})


def test_save_time_accepts_client_metadata():
    body = parse_body(
        SaveTimeBody,
        {
            "id": str(uuid4()),
            "workoutId": str(uuid4()),
            "blockId": "main",
            "athleteId": str(uuid4()),
            "repNumber": 1,
            "mm": 0,
            "ss": 32,
            "cc": 45,
            "stroke": "free",
            "splits": [],
            "recordedAt": "2026-01-01T00:00:00.000Z",
        },
    )
    assert body.ss == 32


def test_save_time_rejects_unknown_fields():
    with pytest.raises(HTTPException):
        parse_body(
            SaveTimeBody,
            {
                "workoutId": str(uuid4()),
                "blockId": "main",
                "athleteId": str(uuid4()),
                "repNumber": 1,
                "mm": 0,
                "ss": 32,
                "cc": 45,
                "unexpected": True,
            },
        )


def test_swimmer_profile_accepts_frontend_payload():
    body = parse_body(
        SwimmerProfilePatch,
        {
            "name": "Atleta",
            "dateOfBirth": "2010-05-12",
            "primaryStroke": "free",
            "isPlaceholder": False,
            "gender": "F",
            "seedRecords": [],
        },
    )
    assert body.name == "Atleta"
    assert body.gender == "F"


def test_athlete_profile_accepts_frontend_payload():
    body = parse_body(
        UpdateAthleteBody,
        {
            "name": "Atleta",
            "dateOfBirth": "2010-05-12",
            "primaryStroke": "free",
            "isPlaceholder": False,
            "gender": "F",
            "seedRecords": [],
        },
    )
    assert body.name == "Atleta"
    assert body.seedRecords == []


def test_outbox_failure_retries_with_backoff():
    class Event:
        attempts = 2
        max_attempts = 5
        error_log = []
        status = "processing"
        next_retry_at = None

    event = Event()
    fail_outbox(None, event, RuntimeError("temporary provider error"))

    assert event.status == "pending"
    assert event.next_retry_at is not None
    assert event.error_log == ["temporary provider error"]


def test_outbox_failure_moves_to_dead_letter():
    class Event:
        attempts = 5
        max_attempts = 5
        error_log = []
        status = "processing"
        next_retry_at = None

    event = Event()
    fail_outbox(None, event, RuntimeError("permanent provider error"))

    assert event.status == "dead_letter"
    assert event.error_log == ["permanent provider error"]
