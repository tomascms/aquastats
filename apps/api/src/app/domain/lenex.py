"""Lenex 3 (.lxf zipped / .lef plain XML) reader for official meet results.

Only what Aquastats uses is extracted: meet name/city/course/dates, clubs, athletes and their
individual results with official splits and reaction time. Relays and non-finishing results
(DSQ, DNS, DNF, …) are skipped.
"""

from __future__ import annotations

import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass, field
from datetime import date

from defusedxml import ElementTree as SafeET  # blocks entity expansion and external entities

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_XML_BYTES = 40 * 1024 * 1024

STROKE_MAP = {"FREE": "free", "BACK": "back", "BREAST": "breast", "FLY": "fly", "MEDLEY": "im"}
COURSE_MAP = {"LCM": "lcm", "SCM": "scm", "SCY": None, "SCM16": None, "SCM20": None, "SCM33": None, "LCM50": "lcm"}
INDIVIDUAL_DISTANCES = {50, 100, 200, 400, 800, 1500}


class LenexError(ValueError):
    """Raised with a user-facing (Portuguese) message."""


@dataclass
class LenexSplit:
    at_m: int
    time_s: float


@dataclass
class LenexResult:
    stroke: str
    distance_m: int
    time_s: float
    reaction_s: float | None
    splits: list[LenexSplit]
    date: str | None
    heat: int | None = None
    lane: int | None = None
    event_number: int | None = None
    round: str = "heat"  # "heat" (eliminatória / timed final) or "final"
    place: int | None = None  # ranking within the category (age group)
    category: str | None = None  # "Juvenis", "Juniores", "Seniores", "Absolutos"…


@dataclass
class LenexEntry:
    """An inscription; heat/lane appear once the organiser has seeded the start list."""

    stroke: str
    distance_m: int
    entry_time_s: float | None
    date: str | None
    session_time: str | None
    event_number: int | None
    heat: int | None
    lane: int | None
    round: str = "heat"
    entry_course: str | None = None  # pool of the entry time: "scm" | "lcm"


@dataclass
class LenexAthlete:
    key: str
    first_name: str
    last_name: str
    birth_date: str | None
    gender: str | None
    license: str | None
    results: list[LenexResult] = field(default_factory=list)
    entries: list[LenexEntry] = field(default_factory=list)
    # PDFs only print a two-digit year of birth; kept apart so it never becomes a fake 1 January birthday.
    birth_year: int | None = None

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


@dataclass
class LenexClub:
    key: str
    name: str
    code: str | None
    nation: str | None
    athletes: list[LenexAthlete] = field(default_factory=list)
    # Lenex CLUB@type: CLUB, NATIONALTEAM, REGIONALTEAM, UNATTACHED (None when not given, e.g. PDFs).
    kind: str | None = None


@dataclass
class LenexMeet:
    name: str
    city: str
    course: str
    start: str
    end: str
    clubs: list[LenexClub]


def parse_swimtime(value: str | None) -> float | None:
    """Lenex swimtime is HH:MM:SS.hh; 'NT' means no time."""
    if not value:
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})", value.strip())
    if not match:
        return None
    hours, minutes, seconds, hundredths = (int(part) for part in match.groups())
    total = hours * 3600 + minutes * 60 + seconds + hundredths / 100
    return round(total, 2) if total > 0 else None


def parse_reaction(value: str | None) -> float | None:
    """Lenex reactiontime is signed hundredths ('+68' = 0.68 s). Negative means a false start signal."""
    if not value:
        return None
    match = re.fullmatch(r"([+-]?)(\d{1,4})", value.strip())
    if not match or match.group(1) == "-":
        return None
    seconds = int(match.group(2)) / 100
    return seconds if 0 < seconds < 2 else None


def _xml_bytes(data: bytes) -> bytes:
    if len(data) > MAX_UPLOAD_BYTES:
        raise LenexError("O ficheiro é demasiado grande (máximo 10 MB).")
    if data[:2] == b"PK":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = [info for info in archive.infolist() if info.filename.lower().endswith((".lef", ".xml"))]
                if not names:
                    raise LenexError("O ficheiro .lxf não contém resultados Lenex.")
                info = names[0]
                if info.file_size > MAX_XML_BYTES:
                    raise LenexError("O ficheiro é demasiado grande (máximo 10 MB).")
                return archive.read(info)
        except zipfile.BadZipFile as exc:
            raise LenexError("Ficheiro Lenex inválido.") from exc
    return data


@dataclass
class _Event:
    stroke: str
    distance: int
    date: str | None
    time: str | None
    number: int | None
    round: str = "heat"


def _int(value: str | None) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except ValueError:
        return None


def _date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip()[:10]).isoformat()
    except ValueError:
        return None


