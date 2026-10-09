from datetime import date
from types import SimpleNamespace
from uuid import uuid4

from app.domain.queries import personal_records


def test_seed_record_wins_ties_and_faster_meet_time_replaces_it():
    athlete = SimpleNamespace(
        id=uuid4(),
        extra={"seedRecords": [{"course": "LCM", "stroke": "free", "distanceM": 50, "mm": 0, "ss": 30, "cc": 0}]},
    )
    row = lambda ss: SimpleNamespace(  # noqa: E731 - a _BEST_RESULTS row
        athlete_id=athlete.id, course="LCM", stroke="free", distance_m=50, mm=0, ss=ss, cc=0,
        result_id=uuid4(), competition_id=uuid4(), meet_date=date(2026, 5, 1),
    )
    assert personal_records([row(30)], [athlete])[0]["source"] == "seed"
    best = personal_records([row(29)], [athlete])
    assert len(best) == 1 and best[0]["source"] == "meet" and best[0]["ss"] == 29 and best[0]["date"] == "2026-05-01"
