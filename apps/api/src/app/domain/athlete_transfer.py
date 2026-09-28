"""A swimmer's history follows them to a new team, when the previous coach allowed it.

When a coach removes a swimmer and keeps their data, the athlete row is marked `portable` (the coach's
consent). If that user later joins another team, everything that is theirs moves to the new athlete:
profile facts, personal bests, race analyses, goals, heart rate and the Polar link. Training times and
meet results are tied to the old team's workouts and competitions, so those are copied into the new
team (with only this swimmer) and the times move onto the copies. The old team keeps its workouts and
competitions for its other swimmers.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from .models import Athlete, Competition, Goal, HrSession, MeetEntry, PersonalRecord, PolarLink, RaceSession, TimeLog, Workout

PROFILE_KEYS = ("gender", "license", "swimrankingsUrl", "swimrankingsSyncedAt", "groupName")


def _merge_lists(mine: list, theirs: list, key) -> list:
    seen = {key(item) for item in mine if isinstance(item, dict)}
    return mine + [item for item in theirs if isinstance(item, dict) and key(item) not in seen]


def migrate_history(session: Session, user_id: UUID, athlete: Athlete, stamp: datetime) -> int:
    """Moves every portable history of `user_id` from other teams onto `athlete`. Returns how many
    previous teams' histories were moved."""
    former = [
        row
        for row in session.scalars(select(Athlete).where(Athlete.team_id != athlete.team_id, Athlete.deleted_at.is_not(None))).all()
        if (row.extra or {}).get("formerUserId") == str(user_id) and (row.extra or {}).get("portable") and not (row.extra or {}).get("migratedTo")
    ]
    for old in former:
        _move(session, old, athlete, stamp)
    return len(former)


def _move(session: Session, old: Athlete, new: Athlete, stamp: datetime) -> None:
    team_id = new.team_id

    # Profile facts the new team doesn't have yet.
    new.date_of_birth = new.date_of_birth or old.date_of_birth
    if not new.primary_stroke and old.primary_stroke:
        new.primary_stroke = old.primary_stroke
    extra, previous = dict(new.extra or {}), dict(old.extra or {})
    for key in PROFILE_KEYS:
        if not extra.get(key) and previous.get(key):
            extra[key] = previous[key]
    extra["seedRecords"] = _merge_lists(
        list(extra.get("seedRecords") or []),
        list(previous.get("seedRecords") or []),
        lambda item: (item.get("course"), item.get("stroke"), item.get("distanceM")),
    )
    extra["wellness"] = _merge_lists(list(extra.get("wellness") or []), list(previous.get("wellness") or []), lambda item: item.get("date"))
    new.extra = extra
    flag_modified(new, "extra")

    # Training times: copy each workout they swam into the new team, then move the times onto it.
    workouts: dict[UUID, UUID] = {}
    for workout_id in set(session.scalars(select(TimeLog.workout_id).where(TimeLog.athlete_id == old.id)).all()):
        source = session.get(Workout, workout_id)
        if source is None:
            continue
        copy = Workout(
            id=uuid4(), team_id=team_id, created_by=source.created_by, title=source.title, workout_date=source.workout_date,
            shift=source.shift, athlete_ids=[new.id], blocks=source.blocks, extra={**(source.extra or {}), "importedFrom": "transfer"},
            created_at=stamp, updated_at=stamp,
        )
        session.add(copy)
        workouts[workout_id] = copy.id
    session.flush()
    for source_id, copy_id in workouts.items():
        session.execute(update(TimeLog).where(TimeLog.athlete_id == old.id, TimeLog.workout_id == source_id).values(workout_id=copy_id, athlete_id=new.id))

    # Meets: copy each competition they have entries in, then move the entries (results follow them).
    competitions: dict[UUID, UUID] = {}
    for competition_id in set(session.scalars(select(MeetEntry.competition_id).where(MeetEntry.athlete_id == old.id)).all()):
        source = session.get(Competition, competition_id)
        if source is None:
            continue
        meta = {key: value for key, value in (source.extra or {}).items() if key != "live"}
        copy = Competition(
            id=uuid4(), team_id=team_id, created_by=source.created_by, title=source.title, meet_date=source.meet_date,
            course=source.course, venue=source.venue, athlete_ids=[new.id], extra={**meta, "importedFrom": "transfer"},
            created_at=stamp, updated_at=stamp,
        )
        session.add(copy)
        competitions[competition_id] = copy.id
    session.flush()
    for source_id, copy_id in competitions.items():
        session.execute(update(MeetEntry).where(MeetEntry.athlete_id == old.id, MeetEntry.competition_id == source_id).values(competition_id=copy_id, athlete_id=new.id))

    # Everything that belongs to the swimmer alone moves as it is.
    session.execute(update(PersonalRecord).where(PersonalRecord.athlete_id == old.id).values(athlete_id=new.id))
    for row in session.scalars(select(PersonalRecord).where(PersonalRecord.athlete_id == new.id, PersonalRecord.competition_id.is_not(None))):
        row.competition_id = competitions.get(row.competition_id)
    for row in session.scalars(select(RaceSession).where(RaceSession.athlete_id == old.id)):
        row.team_id, row.athlete_id = team_id, new.id
        row.competition_id = competitions.get(row.competition_id) if row.competition_id else None
    for row in session.scalars(select(Goal).where(Goal.athlete_id == old.id)):
        row.team_id, row.athlete_id = team_id, new.id
        row.competition_id = competitions.get(row.competition_id) if row.competition_id else None
    for row in session.scalars(select(HrSession).where(HrSession.athlete_id == old.id)):
        row.team_id, row.athlete_id = team_id, new.id
        row.workout_id = workouts.get(row.workout_id) if row.workout_id else None
    link = session.get(PolarLink, old.id)
    if link is not None and session.get(PolarLink, new.id) is None:
        session.delete(link)
        session.flush()
        session.add(
            PolarLink(
                athlete_id=new.id, team_id=team_id, user_id=link.user_id, polar_user_id=link.polar_user_id, token=link.token,
                last_sync_at=link.last_sync_at, created_at=link.created_at, deleted_at=link.deleted_at,
            )
        )

    # The old team no longer lists them in those workouts / selections.
    for model in (Workout, Competition):
        for row in session.scalars(select(model).where(model.team_id == old.team_id, model.athlete_ids.any(old.id))):
            row.athlete_ids = [value for value in row.athlete_ids if value != old.id]

    marker = dict(old.extra or {})
    marker["migratedTo"] = str(new.id)
    marker["portable"] = False
    old.extra = marker
    flag_modified(old, "extra")
    old.updated_at = stamp
    session.flush()
