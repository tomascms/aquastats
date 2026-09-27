"""Personal bests from a SwimRankings athlete profile, pasted by the coach or the athlete.

SwimRankings forbids automated access (robots.txt and a bot check), so Aquastats never fetches it.
Instead the user opens the profile in their own browser, copies the page (Ctrl+A, Ctrl+C) and pastes it.
We read the "Personal bests" lines from that text.

Merge rules — automation never removes what people entered:
  * only the final time is taken; nothing else is touched;
  * if the team already has that swim (or a faster one) from a meet in Aquastats, it is left alone —
    that record carries splits and details the coach collected;
  * otherwise it is kept as a personal-best record (seed record) marked as coming from SwimRankings,
    and it only ever replaces an older SwimRankings value or a slower manual one.
"""

from __future__ import annotations

import re
from datetime import date
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from .commands import _audit, _now, _owned_athlete, _upsert_seed_records
from .models import Athlete, Competition, MeetEntry, MeetResult
from .serializers import athlete_out, as_uuid

STROKES = {
    "freestyle": "free", "free": "free", "livres": "free", "libre": "free", "crawl": "free",
    "backstroke": "back", "back": "back", "costas": "back", "dos": "back", "espalda": "back",
    "breaststroke": "breast", "breast": "breast", "brucos": "breast", "bruços": "breast", "brasse": "breast", "braza": "breast",
    "butterfly": "fly", "fly": "fly", "mariposa": "fly", "papillon": "fly",
    "medley": "im", "individual medley": "im", "estilos": "im", "im": "im", "4 nages": "im",
}
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
MONTHS.update({"fev": 2, "abr": 4, "mai": 5, "ago": 8, "set": 9, "out": 10, "dez": 12})
VALID = {50, 100, 200, 400, 800, 1500}
PROFILE_RE = re.compile(r"^https://www\.swimrankings\.net/index\.php\?page=athleteDetail&athleteId=\d{3,12}$")

EVENT = r"(?<![\dx×])(?P<dist>50|100|200|400|800|1500)\s*m\.?\s+(?P<stroke>Individual Medley|4 nages|[A-Za-zÀ-ÿ]+)"
COURSE = r"(?P<course>25|50)\s*m"
TIME = r"(?P<time>(?:\d{1,2}:)?\d{1,2}[.,]\d{2})"
LINE_RE = re.compile(EVENT + r"[\s\t|]+" + COURSE + r"[\s\t|]+" + TIME + r"(?P<rest>.*)$", re.IGNORECASE)
DATE_TEXT = re.compile(r"(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})")
DATE_NUM = re.compile(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})")


