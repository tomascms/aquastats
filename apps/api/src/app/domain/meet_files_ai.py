"""Start lists / programmes / results in any layout, read with our own AI (apps/ai-worker).

Used when the SPLASH parser can't read the file or doesn't find any of our swimmers. Only the lines
that mention one of our swimmers (first given name and last surname) go to the model, each with the
event, date and heat it sits under, so a 50-page programme is a few dozen lines. Every time the model
returns must be printed in its own line; athletes are then matched as usual (name + year of birth).
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

from ..core.config import get_settings
from .lenex import LenexAthlete, LenexClub, LenexEntry, LenexMeet, LenexResult, normalize_name
from .meet_rules_ai import _json_schema
from .models import Athlete

log = logging.getLogger(__name__)

MAX_LINES = 240
BATCH = 12
TIME = r"(?:\d{1,2}:)?\d{1,2}[.,]\d{2}"
STROKES = {"free", "back", "breast", "fly", "im"}

EVENT_LINE = re.compile(
    r"^(?:Prova|Event|Evento|Prueba|[ÉE]preuve|Wettkampf|Gara)\b|\b\d{2,4}\s*m\b.*\b(?:livres?|costas|bru[cç]os|mariposa|estilos|free|back|breast|fly|medley|IM|libre|espalda|braza|nage)\b",
    re.IGNORECASE,
)
HEAT_LINE = re.compile(r"^(?:S[ée]rie|Serie|Heat|Manche|Lauf|Batteria|Final\s+[AB])\b", re.IGNORECASE)
RECORD_LINE = re.compile(r"^(?:Recorde?s?|Records?|RN|RC|RR|T\.?L\.?P|Meeting Record|Tempo limite)\b", re.IGNORECASE)
DATE_LINE = re.compile(r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b")

PROMPT = """You read swimming start lists, programmes and results (any software, country or language).
Each input line is: [index] EVENT: <event header> | DATE: <date/session line> | HEAT: <heat line> | LINE: <the swimmer's line>.
Return one row per swimmer LINE that is an individual swim (skip relays, records, headers, officials).
- fullName: the swimmer's full name exactly as printed in LINE, including the comma and capitals (e.g. "Ines Exemplo, MODELO" or "MODELO, Ines Exemplo").
- birthYear: 4-digit year of birth (a 2-digit "08" means 2008, "96" means 1996); null if not printed.
- club: club or team as printed (it may be a country or a selection).
- eventNumber, distance (metres), stroke ("free","back","breast","fly","im"), gender ("M","F" or null), round ("heat" or "final"), date (YYYY-MM-DD): from the EVENT/DATE/HEAT context.
- heat, lane: numbers if printed in their own column; null otherwise. A leading "16." on a results line is the place, never the lane.
- entryTime: the entry/seed time exactly as printed (e.g. "1:05.32"), null if none or NT.
- time: the swum/final time exactly as printed in a results list, null in a start list.
- place: finishing position in results (the leading "N." of the line), null otherwise.
- lineIndex: the [index] of the line.
Copy times character by character; never compute or invent one."""

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "rows": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "lineIndex": {"type": "INTEGER"},
                    "fullName": {"type": "STRING"},
                    "birthYear": {"type": "INTEGER", "nullable": True},
                    "club": {"type": "STRING", "nullable": True},
                    "eventNumber": {"type": "INTEGER", "nullable": True},
                    "distance": {"type": "INTEGER", "nullable": True},
                    "stroke": {"type": "STRING", "nullable": True},
                    "gender": {"type": "STRING", "nullable": True},
                    "round": {"type": "STRING", "nullable": True},
                    "date": {"type": "STRING", "nullable": True},
                    "heat": {"type": "INTEGER", "nullable": True},
                    "lane": {"type": "INTEGER", "nullable": True},
                    "entryTime": {"type": "STRING", "nullable": True},
                    "time": {"type": "STRING", "nullable": True},
                    "place": {"type": "INTEGER", "nullable": True},
                },
                "required": ["lineIndex", "fullName"],
            },
        }
    },
    "required": ["rows"],
}


def looks_like_meet_file(pages: list[str]) -> bool:
    """Many swim times plus heat/lane/place vocabulary: a start list or results, not a regulation."""
    text = "\n".join(pages)
    times = len(re.findall(rf"(?<![\d:.,]){TIME}(?![\d.,])", text))
    return times >= 30 and re.search(r"S[ée]rie|Heat|Pista|Lane|Lugar|Place|Rank|Manche|Calle", text, re.IGNORECASE) is not None


def file_kind(pages: list[str]) -> str:
    """ "results" when the file reports swum times (results wording), else "entries"."""
    text = "\n".join(pages)
    if re.search(r"\b(?:Resultados|Results|R[ée]sultats|Ergebnisse|Risultati|Classifica[cç][aã]o)\b", text, re.IGNORECASE):
        return "results"
    return "entries"


def _fold(text: str) -> str:
    return normalize_name(text).replace(" ", "")


def _name_keys(athletes: list[Athlete]) -> list[tuple[str, str]]:
    """(first given name, last surname) per swimmer: both must be in a line for it to be sent."""
    keys = []
    for athlete in athletes:
        parts = normalize_name(athlete.name).split()
        if len(parts) >= 2:
            keys.append((parts[0], parts[-1]))
    return keys


def candidate_lines(pages: list[str], athletes: list[Athlete]) -> list[tuple[str, str]]:
    """(context-tagged line, raw line) for every line that names one of our swimmers."""
    wanted = _name_keys(athletes)
    event = date = heat = ""
    out: list[tuple[str, str]] = []
    for page in pages:
        for raw in page.splitlines():
            line = " ".join(raw.split())
            if not line:
                continue
            if EVENT_LINE.search(line) and not re.search(TIME, line.split(" ", 3)[-1] if len(line.split()) > 3 else ""):
                event, heat = line[:120], ""
                continue
            if HEAT_LINE.match(line):
                heat = line[:60]
                continue
            if RECORD_LINE.match(line):
                continue
            if DATE_LINE.search(line) and len(line) < 80 and not re.search(r",\s*[A-ZÀ-Þ]", line):
                date = line[:80]
                continue
            words = set(normalize_name(line).split())
            if any(first in words and last in words for first, last in wanted) and re.search(TIME + "|NT", line):
                tagged = f"[{len(out)}] EVENT: {event} | DATE: {date} | HEAT: {heat} | LINE: {line}"
                out.append((tagged, line))
                if len(out) >= MAX_LINES:
                    return out
    return out


def _seconds(value: str | None) -> float | None:
    if not value or not re.fullmatch(TIME, value.strip()):
        return None
    value = value.strip().replace(",", ".")
    if ":" in value:
        minutes, rest = value.split(":", 1)
        return round(int(minutes) * 60 + float(rest), 2)
    return round(float(value), 2)


def _printed(value: str | None, line: str) -> bool:
    if not value:
        return False
    return value.strip().replace(",", ".") in line.replace(",", ".")


def read_meet(
    pages: list[str], athletes: list[Athlete], header: tuple[str, str, str, str] | None, course: str = "lcm", kind: str | None = None
) -> LenexMeet | None:
    settings = get_settings()
    if not (settings.ai_worker_url and settings.ai_worker_key):
        return None
    lines = candidate_lines(pages, athletes)
    if not lines:
        return None
    kind = kind or file_kind(pages)
    # Small batches in parallel keep every call short; indexes are made global again afterwards.
    batches = [lines[i : i + BATCH] for i in range(0, len(lines), BATCH)]

    def ask(offset: int, batch: list[tuple[str, str]]) -> list:
        text = "\n".join(tagged.replace(f"[{offset + n}]", f"[{n}]", 1) for n, (tagged, _) in enumerate(batch))
        try:
            response = httpx.post(
                settings.ai_worker_url,
                json={"text": text, "system": PROMPT, "schema": {"name": "meet_rows", "schema": _json_schema(SCHEMA)}},
                headers={"x-aquastats-key": settings.ai_worker_key},
                timeout=60.0,
            )
            response.raise_for_status()
            rows = (response.json().get("data") or {}).get("rows") or []
        except (httpx.HTTPError, ValueError, AttributeError) as exc:
            log.warning("own meet reader failed: %s", type(exc).__name__)
            return []
        return [
            {**row, "lineIndex": offset + row["lineIndex"]}
            for row in rows
            if isinstance(row, dict) and isinstance(row.get("lineIndex"), int) and 0 <= row["lineIndex"] < len(batch)
        ]

    with ThreadPoolExecutor(max_workers=6) as pool:
        parts = list(pool.map(lambda item: ask(*item), [(i * BATCH, batch) for i, batch in enumerate(batches)]))
    rows = [row for part in parts for row in part]
    return _to_meet(rows, lines, header, course, kind) if rows else None


def _split_name(full: str) -> tuple[str, str]:
    """ "Ines Exemplo, MODELO" / "MODELO, Ines Exemplo" / "Ines Modelo" → (given names, surname).
    The capitalised part is the surname; without a comma the last word is."""
    full = " ".join(full.split())
    if "," in full:
        left, right = (part.strip() for part in full.split(",", 1))
        left_caps = left.upper() == left and any(c.isalpha() for c in left)
        right_caps = right.upper() == right and any(c.isalpha() for c in right)
        last, first = (left, right) if left_caps and not right_caps else (right, left)
        return first, " ".join(part.capitalize() for part in last.split())
    parts = full.split()
    return (" ".join(parts[:-1]), parts[-1]) if len(parts) >= 2 else ("", "")


def _to_meet(
    rows: list, lines: list[tuple[str, str]], header: tuple[str, str, str, str] | None, course: str = "lcm", kind: str = "entries"
) -> LenexMeet | None:
    clubs: dict[str, LenexClub] = {}
    people: dict[str, LenexAthlete] = {}
    dates: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        index = row.get("lineIndex")
        if not isinstance(index, int) or not 0 <= index < len(lines):
            continue
        tagged, source = lines[index]
        first, last = _split_name(str(row.get("fullName") or ""))
        stroke, distance = row.get("stroke"), row.get("distance")
        # The swimmer's name must be in their own line and the event must be a known individual event.
        if not first or not last or _fold(last)[:4] not in _fold(source) or stroke not in STROKES or not isinstance(distance, int):
            continue
        year = row.get("birthYear") if isinstance(row.get("birthYear"), int) and 1930 < row["birthYear"] < 2030 else None
        club_name = str(row.get("club") or "").strip() or "—"
        # The date printed above the swimmer's line wins over the model's reading of it.
        printed = re.search(r"DATE: [^|]*?\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", tagged)
        if printed and 1990 < int(printed.group(3)) < 2100:
            date = f"{printed.group(3)}-{int(printed.group(2)):02d}-{int(printed.group(1)):02d}"
        else:
            raw_date = str(row.get("date") or "")[:10]
            date = raw_date if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date) else None
        if date:
            dates.append(date)
        round_ = "final" if row.get("round") == "final" else "heat"
        key = f"ai:{_fold(last)}|{_fold(first)[:1]}|{year}|{_fold(club_name)}"
        person = people.get(key)
        if person is None:
            club = clubs.setdefault(_fold(club_name), LenexClub(key=_fold(club_name), name=club_name, code=None, nation=None))
            gender = row.get("gender") if row.get("gender") in ("M", "F") else None
            person = LenexAthlete(key=key, first_name=first, last_name=last, birth_date=None, gender=gender, license=None, birth_year=year)
            people[key] = person
            club.athletes.append(person)
        heat = row.get("heat") if isinstance(row.get("heat"), int) else None
        lane = row.get("lane") if isinstance(row.get("lane"), int) else None
        number = row.get("eventNumber") if isinstance(row.get("eventNumber"), int) else None
        # A time is only kept if it is printed, character for character, in the swimmer's line; whether
        # it is a result or an entry time is decided by the file, not by the model.
        printed_time = row.get("time") if _printed(row.get("time"), source) else None
        printed_entry = row.get("entryTime") if _printed(row.get("entryTime"), source) else None
        swum = _seconds(printed_time or printed_entry) if kind == "results" else None
        entry = None if kind == "results" else _seconds(printed_entry or printed_time)
        if swum:
            if not any((r.stroke, r.distance_m, r.round) == (stroke, distance, round_) for r in person.results):
                place = row.get("place") if isinstance(row.get("place"), int) else None
                person.results.append(
                    LenexResult(
                        stroke=stroke, distance_m=distance, time_s=swum, reaction_s=None, splits=[], date=date,
                        heat=heat, lane=lane, event_number=number, round=round_, place=place,
                    )
                )
        elif not any((e.stroke, e.distance_m, e.round) == (stroke, distance, round_) for e in person.entries):
            person.entries.append(
                LenexEntry(
                    stroke=stroke, distance_m=distance, entry_time_s=entry, date=date, session_time=None,
                    event_number=number, heat=heat, lane=lane, round=round_,
                )
            )
    if not people:
        return None
    name, city, start, end = header or ("", "", "", "")
    start = start or (min(dates) if dates else "")
    end = end or (max(dates) if dates else start)
    if not start:
        return None
    return LenexMeet(name=name, city=city, course=course, start=start, end=end, clubs=list(clubs.values()))
