"""Lenex parsing and automatic athlete matching."""
import io
import zipfile
from datetime import date
from types import SimpleNamespace

import pytest

from app.domain.lenex import LenexAthlete, LenexError, name_score, parse_lenex, parse_reaction, parse_swimtime
from app.domain.lenex_import import match_athlete

SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<LENEX version="3.0">
  <MEETS>
    <MEET name="Campeonato Regional de Inverno" city="Guimarães" course="LCM" nation="POR">
      <SESSIONS>
        <SESSION number="1" date="2026-12-12" daytime="09:30">
          <EVENTS>
            <EVENT eventid="11" number="3" daytime="10:05">
              <SWIMSTYLE distance="50" stroke="FLY" relaycount="1" />
              <HEATS><HEAT heatid="1101" number="1" /><HEAT heatid="1102" number="2" /></HEATS>
            </EVENT>
            <EVENT eventid="12" number="4">
              <SWIMSTYLE distance="100" stroke="FREE" relaycount="1" />
              <HEATS><HEAT heatid="1201" number="5" /></HEATS>
            </EVENT>
            <EVENT eventid="13" number="5">
              <SWIMSTYLE distance="50" stroke="FREE" relaycount="4" />
            </EVENT>
          </EVENTS>
        </SESSION>
        <SESSION number="2" date="2026-12-13" />
      </SESSIONS>
      <CLUBS>
        <CLUB clubid="7" name="Vitória Sport Clube" code="VSC" nation="POR">
          <ATHLETES>
            <ATHLETE athleteid="100" firstname="Tomás" lastname="Sousa" birthdate="2004-03-02" gender="M" license="123456">
              <ENTRIES>
                <ENTRY eventid="11" entrytime="00:00:25.80" heatid="1102" lane="4" />
                <ENTRY eventid="12" entrytime="00:00:53.14" heatid="1201" lane="6" />
              </ENTRIES>
              <RESULTS>
                <RESULT eventid="11" swimtime="00:00:25.73" reactiontime="+68" heatid="1102" lane="4">
                  <SPLITS><SPLIT distance="25" swimtime="00:00:11.90" /></SPLITS>
                </RESULT>
                <RESULT eventid="12" swimtime="00:00:00.00" status="DSQ" />
              </RESULTS>
            </ATHLETE>
          </ATHLETES>
        </CLUB>
        <CLUB clubid="8" name="Sporting Clube de Braga" code="SCB">
          <ATHLETES>
            <ATHLETE athleteid="200" firstname="Ana" lastname="Costa" birthdate="2008-01-01" gender="F">
              <ENTRIES><ENTRY eventid="12" entrytime="NT" /></ENTRIES>
            </ATHLETE>
          </ATHLETES>
        </CLUB>
      </CLUBS>
    </MEET>
  </MEETS>
