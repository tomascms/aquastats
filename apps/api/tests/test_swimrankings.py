from app.domain.swimrankings import normalize_profile_url, parse_profile_text

SAMPLE = """Personal Bests
Event\tCourse\tTime\tPts\tDate\tCity\tMeet
50m Freestyle\t50m\t23.97\t663\t23 Jul 2026\tOeiras (POR)\tCampeonato Nacional
100m Freestyle\t50m\t51.92\t702\t26 Jul 2026\tOeiras (POR)\tCampeonato Nacional
100m Freestyle\t25m\t50.80\t690\t14 Dec 2025\tCoimbra (POR)\tNacionais Inverno
4x100m Freestyle\t50m\t3:30.00\t\t26 Jul 2026\tOeiras (POR)\tRelay
200m Medley\t25m\t2:05.11\t610\t13/12/2025\tCoimbra (POR)\tNacionais Inverno
"""


def test_parses_pb_table_and_skips_relays():
    records = {(r["course"], r["stroke"], r["distanceM"]): r for r in parse_profile_text(SAMPLE)}
    assert records[("lcm", "free", 50)]["timeS"] == 23.97
    assert records[("lcm", "free", 100)]["date"] == "2026-07-26"
    assert records[("scm", "free", 100)]["timeS"] == 50.8
    assert records[("scm", "im", 200)]["timeS"] == 125.11 and records[("scm", "im", 200)]["date"] == "2025-12-13"
    assert len(records) == 4


def test_profile_url_normalized():
    url = "https://www.swimrankings.net/index.php?page=athleteDetail&athleteId=4756749&foo=1"
    assert normalize_profile_url(url).endswith("athleteId=4756749")


def test_city_split_from_meet():
    record = parse_profile_text("100m Butterfly\t25m\t55.40\t600\t14 Dec 2025\tCoimbra (POR)\tNacionais de Inverno")[0]
    assert record["city"] == "Coimbra (POR)" and record["meet"] == "Nacionais de Inverno"