def normalize_profile_url(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    match = re.search(r"athleteId=(\d{3,12})", value)
    if "swimrankings.net" not in value or not match:
        raise HTTPException(status_code=400, detail="Usa o link do perfil do atleta no SwimRankings.")
    return f"https://www.swimrankings.net/index.php?page=athleteDetail&athleteId={match.group(1)}"


def _seconds(value: str) -> float:
    value = value.replace(",", ".")
    if ":" in value:
        minutes, rest = value.split(":", 1)
        return round(int(minutes) * 60 + float(rest), 2)
    return round(float(value), 2)


def _date(rest: str) -> str | None:
    match = DATE_TEXT.search(rest)
    if match and match.group(2).lower()[:3] in MONTHS:
        try:
            return date(int(match.group(3)), MONTHS[match.group(2).lower()[:3]], int(match.group(1))).isoformat()
        except ValueError:
            return None
    match = DATE_NUM.search(rest)
    if match:
        try:
            return date(int(match.group(3)), int(match.group(2)), int(match.group(1))).isoformat()
        except ValueError:
            return None
    return None


def parse_profile_text(text: str) -> list[dict]:
    """Best time per (course, stroke, distance) found in the pasted profile."""
    best: dict[tuple, dict] = {}
    for raw in (text or "")[:200_000].splitlines():
        line = " ".join(raw.replace("\t", "  ").split())
        if not line or re.search(r"\b4\s*[x×]\s*\d", line, re.IGNORECASE):
            continue  # relays
        match = LINE_RE.search(line)
        if not match:
            continue
        stroke = STROKES.get(match["stroke"].lower())
        distance = int(match["dist"])
        if not stroke or distance not in VALID or (stroke == "im" and distance in (50, 800, 1500)):
            continue
        course = "lcm" if match["course"] == "50" else "scm"
        time_s = _seconds(match["time"])
        if time_s < 18 or time_s > 2400:
            continue
        rest = match["rest"]
        meet = re.sub(r"^\s*\d{1,4}\s+", "", DATE_TEXT.sub("", DATE_NUM.sub("", rest))).strip(" -|")
        city = ""
        split = re.match(r"^(.{2,60}?\([A-Z]{3}\))\s+(.+)$", meet)
        if split:  # "Coimbra (POR) Nacionais de Inverno" -> city + meet
            city, meet = split.group(1), split.group(2)
        meet = meet[:120]
        key = (course, stroke, distance)
        if key not in best or time_s < best[key]["timeS"]:
            best[key] = {"course": course, "stroke": stroke, "distanceM": distance, "timeS": time_s, "date": _date(rest), "meet": meet, "city": city}
    return sorted(best.values(), key=lambda item: (item["course"], item["stroke"], item["distanceM"]))


def _team_bests(session: Session, athlete: Athlete) -> dict[tuple, float]:
    rows = session.execute(
        select(Competition.course, MeetEntry.stroke, MeetEntry.distance_m, MeetResult.mm, MeetResult.ss, MeetResult.cc)
        .join(MeetEntry, MeetEntry.id == MeetResult.entry_id)
        .join(Competition, Competition.id == MeetEntry.competition_id)
        .where(MeetEntry.athlete_id == athlete.id, Competition.deleted_at.is_(None))
    ).all()
    best: dict[tuple, float] = {}
    for course, stroke, distance, mm, ss, cc in rows:
        seconds = mm * 60 + ss + cc / 100
        if seconds > 0:
            key = (course, stroke, distance)
            best[key] = min(best.get(key, seconds), seconds)
    return best


def _clock(seconds: float) -> dict:
    hundredths = round(seconds * 100)
    return {"mm": hundredths // 6000, "ss": (hundredths % 6000) // 100, "cc": hundredths % 100}


def import_profile(session: Session, payload: dict, athlete_id: str, body: dict, request) -> dict:
    target = as_uuid(athlete_id, "athleteId")
    if payload.get("role") == "swimmer" and str(payload.get("athlete_uuid")) != str(target):
        raise HTTPException(status_code=403, detail="Só podes atualizar o teu perfil.")
    athlete = _owned_athlete(session, payload["team_uuid"], target)
    extra = dict(athlete.extra or {})
    if "url" in body:
        extra["swimrankingsUrl"] = normalize_profile_url(body.get("url"))

    found = parse_profile_text(str(body.get("text") or "")) if body.get("text") else []
    if body.get("text") and not found:
        raise HTTPException(status_code=400, detail="Não encontrei recordes pessoais no texto colado. Copia a página inteira do perfil (Ctrl+A, Ctrl+C).")

    team_best = _team_bests(session, athlete)
    seeds = [dict(item) for item in (extra.get("seedRecords") or []) if isinstance(item, dict)]
    added = updated = kept = 0
    report = []
    for pb in found:
        key = (pb["course"], pb["stroke"], pb["distanceM"])
        if key in team_best and team_best[key] <= pb["timeS"] + 0.005:
            kept += 1
            report.append({**pb, "action": "team"})  # already in Aquastats with its details
            continue
        existing = next((s for s in seeds if (s.get("course"), s.get("stroke"), s.get("distanceM")) == key), None)
        record = {
            "course": pb["course"],
            "stroke": pb["stroke"],
            "distanceM": pb["distanceM"],
            **_clock(pb["timeS"]),
            "date": pb["date"] or date.today().isoformat(),
            # Meet names come truncated from the profile, so only the time and date are kept.
            "source": "swimrankings",
        }
        if existing is None:
            seeds.append(record)
            added += 1
            report.append({**pb, "action": "added"})
            continue
        existing_s = int(existing.get("mm") or 0) * 60 + int(existing.get("ss") or 0) + int(existing.get("cc") or 0) / 100
        if existing.get("source") == "swimrankings" or not existing_s or pb["timeS"] < existing_s - 0.005:
            if abs(existing_s - pb["timeS"]) > 0.005:
                existing.update(record)
                updated += 1
                report.append({**pb, "action": "updated"})
                continue
        kept += 1
        report.append({**pb, "action": "kept"})

    summary = {"found": len(found), "added": added, "updated": updated, "kept": kept, "records": report}
    if body.get("dryRun"):
        return summary
    extra["seedRecords"] = seeds
    _upsert_seed_records(session, athlete.id, seeds)
    if found:
        extra["swimrankingsSyncedAt"] = _now().isoformat()
    athlete.extra = extra
    flag_modified(athlete, "extra")
    athlete.updated_at = _now()
    _audit(session, payload, "athlete.swimrankings", "athlete", athlete.id, request)
    return {**summary, "athlete": athlete_out(athlete)}

def save_record_splits(session: Session, payload: dict, athlete_id: str, body: dict, request) -> dict:
    """Splits of a SwimRankings best time, typed by the coach or the athlete. Only the splits change;
    no competition is created and the time itself is never touched."""
    from .commands import _parse_seed_splits

    target = as_uuid(athlete_id, "athleteId")
    if payload.get("role") == "swimmer" and str(payload.get("athlete_uuid")) != str(target):
        raise HTTPException(status_code=403, detail="Só podes editar os teus recordes.")
    athlete = _owned_athlete(session, payload["team_uuid"], target)
    extra = dict(athlete.extra or {})
    seeds = [dict(item) for item in extra.get("seedRecords") or [] if isinstance(item, dict)]
    key = (body.get("course"), body.get("stroke"), int(body.get("distanceM") or 0))
    seed = next((item for item in seeds if (item.get("course"), item.get("stroke"), item.get("distanceM")) == key), None)
    if seed is None:
        raise HTTPException(status_code=404, detail="Recorde não encontrado.")
    seed["splits"] = _parse_seed_splits(body.get("splits"), key[2])
    extra["seedRecords"] = seeds
    athlete.extra = extra
    flag_modified(athlete, "extra")
    _upsert_seed_records(session, athlete.id, seeds)
    _audit(session, payload, "athlete.record.splits", "athlete", athlete.id, request)
    return athlete_out(athlete)
