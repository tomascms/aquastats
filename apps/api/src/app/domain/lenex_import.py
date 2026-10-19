"""Automatic intake of official meet files (Lenex) into the team's existing competitions.

The coach drops the file the organiser published; Aquastats figures out the rest:
which club is theirs, which swimmers are theirs, which competition it belongs to, and
fills the selection, the events (with heat/lane/seed time) and the results. The coach is only
asked when something is genuinely ambiguous.
"""

from __future__ import annotations

import base64
import re
import binascii
from datetime import date
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from .commands import _audit, _now, _owned_athlete
from .lenex import LenexAthlete, LenexClub, LenexError, LenexMeet, name_score, normalize_name, parse_lenex
from .models import Athlete, Competition, MeetEntry, MeetResult, Team
from .splash_pdf import parse_splash_pdf
from .serializers import as_uuid, competition_out

CLUB_NAME_THRESHOLD = 0.5


def process_file(session: Session, payload: dict, body: dict, request) -> dict:
    """Any file the coach drops: Lenex, SPLASH start list/results PDF, or the meet regulations PDF."""
    data = _bytes(body)
    if data[:5] == b"%PDF-":
        from .meet_files_ai import looks_like_meet_file, read_meet
        from .meet_rules import detect_course, process_rules
        from .splash_pdf import _meet_header, extract_pages

        meet = None
        try:
            meet = parse_splash_pdf(data).meet
        except LenexError as exc:
            if "Splash" not in str(exc) and "nadadores" not in str(exc):
                raise HTTPException(status_code=400, detail=str(exc))
        team_id = payload["team_uuid"]
        athletes = list(session.scalars(select(Athlete).where(Athlete.team_id == team_id, Athlete.deleted_at.is_(None))))
        found = meet is not None and any(
            match_athlete(person, athletes, strict=is_selection(club))[0] is not None for club in meet.clubs for person in club.athletes
        )
        if not found:
            # Unknown layout, or none of ours found: our AI reads the lines that mention our swimmers.
            pages = extract_pages(data)
            if meet is not None or looks_like_meet_file(pages):
                try:
                    header = _meet_header(pages)
                except LenexError:
                    header = None
                course = meet.course if meet else (detect_course(" ".join(" ".join(pages[:3]).split())) or "lcm")
                ai_meet = read_meet(pages, athletes, header, course)
                if ai_meet is not None:
                    meet = ai_meet
        if meet is None:
            return process_rules(session, payload, data, body, request)
        return process_lenex(session, payload, body, request, meet=meet)
    return process_lenex(session, payload, body, request)


def _bytes(body: dict) -> bytes:
    raw = body.get("data")
    if not isinstance(raw, str) or not raw:
        raise HTTPException(status_code=400, detail="Ficheiro em falta.")
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Ficheiro inválido.")


def _decode(body: dict) -> LenexMeet:
    raw = body.get("data")
    if not isinstance(raw, str) or not raw:
        raise HTTPException(status_code=400, detail="Ficheiro em falta.")
    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Ficheiro inválido.")
    try:
        if data[:5] == b"%PDF-":
            return parse_splash_pdf(data).meet
        return parse_lenex(data)
    except LenexError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _birth_year(value) -> int | None:
    if not value:
        return None
    return value.year if isinstance(value, date) else int(str(value)[:4])


def match_athlete(person: LenexAthlete, athletes: list[Athlete], strict: bool = False) -> tuple[Athlete | None, str]:
    """Licence first; otherwise the full name AND the year of birth must match.

    A different year of birth is never accepted, however close the name. An athlete of ours without a
    date of birth can only be matched by name in our own club (`strict=False`) and only if unambiguous;
    in a selection (`strict=True`, "Miguel Oliveira — Portugal") name and year are both required.
    """
    if person.license:
        for athlete in athletes:
            if (athlete.extra or {}).get("license") == person.license:
                return athlete, "license"
    top = [a for a in athletes if name_score(person.name, a.name) >= 0.99]
    if not top:
        return None, "none"
    year = int(person.birth_date[:4]) if person.birth_date else person.birth_year
    if year:
        same_year = [a for a in top if _birth_year(a.date_of_birth) == year]
        if len(same_year) == 1:
            return same_year[0], "name+year"
        if same_year or strict:
            return None, "ambiguous" if same_year else "none"
        undated = [a for a in top if not a.date_of_birth]
        return (undated[0], "name") if len(undated) == 1 else (None, "none")
    if strict:
        return None, "none"
    return (top[0], "name") if len(top) == 1 else (None, "ambiguous")


