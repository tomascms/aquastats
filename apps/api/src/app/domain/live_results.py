"""Follows a meet's live-results page (SPLASH "live.swimrankings.net/<id>/") while the meet runs.

The coach pastes the link once on the competition. Whenever the team's app is open during the meet
(and at most every few minutes), we read the index, fetch only the start lists / result PDFs that are
new or changed, and import them through the same path as a dropped file. If the organiser publishes
the full Lenex (results.lxf) we prefer it. After the meet ends, following stops by itself.
"""

from __future__ import annotations

import hashlib
import time
import re
from datetime import date, timedelta
from urllib.parse import quote, urljoin, urlparse

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.ssrf import PinnedTransport, assert_safe_url
from .commands import _now
from .lenex import LenexAthlete, LenexClub, LenexError, LenexMeet, parse_lenex
from .lenex_import import process_lenex
from .models import Athlete, Competition
from .serializers import as_uuid
from .splash_pdf import parse_splash_pdf

LIVE_HOSTS = frozenset({"live.swimrankings.net"})
MIN_INTERVAL = timedelta(minutes=4)
MAX_FILES_PER_RUN = 200
# ponytail: runs inside the request that opened the app; a background job (Cloud Scheduler) when meets get big.
RUN_BUDGET_S = 25.0
MAX_FILE_BYTES = 15 * 1024 * 1024
LINK_RE = re.compile(r'href="([^"#?<>]+\.(?:pdf|lxf))"', re.IGNORECASE)
PER_EVENT_RE = re.compile(r"(?:^|/)(?P<kind>Start|Result)(?:List|Lists|ados?)?[_ -]?\d+[A-Za-z]?\.pdf$", re.IGNORECASE)
RESULTS_WORD_RE = re.compile(r"result|classifica", re.IGNORECASE)


def live_files(index: str) -> list[str]:
    """Files to follow, whatever the organiser calls them: a results Lenex first ("results.lxf",
    "RESULTADOS.lxf"), then per-event start lists and result lists; a single full-results PDF only when
    there are no per-event lists (it would repeat them)."""
    names = list(dict.fromkeys(LINK_RE.findall(index)))
    lenex = [n for n in names if n.lower().endswith(".lxf") and RESULTS_WORD_RE.search(n)]
    per_event = [(m["kind"].lower(), n) for n in names if (m := PER_EVENT_RE.search(n))]
    starts = [n for kind, n in per_event if kind == "start"]
    results = [n for kind, n in per_event if kind == "result"]
    if not results:
        results = [n for n in names if n.lower().endswith(".pdf") and RESULTS_WORD_RE.search(n)]
    return lenex + starts + results


def normalize_url(value: str) -> str:
    """Any SPLASH live-results index: live.swimrankings.net, or an organiser's own site abroad."""
    value = (value or "").strip()
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise HTTPException(status_code=400, detail="Usa o link dos resultados em direto (https://…).")
    path = parsed.path if parsed.path.endswith("/") else parsed.path.rsplit("/", 1)[0] + "/"
    if ".." in path or (host in LIVE_HOSTS and not re.fullmatch(r"/\d+/", path)):
        raise HTTPException(status_code=400, detail="Usa o link dos resultados em direto (https://…).")
    return f"https://{host}{path}"


def _competition(session: Session, payload: dict, competition_id: str) -> Competition:
    row = session.get(Competition, as_uuid(competition_id, "competitionId"))
    if not row or row.team_id != payload["team_uuid"] or row.deleted_at:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    return row


def sync_one(session: Session, payload: dict, competition_id: str, request) -> dict:
    row = _competition(session, payload, competition_id)
    try:
        return sync(session, payload, row, request, force=True)
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=502, detail="Não consegui abrir a página dos resultados em direto.")


def set_link(session: Session, payload: dict, competition_id: str, url: str | None) -> dict:
    row = _competition(session, payload, competition_id)
    extra = dict(row.extra or {})
    if url:
        extra["live"] = {"url": normalize_url(url), "files": {}, "lastSyncAt": None, "status": "waiting"}
    else:
        extra.pop("live", None)
    row.extra = extra
    flag_modified(row, "extra")
    return {"live": extra.get("live")}


def _active(row: Competition) -> bool:
    end = (row.extra or {}).get("endDate") or (row.meet_date.isoformat() if row.meet_date else None)
    start = row.meet_date
    today = date.today()
    if not start:
        return False
    return start - timedelta(days=2) <= today <= date.fromisoformat(str(end)[:10]) + timedelta(days=1)


def _fetch(client: httpx.Client, url: str) -> bytes:
    assert_safe_url(url, any_public_host=True)
    with client.stream("GET", url) as response:
        response.raise_for_status()
        chunks, size = [], 0
        for chunk in response.iter_bytes():
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise ValueError("file too large")
            chunks.append(chunk)
    return b"".join(chunks)