def parse_lenex(data: bytes) -> LenexMeet:
    xml = _xml_bytes(data)
    try:
        root = SafeET.fromstring(xml)
    except Exception as exc:  # defusedxml raises several error types (ParseError, EntitiesForbidden, …)
        raise LenexError("Ficheiro Lenex inválido.") from exc
    if root.tag.upper() != "LENEX":
        raise LenexError("Ficheiro Lenex inválido.")
    meet = root.find("./MEETS/MEET")
    if meet is None:
        raise LenexError("O ficheiro não tem nenhuma competição.")

    course = COURSE_MAP.get((meet.get("course") or "").upper())
    if course is None:
        raise LenexError("Só são suportadas piscinas de 25 e 50 m.")

    events: dict[str, _Event] = {}
    heats: dict[str, int] = {}
    places: dict[str, tuple[int, str]] = {}
    session_dates: list[str] = []
    for session in meet.findall("./SESSIONS/SESSION"):
        session_date = _date(session.get("date"))
        session_time = (session.get("daytime") or "").strip()[:5] or None
        if session_date:
            session_dates.append(session_date)
        for event in session.findall("./EVENTS/EVENT"):
            for group in event.findall("./AGEGROUPS/AGEGROUP"):
                name = (group.get("name") or "").strip()[:40]
                for ranking in group.findall("./RANKINGS/RANKING"):
                    place = _int(ranking.get("place"))
                    result_id = ranking.get("resultid")
                    # A swimmer can be ranked in several age groups (e.g. category and open): keep the first.
                    if result_id and place and place > 0 and result_id not in places:
                        places[result_id] = (place, name)
            for heat in event.findall("./HEATS/HEAT"):
                number = _int(heat.get("number"))
                if heat.get("heatid") and number:
                    heats[heat.get("heatid")] = number
            style = event.find("SWIMSTYLE")
            if style is None:
                continue
            if (_int(style.get("relaycount")) or 1) > 1:
                continue
            stroke = STROKE_MAP.get((style.get("stroke") or "").upper())
            distance = _int(style.get("distance")) or 0
            if not stroke or distance not in INDIVIDUAL_DISTANCES:
                continue
            events[event.get("eventid") or ""] = _Event(
                stroke=stroke,
                distance=distance,
                date=session_date,
                time=(event.get("daytime") or "").strip()[:5] or session_time,
                number=_int(event.get("number")),
                round="final" if (event.get("round") or "").upper() in {"FIN", "SOF"} else "heat",
            )

    clubs: list[LenexClub] = []
    for index, club in enumerate(meet.findall("./CLUBS/CLUB")):
        item = LenexClub(
            key=club.get("clubid") or f"club-{index}",
            name=(club.get("name") or club.get("shortname") or "").strip(),
            code=(club.get("code") or "").strip() or None,
            nation=(club.get("nation") or "").strip() or None,
            kind=(club.get("type") or "").strip().upper() or None,
        )
        for a_index, athlete in enumerate(club.findall("./ATHLETES/ATHLETE")):
            person = LenexAthlete(
                key=f"{item.key}:{athlete.get('athleteid') or a_index}",
                first_name=(athlete.get("firstname") or "").strip(),
                last_name=(athlete.get("lastname") or "").strip(),
                birth_date=_date(athlete.get("birthdate")),
                gender=(athlete.get("gender") or "").upper()[:1] or None,
                license=(athlete.get("license") or "").strip() or None,
            )
            for entry in athlete.findall("./ENTRIES/ENTRY"):
                event = events.get(entry.get("eventid") or "")
                if not event or (entry.get("status") or "").strip():
                    continue
                person.entries.append(
                    LenexEntry(
                        stroke=event.stroke,
                        distance_m=event.distance,
                        entry_time_s=parse_swimtime(entry.get("entrytime")),
                        date=event.date,
                        session_time=event.time,
                        event_number=event.number,
                        heat=heats.get(entry.get("heatid") or ""),
                        lane=_int(entry.get("lane")),
                        round=event.round,
                        entry_course=COURSE_MAP.get((entry.get("entrycourse") or "").upper()) or course,
                    )
                )
            for result in athlete.findall("./RESULTS/RESULT"):
                if (result.get("status") or "").strip():
                    continue  # DSQ / DNS / DNF / EXH …
                event = events.get(result.get("eventid") or "")
                time_s = parse_swimtime(result.get("swimtime"))
                if not event or not time_s:
                    continue
                stroke, distance, session_date = event.stroke, event.distance, event.date
                splits = []
                for split in result.findall("./SPLITS/SPLIT"):
                    try:
                        at_m = int(split.get("distance") or 0)
                    except ValueError:
                        continue
                    split_time = parse_swimtime(split.get("swimtime"))
                    if split_time and 0 < at_m < distance:
                        splits.append(LenexSplit(at_m=at_m, time_s=split_time))
                splits.sort(key=lambda s: s.at_m)
                person.results.append(
                    LenexResult(
                        stroke=stroke,
                        distance_m=distance,
                        time_s=time_s,
                        reaction_s=parse_reaction(result.get("reactiontime")),
                        splits=splits,
                        date=session_date,
                        heat=heats.get(result.get("heatid") or ""),
                        lane=_int(result.get("lane")),
                        event_number=event.number,
                        round=event.round,
                        place=places.get(result.get("resultid") or "", (None, None))[0],
                        category=places.get(result.get("resultid") or "", (None, None))[1],
                    )
                )
            if person.results or person.entries:
                item.athletes.append(person)
        if item.athletes:
            clubs.append(item)

    dates = sorted(set(session_dates))
    start = dates[0] if dates else date.today().isoformat()
    end = dates[-1] if dates else start
    return LenexMeet(
        name=(meet.get("name") or "").strip()[:120] or "Competição",
        city=(meet.get("city") or "").strip()[:120],
        course=course,
        start=start,
        end=end,
        clubs=clubs,
    )


def normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    return " ".join(re.findall(r"[a-z]+", text))


def name_score(a: str, b: str) -> float:
    """Token overlap (0–1): 'João Pedro Silva' vs 'Joao Silva' → 1.0 on the shorter name."""
    left, right = set(normalize_name(a).split()), set(normalize_name(b).split())
    if not left or not right:
        return 0.0
    shared = len(left & right)
    # Result PDFs abbreviate long names ("GONCALVES, F."): an initial matches a name starting with it.
    for initial in (token for token in left - right if len(token) == 1):
        if any(other.startswith(initial) for other in right - left):
            shared += 1
    for initial in (token for token in right - left if len(token) == 1):
        if any(other.startswith(initial) for other in left - right):
            shared += 1
    return min(1.0, shared / min(len(left), len(right)))
