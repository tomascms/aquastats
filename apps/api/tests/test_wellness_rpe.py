from app.domain.commands import _parse_wellness


def test_session_rpe_is_kept_within_cr10_and_alone_is_enough():
    out = _parse_wellness([
        {"date": "2026-10-10", "rpe": 7},
        {"date": "2026-10-11", "rpe": 0},
        {"date": "2026-10-12", "rpe": 11, "sleepHours": 8},
        {"date": "2026-10-13", "rpe": "x"},
    ])
    by_day = {entry["date"]: entry for entry in out}
    assert by_day["2026-10-10"]["rpe"] == 7
    assert by_day["2026-10-11"]["rpe"] == 0
    assert by_day["2026-10-12"]["rpe"] is None and by_day["2026-10-12"]["sleepHours"] == 8
    assert "2026-10-13" not in by_day
