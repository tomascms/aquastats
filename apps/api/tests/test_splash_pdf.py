import pytest
from fastapi import HTTPException

from app.domain.lenex import name_score
from app.domain.live_results import normalize_url
from app.domain.splash_pdf import _result_line, _start_line

EVENT_100 = {"num": 36, "dist": 100, "stroke": "free", "gender": "M"}
EVENT_1500 = {"num": 1, "dist": 1500, "stroke": "free", "gender": "F"}


def test_result_line_with_lap_columns():
    person, result = _result_line(
        "1. TESTE, Rui Exemplo 09 Vitória Sport Clube 52.37 695 Q 25.26 27.11", EVENT_100, [50, 100], "2026-07-26", 2026
    )
    assert (person.last, person.first, person.year, person.club) == ("Teste", "Rui Exemplo", 2009, "Vitória Sport Clube")
    assert result.time_s == 52.37 and [(s.at_m, s.time_s) for s in result.splits] == [(50, 25.26)]


def test_result_line_with_nation_reaction_and_glued_club():
    person, result = _result_line(
        "34. EXEMPLO, Ana Ficticia 11 POR Academico Viseu Futebol Clube2:24.18 +0,84 471", {**EVENT_100, "dist": 200}, [], None, 2026
    )
    assert person.club == "Academico Viseu Futebol Clube" and result.time_s == 144.18 and result.reaction_s == 0.84


def test_result_line_ignores_withdrawn_and_noise():
    assert _result_line("RN 50m Open 25.25 MODELO, Ana Demo EDV Funchal 30/03/2023", EVENT_100, [], None, 2026) is None
    assert _result_line("Juvenis", EVENT_100, [], None, 2026) is None


def test_start_line_glued_lane_and_licence():
    person, entry = _start_line(
        "3AMOSTRA, Carla Demo 11 900001Porto 19:34.5350m___:___.___", EVENT_1500, 1, "2026-07-23", "9:00", 2026
    )
    assert (person.last, person.license, person.club, person.year) == ("Amostra", "900001", "Porto", 2011)
    assert (entry.lane, entry.heat, entry.entry_time_s, entry.session_time) == (3, 1, 1174.53, "9:00")
    assert _start_line("WDR6ENSAIO, Marta Demo 09 900002Colegio Efanor 18:35.1150m___", EVENT_1500, 2, None, None, 2026) is None


def test_two_digit_years_stay_in_the_past():
    person, _ = _result_line("1. PADRAO, Sara Exemplo 98 POR Os Belenenses 31.53 +0,85 419", EVENT_100, [], None, 2026)
    assert person.year == 1998


def test_abbreviated_first_name_matches():
    assert name_score("F. Exemplo", "Francisca Exemplo") == 1.0
    assert name_score("Maria Exemplo", "Francisca Exemplo") < 1.0


def test_live_url_is_restricted():
    assert normalize_url("https://live.swimrankings.net/10242/") == "https://live.swimrankings.net/10242/"
    assert normalize_url("https://live.swimrankings.net/10242/index.html") == "https://live.swimrankings.net/10242/"
    assert normalize_url("https://results.example-federation.org/2026/index.html") == "https://results.example-federation.org/2026/"
    for bad in ("http://live.swimrankings.net/1/", "https://user:pw@evil.example/1/", "https://live.swimrankings.net/../etc/", "https://x.org:8080/a/"):
        with pytest.raises(HTTPException):
            normalize_url(bad)
