"""Start lists and results printed by SPLASH Meet Manager (the FPN's software), read from the PDF.

The PDF text is regular: each page repeats the meet header, then "Prova N Femin./Masc., 100m Livres …",
the session date/time, and one line per swimmer. We turn it into the same LenexMeet structure the Lenex
importer already understands, so matching clubs/athletes and filling the competition is one code path.
Only lines we fully understand are used; everything else (records, headers, relays) is ignored.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date

from .lenex import LenexAthlete, LenexClub, LenexEntry, LenexError, LenexMeet, LenexResult, LenexSplit, normalize_name

MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_PAGES = 400

STROKES = {
    "livres": "free",
    "costas": "back",
    "brucos": "breast",
    "mariposa": "fly",
    "estilos": "im",
    # English printouts
    "freestyle": "free",
    "backstroke": "back",
    "breaststroke": "breast",
    "butterfly": "fly",
    "medley": "im",
}

TIME = r"(?:\d{1,2}:)?\d{1,2}[.,]\d{2}"
EVENT_RE = re.compile(
    r"^(?:Prova|Event)\s+(?P<num>\d+)\s*,?\s*(?P<gender>Femin|Masc|Mist|Women|Men|Mixed)\w*\.?\s*,?\s*"
    r"(?P<relay>4\s*[xX]\s*)?(?P<dist>\d{2,4})\s*m\s+(?P<stroke>[A-Za-zÀ-ÿ]+)",
    re.IGNORECASE,
)
DATE_TIME_RE = re.compile(r"(?P<d>\d{2})/(?P<m>\d{2})/(?P<y>\d{4})(?:\s*-\s*(?P<t>\d{1,2}:\d{2}))?")
HEAT_RE = re.compile(r"^(?:Série|Serie|Heat)\s+(?P<heat>\d+)\s+(?:de|of)\s+\d+", re.IGNORECASE)
MEET_DATES_RE = re.compile(r"(?P<d1>\d{1,2})(?:/(?P<m1>\d{1,2}))?\s*-\s*(?P<d2>\d{1,2})/(?P<m2>\d{1,2})/(?P<y>\d{4})")
# "Penafiel, 17 e 18 de outubro de 2026" / "31 de outubro e 1 de novembro de 2026" / "17 de outubro de 2026"
MEET_DATES_TEXT_RE = re.compile(
    r"(?P<d1>\d{1,2})(?:\s+de\s+(?P<m1>[a-zç]+))?(?:\s*(?:e|a|-)\s*(?P<d2>\d{1,2}))?\s+de\s+(?P<m2>[a-zç]+)\s+de\s+(?P<y>\d{4})",
    re.IGNORECASE,
)
MONTHS = {
    name: number
    for number, name in enumerate(
        ("janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"), 1
    )
}
# "1. SURNAME, Given 10 POR Club 28.04 +0,72 596 Q 24.65 27.26" (place/nation/reaction/points optional)
RESULT_RE = re.compile(
    rf"^(?P<status>\d+\.|EXH|WDR)?\s*(?P<last>[A-ZÀ-ÖØ-Þ'´`\-][A-ZÀ-ÖØ-Þ'´`\- ]*?),\s*(?P<first>[^\d,]*?)\s*(?P<yob>\d{{2}})\s+"
    rf"(?:(?P<nat>[A-Z]{{3}})\s+)?(?P<club>.+?)\s*(?P<time>{TIME})(?P<rest>(?:\s+.*)?)$"
)
# Newer SPLASH results: "1. Joao Exemplo, TESTE 99 900003 Naval Do Funchal 23.04 747 -A" (given names,
# SURNAME, year, optional licence, club, time, points). Ties are printed without a place.
# 2026 printouts drop the comma and put the licence before the year, as on their start lists.
RESULT_GIVEN_FIRST_RE = re.compile(
    rf"^(?P<status>\d+\.|EXH)?\s*(?P<first>[^\d,]+?)(?:,\s*|\s+)(?P<last>[A-ZÀ-ÖØ-Þ'´`\-][A-ZÀ-ÖØ-Þ'´`\- ]*?)\s+"
    rf"(?:(?P<lic_first>\d{{4,8}})\s+)?(?P<yob>\d{{2}})\s+"
    rf"(?:(?P<lic>\d{{3,8}})\s+)?(?P<club>.+?)\s+(?P<time>{TIME})(?P<rest>(?:\s+.*)?)$"
)
# "3AMOSTRA, Carla Demo 11 900001Porto 19:34.5350m___:___.___" (lane glued to the name, licence to the club)
START_RE = re.compile(
    rf"^(?P<wdr>WDR)?(?P<lane>\d)(?P<last>[A-ZÀ-ÖØ-Þ'´`\-][A-ZÀ-ÖØ-Þ'´`\- ]*?),\s*(?P<first>[^\d,]*?)\s*(?P<yob>\d{{2}})\s+"
    rf"(?P<lic>\d{{5,8}})?\s*(?P<club>.+?)\s*(?P<entry>{TIME}|NT)?\s*(?P<course>25m|50m)?_*[:._]*$"
)
# Newer SPLASH layout: "3 Marco Exemplo, DEMO 900004 06 Abs Penafiel 26.20 25m 27.53 LT" — given names
# first, SURNAME after the comma, licence before the two-digit year, optional category, then entry time,
# the pool it was swum in and the converted time. Foreign swimmers may have no licence.
# 2026 printouts drop the comma: "3 Afonso Santos LEAO 221267 12 Vilacondense 38.39 25m 38.39".
START_GIVEN_FIRST_RE = re.compile(
    rf"^(?P<lane>\d{{1,2}})\s+(?P<first>[^\d,]+?)(?:,\s*|\s+)(?P<last>[A-ZÀ-ÖØ-Þ'´`\-][A-ZÀ-ÖØ-Þ'´`\- ]*?)\s+"
    rf"(?:(?P<lic>\d{{4,8}})\s+)?(?P<yob>\d{{2}})\s+"
    rf"(?:(?:Abs\w*|Jun\w*|Juv\w*|Inf\w*|Sen\w*|Cad\w*|Mast\w*|Open|Absol\w*)\.?\s+)?"
    rf"(?P<club>.+?)\s+(?P<entry>{TIME}|NT)(?:\s+(?P<course>25m|50m))?(?:\s+(?:{TIME}|NT))?"
    rf"(?P<flags>(?:\s+(?:LT|WDR|DNS|EXH|X))*)$"
)
# "2 - 1ª Jornada - Finais 23/07/2026 - 17:00": the session tells heats from finals on start lists.
SESSION_RE = re.compile(r"^\d+\s*-\s*.*?(?P<kind>Eliminat\w*|Finais|Final|Heats|Finals)", re.IGNORECASE)
SPLIT_PAIR_RE = re.compile(rf"(?P<at>\d{{2,4}})m:\s*(?P<cum>{TIME})")
LAP_HEADER_RE = re.compile(r"\b(\d{2,4})m\b")


def _seconds(value: str) -> float:
    value = value.replace(",", ".")
    if ":" in value:
        minutes, rest = value.split(":", 1)
        return round(int(minutes) * 60 + float(rest), 2)
    return round(float(value), 2)


def _year(two: str, reference: int) -> int:
    value = int(two)
    century = reference // 100 * 100
    return century + value if century + value <= reference else century - 100 + value


def _fold(text: str) -> str:
    return normalize_name(text).replace(" ", "")


@dataclass
class _Person:
    last: str
    first: str
    year: int
    club: str
    license: str | None = None
    gender: str | None = None
    results: list[LenexResult] = field(default_factory=list)
    entries: list[LenexEntry] = field(default_factory=list)


@dataclass
class ParsedPdf:
    kind: str  # "entries" | "results"
    meet: LenexMeet


def extract_pages(data: bytes) -> list[str]:
    if len(data) > MAX_PDF_BYTES:
        raise LenexError("O ficheiro é demasiado grande (máximo 15 MB).")
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise LenexError("O PDF está protegido.")
        return [(page.extract_text() or "") for page in reader.pages[:MAX_PAGES]]
    except (PdfReadError, ValueError, KeyError, TypeError) as exc:
        raise LenexError("PDF ilegível.") from exc


def _meet_header(pages: list[str]) -> tuple[str, str, str, str]:
    # The "Splash Meet Manager …" stamp is on every page, but a cover (no text) or a legend line may come
    # first. After it: organiser (sometimes), meet name, then "City, 06 - 07/06/2026".
    lines: list[str] = []
    for page in pages[:6]:
        page_lines = [line.strip() for line in page.splitlines() if line.strip()]
        stamp = next((i for i, line in enumerate(page_lines) if "splash meet manager" in line.lower()), None)
        if stamp is not None:
            lines = page_lines[stamp:]
            break
    if not lines:
        raise LenexError("Este PDF não parece uma start list ou resultados do Splash Meet Manager.")
    place_at = next(
        (i for i, line in enumerate(lines[1:6], start=1) if MEET_DATES_RE.search(line) or _text_dates(line) or DATE_TIME_RE.search(line)),
        None,
    )
    if place_at is None:
        name = lines[1] if len(lines) > 1 else ""
        place = lines[2] if len(lines) > 2 else ""
    else:
        name, place = lines[place_at - 1], lines[place_at]
    city, start, end = place.split(",")[0].strip(), "", ""
    match = MEET_DATES_RE.search(place)
    if match:
        year, m2 = int(match["y"]), int(match["m2"])
        m1 = int(match["m1"] or m2)
        start = date(year, m1, int(match["d1"])).isoformat()
        end = date(year, m2, int(match["d2"])).isoformat()
    elif _text_dates(place):
        start, end = _text_dates(place)
    else:
        single = DATE_TIME_RE.search(place)
        if single:
            start = end = date(int(single["y"]), int(single["m"]), int(single["d"])).isoformat()
    return name, city, start, end


def _text_dates(line: str) -> tuple[str, str] | None:
    match = MEET_DATES_TEXT_RE.search(line)
    if not match:
        return None
    m2 = MONTHS.get(_fold(match["m2"]))
    m1 = MONTHS.get(_fold(match["m1"])) if match["m1"] else m2
    if not m1 or not m2:
        return None
    try:
        start = date(int(match["y"]), m1, int(match["d1"]))
        end = date(int(match["y"]), m2, int(match["d2"] or match["d1"]))
    except ValueError:
        return None
    return start.isoformat(), end.isoformat()


def parse_splash_pdf(data: bytes) -> ParsedPdf:
    pages = extract_pages(data)
    if not pages:
        raise LenexError("PDF vazio.")
    name, city, start, end = _meet_header(pages)
    reference_year = int(start[:4]) if start else date.today().year
    joined = "\n".join(pages)
    kind = "results" if re.search(r"\bResultados\b|\bResults\b|\bLugar\b", joined) else "entries"
    # Newer printouts only say it in the record lines: "Recordes Nacionais 25m Open 22.48 …".
    pool_25 = r"\b25\s*m\b.*\b(?:piscina|pool)|Piscina de 25|\(25m\)|^Recordes?\s+\w+\s+25m\b"
    course = "scm" if re.search(pool_25, joined, re.IGNORECASE | re.MULTILINE) else "lcm"

    people: dict[str, _Person] = {}
    event: dict | None = None
    event_date: str | None = None
    session_time: str | None = None
    heat: int | None = None
    session_round = "heat"
    round_ = "heat"
    lap_columns: list[int] = []
    category: str | None = None
    last_result: tuple[_Person, LenexResult] | None = None

    for page in pages:
        for raw in page.splitlines():
            line = " ".join(raw.split())
            if not line or line.startswith("Splash Meet Manager") or line.startswith("RN "):
                continue
            head = EVENT_RE.match(line)
            if head:
                stroke = STROKES.get(_fold(head["stroke"]))
                relay = bool(head["relay"])
                gender = {"f": "F", "w": "F", "m": "M"}.get(head["gender"][0].lower()) if head["gender"][:2].lower() != "mi" else None
                same_event = event is not None and event["num"] == int(head["num"])
                event = None if relay or not stroke else {"num": int(head["num"]), "dist": int(head["dist"]), "stroke": stroke, "gender": gender}
                last_result = None
                if not same_event:  # continuation pages repeat the title but not the column header
                    heat, lap_columns, category = None, [], None
                    round_ = session_round
                continue
            session_line = SESSION_RE.match(line)
            if session_line:
                session_round = "final" if session_line["kind"].lower().startswith("final") else "heat"
                round_ = session_round
                continue
            stamp = DATE_TIME_RE.match(line)
            if stamp and event is not None:
                event_date = f"{stamp['y']}-{stamp['m']}-{stamp['d']}"
                session_time = stamp["t"] or session_time
                if re.search(r"\bFinal\b", line, re.IGNORECASE):
                    round_ = "final"
                elif re.search(r"\bElimin|\bHeats?\b|\bSéries\b", line, re.IGNORECASE):
                    round_ = "heat"
                continue
            if line.startswith("Lugar") or line.startswith("Place") or line.startswith("Pista") or line.startswith("Lane"):
                lap_columns = [int(value) for value in LAP_HEADER_RE.findall(line)]
                continue
            if kind == "results" and re.fullmatch(r"(?:Juvenis|Juniores|Seniores|Absolutos|Infantis|Cadetes|Masters|Open|Sub\s?\d+|Juvenis [AB]|Infantis [AB]|Juniors|Seniors|Youth|Men|Women|Open Men|Open Women|\d{2}\s*-\s*\d{2}(?:\s*years)?)", line, re.IGNORECASE):
                category = line
                continue
            heat_line = HEAT_RE.match(line)
            if heat_line:
                heat = int(heat_line["heat"])
                continue
            if event is None:
                continue
            if kind == "results":
                pairs = SPLIT_PAIR_RE.findall(line)
                if pairs and last_result is not None and SPLIT_PAIR_RE.match(line):
                    for at, cum in pairs:
                        at_m = int(at)
                        if 0 < at_m < last_result[1].distance_m:
                            last_result[1].splits.append(LenexSplit(at_m=at_m, time_s=_seconds(cum)))
                    last_result[1].splits.sort(key=lambda split: split.at_m)
                    continue
                parsed = _result_line(line, {**event, "round": round_, "category": category}, lap_columns, event_date, reference_year)
                if parsed:
                    person, result = parsed
                    stored = _person(people, person)
                    same = [r for r in stored.results if (r.stroke, r.distance_m, r.round) == (result.stroke, result.distance_m, result.round)]
                    if same:
                        last_result = None  # the same swim printed twice (e.g. per category): keep the first
                    else:
                        stored.results.append(result)
                        last_result = (stored, result)
            else:
                parsed_entry = _start_line(line, {**event, "round": round_}, heat, event_date, session_time, reference_year)
                if parsed_entry:
                    person, entry = parsed_entry
                    stored = _person(people, person)
                    if not any((e.stroke, e.distance_m, e.round) == (entry.stroke, entry.distance_m, entry.round) for e in stored.entries):
                        stored.entries.append(entry)

    if not people:
        raise LenexError("Não encontrei nadadores neste PDF.")
    clubs: dict[str, LenexClub] = {}
    for key, person in people.items():
        club_key = _fold(person.club)
        club = clubs.setdefault(club_key, LenexClub(key=club_key, name=person.club, code=None, nation=None))
        club.athletes.append(
            LenexAthlete(
                key=key,
                first_name=person.first,
                last_name=person.last,
                birth_date=None,
                gender=person.gender,
                license=person.license,
                results=person.results,
                entries=person.entries,
                birth_year=person.year,
            )
        )
    dates = [d for person in people.values() for d in [*(r.date for r in person.results), *(e.date for e in person.entries)] if d]
    start = start or (min(dates) if dates else date.today().isoformat())
    end = end or (max(dates) if dates else start)
    return ParsedPdf(kind=kind, meet=LenexMeet(name=name, city=city, course=course, start=start, end=end, clubs=list(clubs.values())))


def _person(people: dict[str, _Person], person: _Person) -> _Person:
    key = f"{_fold(person.last)}|{_fold(person.first)[:1]}|{person.year}|{_fold(person.club)}"
    stored = people.get(key)
    if stored is None:
        people[key] = person
        return person
    if len(person.first) > len(stored.first):  # prefer the unabbreviated name
        stored.first = person.first
    stored.license = stored.license or person.license
    stored.gender = stored.gender or person.gender
    return stored


def _title(value: str) -> str:
    return " ".join(part.capitalize() for part in value.split())


def _result_line(line: str, event: dict, lap_columns: list[int], event_date: str | None, reference_year: int):
    match = RESULT_RE.match(line)
    if match and match["status"] == "WDR":
        return None
    if not match:
        match = RESULT_GIVEN_FIRST_RE.match(line)
        if not match:
            return None
    first = match["first"].strip()
    club = match["club"].strip()
    if not first or not club:
        return None
    rest = match["rest"].split()
    reaction = None
    laps: list[float] = []
    for token in rest:
        if re.fullmatch(r"[+-]\d[,.]\d{2}", token):
            value = float(token.replace(",", "."))
            reaction = value if 0 < value < 2 else None
        elif re.fullmatch(TIME, token):
            laps.append(_seconds(token))
    time_s = _seconds(match["time"])
    if time_s <= 0:
        return None
    splits: list[LenexSplit] = []
    if lap_columns and laps and len(laps) == len(lap_columns):
        # Columns are lap times when they add up to the final; cumulative when the last equals it.
        if abs(sum(laps) - time_s) <= 0.05 * len(laps):
            running = 0.0
            for at_m, lap in zip(lap_columns, laps):
                running = round(running + lap, 2)
                if at_m < event["dist"]:
                    splits.append(LenexSplit(at_m=at_m, time_s=running))
        elif abs(laps[-1] - time_s) <= 0.02:
            splits = [LenexSplit(at_m=at_m, time_s=value) for at_m, value in zip(lap_columns, laps) if at_m < event["dist"]]
    person = _Person(
        last=_title(match["last"]),
        first=first,
        year=_year(match["yob"], reference_year),
        club=club,
        license=match.groupdict().get("lic") or match.groupdict().get("lic_first"),
        gender=event["gender"],
    )
    result = LenexResult(
        stroke=event["stroke"],
        distance_m=event["dist"],
        time_s=time_s,
        reaction_s=reaction,
        splits=splits,
        date=event_date,
        event_number=event["num"],
        round=event.get("round", "heat"),
        place=int(match["status"][:-1]) if match["status"] and match["status"].endswith(".") else None,
        category=event.get("category"),
    )
    return person, result


def _start_line(line: str, event: dict, heat: int | None, event_date: str | None, session_time: str | None, reference_year: int):
    match = START_RE.match(line)
    if match and match["wdr"]:
        return None
    if not match:
        match = START_GIVEN_FIRST_RE.match(line)
        if not match or "WDR" in (match["flags"] or ""):
            return None
    first = match["first"].strip()
    club = match["club"].strip().rstrip("_:. ")
    if not first or not club:
        return None
    entry_time = None if not match["entry"] or match["entry"] == "NT" else _seconds(match["entry"])
    person = _Person(
        last=_title(match["last"]),
        first=first,
        year=_year(match["yob"], reference_year),
        club=club,
        license=match["lic"],
        gender=event["gender"],
    )
    entry = LenexEntry(
        stroke=event["stroke"],
        distance_m=event["dist"],
        entry_time_s=entry_time,
        date=event_date,
        session_time=session_time,
        event_number=event["num"],
        heat=heat,
        lane=int(match["lane"]),
        round=event.get("round", "heat"),
        entry_course={"25m": "scm", "50m": "lcm"}.get(match["course"] or ""),
    )
    return person, entry