# Selections an athlete may swim for instead of their club ("Miguel Oliveira — Portugal").
_SELECTION_WORDS = re.compile(
    r"sele[cç]{1,2}[aã]o|selec[cç]i[oó]n|s[eé]lection|national\s*team|nationalmannschaft|nazionale|seleccao|team\s+(?:portugal|spain|france)",
    re.IGNORECASE,
)
_COUNTRIES = {
    normalize_name(name)
    for name in (
        "Portugal", "Espanha", "España", "Spain", "France", "França", "Italia", "Itália", "Italy", "Germany", "Alemanha",
        "Deutschland", "Brasil", "Brazil", "Angola", "Moçambique", "Mozambique", "Cabo Verde", "Cape Verde", "Luxembourg",
        "Luxemburgo", "Ireland", "Irlanda", "Great Britain", "Grã-Bretanha", "England", "Inglaterra", "Scotland", "Escócia",
        "Wales", "Morocco", "Marrocos", "Belgium", "Bélgica", "Netherlands", "Holanda", "Países Baixos", "Switzerland",
        "Suíça", "Austria", "Áustria", "Andorra", "Macau", "Macao", "Guiné-Bissau", "São Tomé e Príncipe", "Timor-Leste",
        "Poland", "Polónia", "Czech Republic", "Chéquia", "Slovakia", "Eslováquia", "Hungary", "Hungria", "Greece", "Grécia",
        "Turkey", "Turquia", "Israel", "Norway", "Noruega", "Sweden", "Suécia", "Denmark", "Dinamarca", "Finland",
        "Finlândia", "Iceland", "Islândia", "Estonia", "Estónia", "Latvia", "Letónia", "Lithuania", "Lituânia", "Ukraine",
        "Ucrânia", "Romania", "Roménia", "Bulgaria", "Bulgária", "Serbia", "Sérvia", "Croatia", "Croácia", "Slovenia",
        "Eslovénia", "Malta", "Cyprus", "Chipre", "Gibraltar", "Faroe Islands", "USA", "United States", "Estados Unidos",
        "Canada", "Canadá", "Mexico", "México", "Argentina", "Chile", "Uruguay", "Uruguai", "Venezuela", "Colombia",
        "Colômbia", "South Africa", "África do Sul", "Australia", "Austrália", "Japan", "Japão", "China",
    )
}


def is_selection(club: LenexClub) -> bool:
    """National / regional selection rather than a club: Lenex type, a country name, the nation code
    on its own ("POR") or words like "Seleção"."""
    if club.kind in {"NATIONALTEAM", "REGIONALTEAM"}:
        return True
    name = normalize_name(club.name)
    if name in _COUNTRIES or _SELECTION_WORDS.search(club.name):
        return True
    return bool(club.nation and club.name.strip().upper() == club.nation.upper())


def _pick_club(meet: LenexMeet, team: Team | None, athletes: list[Athlete], forced: str | None) -> tuple[LenexClub | None, list[LenexClub]]:
    if forced:
        return next((club for club in meet.clubs if club.key == forced), None), meet.clubs

    def score(club: LenexClub) -> tuple[int, float]:
        known = sum(1 for person in club.athletes if match_athlete(person, athletes, strict=is_selection(club))[0] is not None)
        return known, name_score(club.name, team.name) if team else 0.0

    ranked = sorted(meet.clubs, key=score, reverse=True)
    if not ranked:
        return None, []
    known, similarity = score(ranked[0])
    runner_up = score(ranked[1]) if len(ranked) > 1 else (0, 0.0)
    if (known >= 1 and known > runner_up[0]) or similarity >= CLUB_NAME_THRESHOLD:
        return ranked[0], ranked
    return None, ranked


def _find_competition(session: Session, team_id: UUID, meet: LenexMeet) -> Competition | None:
    candidates = session.scalars(
        select(Competition).where(
            Competition.team_id == team_id,
            Competition.deleted_at.is_(None),
            Competition.meet_date >= date.fromisoformat(meet.start) - _days(3),
            Competition.meet_date <= date.fromisoformat(meet.end) + _days(3),
        )
    ).all()
    # The pool is often not printed (or misread): it only breaks ties, it never hides the coach's meet.
    candidates = [c for c in candidates if c.course == meet.course] or candidates
    if not candidates:
        return None
    exact = [c for c in candidates if normalize_name(c.title) == normalize_name(meet.name)]
    if exact:
        return exact[0]
    best = max(candidates, key=lambda c: name_score(c.title, meet.name))
    return best if name_score(best.title, meet.name) >= 0.5 or len(candidates) == 1 else None


def _days(n: int):
    from datetime import timedelta

    return timedelta(days=n)


def _seconds_of(row: MeetResult) -> float:
    return row.mm * 60 + row.ss + row.cc / 100