</LENEX>
"""


def test_parses_meet_entries_results():
    meet = parse_lenex(SAMPLE.encode())
    assert (meet.name, meet.city, meet.course, meet.start, meet.end) == (
        "Campeonato Regional de Inverno",
        "Guimarães",
        "lcm",
        "2026-12-12",
        "2026-12-13",
    )
    vsc = meet.clubs[0]
    tomas = vsc.athletes[0]
    assert tomas.name == "Tomás Sousa" and tomas.license == "123456"
    fly = tomas.entries[0]
    assert (fly.stroke, fly.distance_m, fly.heat, fly.lane, fly.entry_time_s, fly.event_number, fly.session_time) == (
        "fly", 50, 2, 4, 25.8, 3, "10:05",
    )
    assert tomas.entries[1].heat == 5 and tomas.entries[1].session_time == "09:30"
    # DSQ result skipped, relay event ignored.
    assert len(tomas.results) == 1
    result = tomas.results[0]
    assert (result.time_s, result.reaction_s, result.heat, result.lane) == (25.73, 0.68, 2, 4)
    assert [(s.at_m, s.time_s) for s in result.splits] == [(25, 11.9)]
    # Entry without time (NT) is kept with no seed time.
    assert meet.clubs[1].athletes[0].entries[0].entry_time_s is None


def test_zipped_lxf_is_read():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("meet.lef", SAMPLE)
    assert parse_lenex(buffer.getvalue()).name == "Campeonato Regional de Inverno"


def test_entity_expansion_is_rejected():
    evil = """<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;">]>
    <LENEX><MEETS><MEET name="&b;" course="LCM"/></MEETS></LENEX>"""
    with pytest.raises(LenexError):
        parse_lenex(evil.encode())


def test_unsupported_pool_is_rejected():
    with pytest.raises(LenexError):
        parse_lenex(SAMPLE.replace('course="LCM"', 'course="SCY"').encode())


def test_time_parsers():
    assert parse_swimtime("00:01:02.34") == 62.34
    assert parse_swimtime("NT") is None
    assert parse_reaction("+68") == 0.68
    assert parse_reaction("-12") is None


def _athlete(name, born=None, license=None):
    return SimpleNamespace(
        id=name, name=name, date_of_birth=date.fromisoformat(born) if born else None, extra={"license": license} if license else {}
    )


def _person(first, last, born=None, license=None):
    return LenexAthlete(key="k", first_name=first, last_name=last, birth_date=born, gender="M", license=license)


def test_match_prefers_license_then_name_and_year():
    team = [_athlete("Tomás Sousa", "2004-03-02"), _athlete("Tomás Sousa", "2010-05-05"), _athlete("Rui Costa", license="999")]
    assert match_athlete(_person("Rui", "Costa Silva", license="999"), team)[0].name == "Rui Costa"
    found, how = match_athlete(_person("Tomas", "Sousa", "2004-01-01"), team)
    assert how == "name+year" and found.date_of_birth.year == 2004
    assert match_athlete(_person("Tomas", "Sousa"), team) == (None, "ambiguous")
    assert match_athlete(_person("Pedro", "Lima"), team) == (None, "none")


def test_name_score_ignores_accents_and_middle_names():
    assert name_score("João Pedro Silva", "Joao Silva") == 1.0
    assert name_score("Ana Costa", "Rui Costa") == 0.5


def _ours(name, dob):
    from datetime import date as _d
    from uuid import uuid4

    from app.domain.models import Athlete

    return Athlete(id=uuid4(), name=name, date_of_birth=_d.fromisoformat(dob) if dob else None, extra={})


def test_name_alone_is_not_enough_when_years_differ():
    from app.domain.lenex import LenexAthlete
    from app.domain.lenex_import import match_athlete

    ours = [_ours("Miguel Oliveira", "2008-03-01")]
    same = LenexAthlete(key="a", first_name="Miguel", last_name="Oliveira", birth_date="2008-03-01", gender="M", license=None)
    older = LenexAthlete(key="b", first_name="Miguel", last_name="Oliveira", birth_date="1995-06-10", gender="M", license=None)
    assert match_athlete(same, ours)[0] is ours[0]
    assert match_athlete(older, ours)[0] is None


def test_selection_needs_name_and_year():
    from app.domain.lenex import LenexAthlete, LenexClub
    from app.domain.lenex_import import is_selection, match_athlete

    assert is_selection(LenexClub(key="1", name="Portugal", code="POR", nation="POR"))
    assert is_selection(LenexClub(key="2", name="Seleção Regional do Algarve", code=None, nation="POR"))
    assert is_selection(LenexClub(key="3", name="X", code=None, nation=None, kind="NATIONALTEAM"))
    assert not is_selection(LenexClub(key="4", name="Sporting Clube de Portugal", code="SCP", nation="POR"))

    undated = [_ours("Miguel Oliveira", None)]
    person = LenexAthlete(key="c", first_name="Miguel", last_name="Oliveira", birth_date="2008-03-01", gender="M", license=None)
    assert match_athlete(person, undated)[0] is undated[0]  # own club, unambiguous
    assert match_athlete(person, undated, strict=True)[0] is None  # a selection needs the year on both sides
