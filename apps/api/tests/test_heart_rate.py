from datetime import datetime, timedelta, timezone

import pytest

from app.domain.heart_rate import HrFileError, _local_date_and_shift, parse_file, parse_tcx

START = datetime(2026, 9, 20, 7, 0, tzinfo=timezone.utc)


def _tcx(laps: list[tuple[int, int, int]]) -> bytes:
    """laps: (offset s, duration s, bpm)."""
    body = []
    for offset, duration, bpm in laps:
        begin = START + timedelta(seconds=offset)
        points = "".join(
            f"<Trackpoint><Time>{(begin + timedelta(seconds=s)).isoformat().replace('+00:00', 'Z')}</Time>"
            f"<HeartRateBpm><Value>{bpm}</Value></HeartRateBpm></Trackpoint>"
            for s in range(0, duration, 2)
        )
        body.append(
            f'<Lap StartTime="{begin.isoformat().replace("+00:00", "Z")}"><TotalTimeSeconds>{duration}</TotalTimeSeconds>'
            f"<DistanceMeters>100</DistanceMeters><AverageHeartRateBpm><Value>{bpm}</Value></AverageHeartRateBpm>"
            f"<Track>{points}</Track></Lap>"
        )
    return (
        '<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">'
        f'<Activities><Activity Sport="Other"><Id>x</Id>{"".join(body)}</Activity></Activities></TrainingCenterDatabase>'
    ).encode()


def test_tcx_laps_and_downsampled_samples():
    parsed = parse_tcx(_tcx([(0, 60, 140), (90, 60, 165)]))
    assert parsed.started_at == START
    assert [lap.start for lap in parsed.laps] == [0, 90]
    assert [lap.avg_hr for lap in parsed.laps] == [140, 165]
    offsets = [offset for offset, _ in parsed.samples]
    assert offsets == sorted(offsets) and all(offset % 5 == 0 for offset in offsets)
    assert {bpm for _, bpm in parsed.samples} == {140, 165}


def test_parse_file_detects_format_and_rejects_others():
    assert parse_file("treino.tcx", _tcx([(0, 30, 150)])).laps
    with pytest.raises(HrFileError):
        parse_file("notas.txt", b"hello")
    with pytest.raises(HrFileError):
        parse_file("x.fit", b"\x0e\x10\x00\x00\x00\x00\x00\x00.FITgarbage")


def test_entity_expansion_is_rejected():
    bomb = b'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY b "bbbb">]><TrainingCenterDatabase>&b;</TrainingCenterDatabase>'
    with pytest.raises(HrFileError):
        parse_tcx(bomb)


def test_shift_uses_lisbon_time():
    assert _local_date_and_shift(datetime(2026, 9, 20, 6, 30, tzinfo=timezone.utc)) == ("2026-09-20", "morning")
    assert _local_date_and_shift(datetime(2026, 9, 20, 17, 0, tzinfo=timezone.utc)) == ("2026-09-20", "afternoon")
    assert _local_date_and_shift(datetime(2026, 9, 20, 23, 30, tzinfo=timezone.utc))[0] == "2026-09-21"
