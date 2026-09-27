"""Follows a meet's live-results page (SPLASH "live.swimrankings.net/<id>/") while the meet runs.

The coach pastes the link once on the competition. Whenever the team's app is open during the meet
(and at most every few minutes), we read the index, fetch only the start lists / result PDFs that are
new or changed, and import them through the same path as a dropped file. If the organiser publishes
the full Lenex (results.lxf) we prefer it. After the meet ends, following stops by itself.
"""

from __future__ import annotations

import hashlib
import re
from datetime import date, timedelta
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.ssrf import assert_safe_url
from .commands import _now
from .lenex import LenexError, parse_lenex
from .lenex_import import process_lenex
from .models import Competition
from .serializers import as_uuid
from .splash_pdf import parse_splash_pdf

LIVE_HOSTS = frozenset({"live.swimrankings.net"})
MIN_INTERVAL = timedelta(minutes=4)
MAX_FILES_PER_RUN = 10
MAX_FILE_BYTES = 15 * 1024 * 1024
LINK_RE = re.compile(r'href="((?:StartList|ResultList)_[0-9A-Za-z]+\.pdf|results\.lxf)"', re.IGNORECASE)


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

    # Claim the run first so concurrent page loads don't import the same files twice.
    live["lastSyncAt"] = now.isoformat()
    _store(row, live)
    session.flush()

    files: dict = dict(live.get("files") or {})
    imported = 0
    status = "waiting"
    body = {"dryRun": False}
    with httpx.Client(timeout=20.0, follow_redirects=False, headers={"User-Agent": "Aquastats live results follower"}) as client:
        index = _fetch(client, live["url"]).decode("utf-8", "ignore")
        names = list(dict.fromkeys(LINK_RE.findall(index)))
        if "results.lxf" in names:
            names = ["results.lxf"]  # the complete, structured file wins over per-event PDFs
        else:
            # Results after start lists; within each, in index order.
            names = [n for n in names if n.startswith("StartList")] + [n for n in names if n.startswith("ResultList")]
        for name in names:
            if imported >= MAX_FILES_PER_RUN:
                status = "catchingUp"
                break
            try:
                data = _fetch(client, urljoin(live["url"], name))
            except (httpx.HTTPError, ValueError):
                continue
            digest = hashlib.sha256(data).hexdigest()[:16]
            if files.get(name) == digest and not force:
                continue
            try:
                meet = parse_lenex(data) if name.endswith(".lxf") else parse_splash_pdf(data).meet
            except LenexError:
                files[name] = digest  # unreadable: don't retry the same bytes every run
                continue
            result = process_lenex(session, payload, body, request, meet=meet, target=row)
            if result.get("status") == "needsClub":
                live["status"] = "needsClub"
                live["files"] = files
                _store(row, live)
                return {"imported": imported, "status": "needsClub"}
            files[name] = digest
            imported += 1
            status = "following"
    live["files"] = files
    live["status"] = status if imported or status == "catchingUp" else live.get("status", "waiting")
    _store(row, live)
    return {"imported": imported, "status": live["status"]}


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