def sync(session: Session, payload: dict, row: Competition, request, force: bool = False) -> dict:
    live = dict((row.extra or {}).get("live") or {})
    if not live.get("url"):
        return {"imported": 0, "status": "off"}
    now = _now()
    last = live.get("lastSyncAt")
    if not force and last and now - _parse(last) < MIN_INTERVAL:
        return {"imported": 0, "status": live.get("status", "waiting")}
    if not force and not _active(row):
        return {"imported": 0, "status": "finished"}

    # Another request is already following this meet (it holds the row while it downloads): skip, don't wait
    # for the lock to time out into a 500.
    from sqlalchemy import select

    if session.scalar(select(Competition.id).where(Competition.id == row.id).with_for_update(skip_locked=True)) is None:
        return {"imported": 0, "status": live.get("status", "waiting")}
    # Claim the run first so concurrent page loads don't import the same files twice.
    live["lastSyncAt"] = now.isoformat()
    _store(row, live)
    session.flush()

    files: dict = dict(live.get("files") or {})
    athletes = list(session.scalars(select(Athlete).where(Athlete.team_id == row.team_id, Athlete.deleted_at.is_(None))))
    body = {"dryRun": False}
    with httpx.Client(
        transport=PinnedTransport(), timeout=10.0, follow_redirects=False, headers={"User-Agent": "Aquastats live results follower"}
    ) as client:
        index = _fetch(client, live["url"]).decode("utf-8", "ignore")
        names = live_files(index)
        # Every file is read, and all of them are imported together: one event alone may have none of our
        # swimmers, so the club and our swimmers are found across the whole meet, not file by file.
        meets: list = []
        changed = False
        deadline = time.monotonic() + RUN_BUDGET_S
        for name in names[:MAX_FILES_PER_RUN]:
            if time.monotonic() > deadline:
                # A meet is imported whole or not at all: a slow site is retried on a later visit.
                live["status"] = live.get("status", "waiting")
                _store(row, live)
                return {"imported": 0, "status": "slow"}
            try:
                data = _fetch(client, urljoin(live["url"], quote(name, safe="/%")))
            except (httpx.HTTPError, ValueError):
                continue
            digest = hashlib.sha256(data).hexdigest()[:16]
            changed = changed or files.get(name) != digest
            files[name] = digest
            meet = _read_file(name, data, athletes, row.course)
            if meet is None:
                continue  # an unreadable file (or a page not published yet) is skipped; the rest still counts
            if name.lower().endswith(".lxf"):
                meets = [meet]  # the complete, structured file wins over the per-event PDFs
                break
            meets.append(meet)
    live["files"] = files
    if not meets or not (changed or force):
        live["status"] = live.get("status", "waiting") if meets else "waiting"
        _store(row, live)
        return {"imported": 0, "status": live["status"]}
    result = process_lenex(session, payload, body, request, meet=merge_meets(meets), target=row)
    if result.get("status") == "needsClub":
        # None of our swimmers anywhere in the meet (yet): keep following quietly.
        live["status"] = "noneOfOurs"
        _store(row, live)
        return {"imported": 0, "status": "noneOfOurs"}
    live["status"] = "following"
    _store(row, live)
    return {"imported": len(result.get("athletes") or []), "status": "following"}


def _read_file(name: str, data: bytes, athletes: list, course: str | None) -> LenexMeet | None:
    """Any layout: the fixed parsers first; when they can't read the file, or read it without finding any of
    our swimmers, the lines that name our swimmers go to our own AI reader (as with a dropped file)."""
    from .lenex_import import match_athlete
    from .meet_files_ai import read_meet
    from .meet_rules import detect_course
    from .splash_pdf import _meet_header, extract_pages

    meet = None
    try:
        meet = parse_lenex(data) if name.lower().endswith(".lxf") else parse_splash_pdf(data).meet
    except LenexError:
        pass
    if name.lower().endswith(".lxf") or not athletes:
        return meet
    if meet is not None and any(match_athlete(p, athletes)[0] is not None for c in meet.clubs for p in c.athletes):
        return meet
    try:
        pages = extract_pages(data)
    except LenexError:
        return meet
    try:
        header = _meet_header(pages)
    except LenexError:
        header = None
    flat = " ".join(" ".join(pages[:3]).split())
    return read_meet(pages, athletes, header, (meet.course if meet else None) or detect_course(flat) or course or "lcm") or meet


def merge_meets(meets: list) -> LenexMeet:
    """One meet from many per-event files: clubs and swimmers merged by key, swims appended."""
    clubs: dict[str, LenexClub] = {}
    people: dict[str, LenexAthlete] = {}
    for meet in meets:
        for club in meet.clubs:
            merged = clubs.setdefault(club.key, LenexClub(key=club.key, name=club.name, code=club.code, nation=club.nation, kind=club.kind))
            for person in club.athletes:
                known = people.get(person.key)
                if known is None:
                    known = LenexAthlete(
                        key=person.key, first_name=person.first_name, last_name=person.last_name, birth_date=person.birth_date,
                        gender=person.gender, license=person.license, birth_year=person.birth_year,
                    )
                    people[person.key] = known
                    merged.athletes.append(known)
                known.license = known.license or person.license
                known.entries.extend(person.entries)
                known.results.extend(person.results)
    first = meets[0]
    starts = [m.start for m in meets if m.start]
    ends = [m.end for m in meets if m.end]
    return LenexMeet(
        name=first.name, city=first.city, course=first.course,
        start=min(starts) if starts else first.start, end=max(ends) if ends else first.end, clubs=list(clubs.values()),
    )


def sync_team(session: Session, payload: dict, request) -> dict:
    """Called when the team's app opens: follow every competition with a live link that is running now."""
    from sqlalchemy import select

    rows = session.scalars(
        select(Competition).where(
            Competition.team_id == payload["team_uuid"],
            Competition.deleted_at.is_(None),
            Competition.meet_date >= date.today() - timedelta(days=10),
            Competition.meet_date <= date.today() + timedelta(days=2),
        )
    ).all()
    imported = 0
    for row in rows:
        if not (row.extra or {}).get("live"):
            continue
        try:
            with session.begin_nested():
                imported += sync(session, payload, row, request)["imported"]
        except (httpx.HTTPError, ValueError, HTTPException):
            continue
    return {"imported": imported}


def _parse(value: str):
    from datetime import datetime

    return datetime.fromisoformat(value)


def _store(row: Competition, live: dict) -> None:
    extra = dict(row.extra or {})
    extra["live"] = live
    row.extra = extra
    flag_modified(row, "extra")