def _clock(seconds: float) -> dict:
    hundredths = round(seconds * 100)
    return {"mm": hundredths // 6000, "ss": (hundredths % 6000) // 100, "cc": hundredths % 100}


def process_lenex(session: Session, payload: dict, body: dict, request, meet: LenexMeet | None = None, target: Competition | None = None) -> dict:
    """dryRun=True only reports what would happen; otherwise it writes.

    `meet`/`target` are used by the live-results follower: the file is already parsed and the
    competition is known, so no guessing by name/date.
    """
    dry_run = bool(body.get("dryRun"))
    meet = meet or _decode(body)
    team_id = payload["team_uuid"]
    team = session.get(Team, team_id)
    athletes = list(session.scalars(select(Athlete).where(Athlete.team_id == team_id, Athlete.deleted_at.is_(None))))
    club, ranked = _pick_club(meet, team, athletes, body.get("clubKey"))
    kind = "results" if any(p.results for c in meet.clubs for p in c.athletes) else "entries"
    base = {
        "kind": kind,
        "meet": {"name": meet.name, "city": meet.city, "course": meet.course, "date": meet.start, "endDate": meet.end},
    }
    if club is None:
        return {
            **base,
            "status": "needsClub",
            "clubs": [{"key": c.key, "name": c.name, "code": c.code, "athletes": len(c.athletes)} for c in ranked[:30]],
        }

    overrides = body.get("mapping") if isinstance(body.get("mapping"), dict) else {}
    matched: list[tuple[LenexAthlete, Athlete]] = []
    unmatched: list[dict] = []
    for person in club.athletes:
        forced = overrides.get(person.key)
        if forced == "skip":
            continue
        athlete = _owned_athlete(session, team_id, as_uuid(forced, "athleteId")) if forced else match_athlete(person, athletes, strict=is_selection(club))[0]
        if athlete is None:
            unmatched.append({"key": person.key, "name": person.name, "birthDate": person.birth_date})
        else:
            matched.append((person, athlete))
    # Our swimmers can also swim for a selection (national / regional team). There, name AND year of
    # birth must both match, so a namesake from another country is never taken for ours.
    for other in meet.clubs:
        if other is club or not is_selection(other):
            continue
        for person in other.athletes:
            if overrides.get(person.key) == "skip":
                continue
            athlete = match_athlete(person, athletes, strict=True)[0]
            if athlete is not None and all(athlete.id != mine.id for _, mine in matched):
                matched.append((person, athlete))

    if target is None and body.get("competitionId"):
        # Dropped on a competition's page: that competition, whatever name/date/pool the file prints.
        target = session.get(Competition, as_uuid(body["competitionId"], "competitionId"))
        if not target or target.team_id != team_id or target.deleted_at:
            raise HTTPException(status_code=404, detail="Competição não encontrada.")
    competition = target or _find_competition(session, team_id, meet)
    summary = {
        **base,
        "status": "ready" if dry_run else "done",
        "club": {"key": club.key, "name": club.name},
        "competitionId": str(competition.id) if competition else None,
        "competitionTitle": competition.title if competition else meet.name,
        "createsCompetition": competition is None,
        "athletes": [{"name": athlete.name, "events": len(person.entries) + len(person.results)} for person, athlete in matched],
        "unmatched": unmatched,
        "teamAthletes": [{"id": str(a.id), "name": a.name} for a in sorted(athletes, key=lambda a: normalize_name(a.name))],
        "entries": sum(len(person.entries) for person, _ in matched),
        "results": sum(len(person.results) for person, _ in matched),
    }
    if dry_run:
        return summary

    now = _now()
    if competition is None:
        competition = Competition(
            id=uuid4(),
            team_id=team_id,
            created_by=payload["user_id"],
            title=meet.name,
            meet_date=meet.start,
            course=meet.course,
            venue=meet.city,
            athlete_ids=[],
            extra={"endDate": meet.end, "source": "lenex"},
            created_at=now,
            updated_at=now,
        )
        session.add(competition)
        session.flush()
    else:
        extra = dict(competition.extra or {})
        extra.setdefault("endDate", meet.end)
        competition.extra = extra
        if not competition.venue and meet.city:
            competition.venue = meet.city

    athlete_ids = list(competition.athlete_ids or [])
    for person, athlete in matched:
        _enrich_athlete(athlete, person)
        if athlete.id not in athlete_ids:
            athlete_ids.append(athlete.id)
        for entry in person.entries:
            row = _entry(session, competition.id, athlete.id, entry.stroke, entry.distance_m)
            if entry.round == "final":
                # Heats and final are both kept: the final is extra, never overwrites the heat.
                _merge_extra(row, {"finalHeat": entry.heat, "finalLane": entry.lane, "finalDate": entry.date, "finalTime": entry.session_time})
            else:
                _merge_extra(
                    row,
                    {
                        "heat": entry.heat,
                        "lane": entry.lane,
                        "entryTimeS": entry.entry_time_s,
                        "entryCourse": entry.entry_course,
                        "eventNumber": entry.event_number,
                        "date": entry.date,
                        "sessionTime": entry.session_time,
                    },
                )
        by_event: dict = {}
        for result in person.results:
            by_event.setdefault((result.stroke, result.distance_m), []).append(result)
        for (stroke, distance), swims in by_event.items():
            row = _entry(session, competition.id, athlete.id, stroke, distance)
            for swim in swims:
                if swim.round == "final":
                    _merge_extra(row, {"finalHeat": swim.heat, "finalLane": swim.lane, "finalDate": swim.date})
                else:
                    _merge_extra(row, {"heat": swim.heat, "lane": swim.lane, "eventNumber": swim.event_number, "date": swim.date})
            _save_result(session, payload, row, swims, now)
    competition.athlete_ids = athlete_ids
    competition.updated_at = now
    session.flush()
    _audit(session, payload, f"meet.import_{kind}", "competition", competition.id, request)
    summary["competitionId"] = str(competition.id)
    summary["competition"] = competition_out(competition)
    return summary


def _best_per_event(results: list) -> list:
    """Heats and final of the same event land on one entry: keep the fastest swim."""
    best: dict = {}
    for result in results:
        key = (result.stroke, result.distance_m)
        if key not in best or result.time_s < best[key].time_s:
            best[key] = result
    return list(best.values())


def _enrich_athlete(athlete: Athlete, person: LenexAthlete) -> None:
    extra = dict(athlete.extra or {})
    changed = False
    if person.license and extra.get("license") != person.license:
        extra["license"] = person.license
        changed = True
    if person.gender in {"M", "F"} and extra.get("gender") not in {"M", "F"}:
        extra["gender"] = person.gender
        changed = True
    if changed:
        athlete.extra = extra
        flag_modified(athlete, "extra")
    if not athlete.date_of_birth and person.birth_date:
        athlete.date_of_birth = date.fromisoformat(person.birth_date)


def _entry(session: Session, competition_id: UUID, athlete_id: UUID, stroke: str, distance_m: int) -> MeetEntry:
    row = session.scalar(
        select(MeetEntry).where(
            MeetEntry.competition_id == competition_id,
            MeetEntry.athlete_id == athlete_id,
            MeetEntry.stroke == stroke,
            MeetEntry.distance_m == distance_m,
        )
    )
    if row is None:
        row = MeetEntry(id=uuid4(), competition_id=competition_id, athlete_id=athlete_id, stroke=stroke, distance_m=distance_m, extra={})
        session.add(row)
        session.flush()
    return row


def _merge_extra(row, values: dict) -> None:
    extra = dict(row.extra or {})
    for key, value in values.items():
        if value is not None:
            extra[key] = value
    row.extra = extra
    flag_modified(row, "extra")


def _swim_out(swim) -> dict:
    return {
        "timeS": swim.time_s,
        "reactionS": swim.reaction_s,
        "heat": swim.heat,
        "lane": swim.lane,
        "date": swim.date,
        "place": swim.place,
        "category": swim.category,
    }


def _save_result(session: Session, payload: dict, entry: MeetEntry, swims: list, now) -> None:
    """One result per event: the best official swim, with the heat and the final both kept in `swims`."""
    existing = session.scalar(select(MeetResult).where(MeetResult.entry_id == entry.id))
    rounds = dict((existing.extra or {}).get("swims") or {}) if existing else {}
    for swim in swims:
        rounds[swim.round] = _swim_out(swim)
    result = min(swims, key=lambda swim: swim.time_s)
    official_best = min((item["timeS"] for item in rounds.values() if item.get("timeS")), default=result.time_s)
    splits = [{"atM": split.at_m, **_clock(split.time_s)} for split in result.splits]
    meta = {"source": "lenex", "reactionS": result.reaction_s, "date": result.date, "swims": rounds}
    clock = _clock(result.time_s)
    if existing and result.time_s > official_best + 0.001 and (existing.extra or {}).get("source") == "lenex":
        # A slower round arrived later (e.g. heats after the final): only record the round.
        existing.extra = {**(existing.extra or {}), "swims": rounds}
        flag_modified(existing, "extra")
        return
    if existing:
        existing.mm, existing.ss, existing.cc = clock["mm"], clock["ss"], clock["cc"]
        existing.splits = splits
        existing.extra = {**(existing.extra or {}), **meta}
        flag_modified(existing, "extra")
        existing.recorded_by = payload["user_id"]
        existing.recorded_at = now
        return
    session.add(MeetResult(id=uuid4(), entry_id=entry.id, splits=splits, extra=meta, recorded_by=payload["user_id"], recorded_at=now, **clock))
    session.flush()
