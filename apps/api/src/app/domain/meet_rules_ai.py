"""Meet regulations read by Gemini: works for any association, country and language.

Only the regulation text is sent (public document, no athlete or team data). Returns None on any
problem — no key, timeout, quota, bad answer — so the caller falls back to the local parser.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import date

import httpx

from ..core.config import get_settings

log = logging.getLogger(__name__)

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MAX_CHARS = 40_000

PROMPT = """You read swimming competition regulations (any country, any language) and extract facts for a coach.
Return only what the document states; use null (or an empty list) for anything it does not say. Never guess.
- name: the competition's name as printed (title case, keep the edition number, e.g. "XII Meeting Internacional do Algarve").
- venue: pool / complex name; city: the city.
- startDate / endDate: days the competition itself is swum (not deadlines, not training days), YYYY-MM-DD.
- course: "lcm" for a 50 m competition pool, "scm" for 25 m. Ignore warm-up pools and pools where entry times were swum.
- lanes: number of lanes of the competition pool.
- sessions: each competition session with date (YYYY-MM-DD), start time of the races (HH:MM, not warm-up) and a short label in Portuguese (e.g. "Eliminatórias", "Finais", "Sessão A").
- entryDeadline (YYYY-MM-DD): the normal deadline to send entries (not withdrawals or changes). entryEmail: where entries are sent.
- maxEvents: individual events allowed per swimmer, short Portuguese text (e.g. "4 individuais, 2 por dia").
- entryFee: short Portuguese text (e.g. "6 € por prova individual").
- qualifyingWindow: period in which entry times must have been achieved, short Portuguese text.
- format: heats/finals format, one short Portuguese sentence.
Write every free-text value in European Portuguese."""

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "name": {"type": "STRING", "nullable": True},
        "venue": {"type": "STRING", "nullable": True},
        "city": {"type": "STRING", "nullable": True},
        "startDate": {"type": "STRING", "nullable": True},
        "endDate": {"type": "STRING", "nullable": True},
        "course": {"type": "STRING", "enum": ["lcm", "scm"], "nullable": True},
        "lanes": {"type": "INTEGER", "nullable": True},
        "sessions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {"date": {"type": "STRING"}, "time": {"type": "STRING"}, "label": {"type": "STRING", "nullable": True}},
                "required": ["date", "time"],
            },
        },
        "entryDeadline": {"type": "STRING", "nullable": True},
        "entryEmail": {"type": "STRING", "nullable": True},
        "maxEvents": {"type": "STRING", "nullable": True},
        "entryFee": {"type": "STRING", "nullable": True},
        "qualifyingWindow": {"type": "STRING", "nullable": True},
        "format": {"type": "STRING", "nullable": True},
    },
}


def _day(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def _text(value, limit: int = 160) -> str:
    return " ".join(str(value or "").split())[:limit]


def _pt(day: date) -> str:
    return day.strftime("%d/%m/%Y")


_CACHE: dict[str, dict] = {}


def read_regulations(text: str) -> dict | None:
    """{"name", "venue", "course", "dates": (start, end) | None, "facts": [...]} or None.
    Preview and confirm send the same file, so answers are kept per text for the instance's life."""
    settings = get_settings()
    if not settings.gemini_api_key or not text.strip():
        return None
    key = hashlib.sha256(text[:MAX_CHARS].encode()).hexdigest()
    if key in _CACHE:
        return _CACHE[key]
    result = _ask(text, settings)
    if result is not None:
        if len(_CACHE) > 200:
            _CACHE.clear()
        _CACHE[key] = result
    return result


def _ask(text: str, settings) -> dict | None:
    body = {
        "systemInstruction": {"parts": [{"text": PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": text[:MAX_CHARS]}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "responseSchema": SCHEMA},
    }
    try:
        response = httpx.post(
            URL.format(model=settings.gemini_model),
            json=body,
            headers={"x-goog-api-key": settings.gemini_api_key},
            timeout=40.0,
        )
        response.raise_for_status()
        raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(raw)
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
        log.warning("gemini regulations read failed: %s", type(exc).__name__)
        return None
    if not isinstance(data, dict):
        return None
    return _to_facts(data)


def _to_facts(data: dict) -> dict:
    start, end = _day(data.get("startDate")), _day(data.get("endDate"))
    if start and (not end or end < start):
        end = start
    dates = (start, end) if start and end and (end - start).days <= 14 else None
    course = data.get("course") if data.get("course") in ("lcm", "scm") else None
    venue = ", ".join(part for part in (_text(data.get("venue"), 100), _text(data.get("city"), 60)) if part)

    facts: list[dict] = []

    def add(label: str, value: str | None) -> None:
        value = _text(value, 400)
        if value:
            facts.append({"label": label, "value": value})

    add("Local", venue)
    if dates:
        add("Datas", _pt(dates[0]) if dates[0] == dates[1] else f"{_pt(dates[0])} a {_pt(dates[1])}")
    if course:
        lanes = data.get("lanes")
        add("Piscina", ("50 m" if course == "lcm" else "25 m") + (f", {int(lanes)} pistas" if isinstance(lanes, int) and 0 < lanes < 20 else ""))
    sessions = []
    for item in data.get("sessions") or []:
        day = _day(item.get("date")) if isinstance(item, dict) else None
        time = re.match(r"(\d{1,2})[:h.](\d{2})", str(item.get("time") or "")) if day else None
        if day and time:
            label = _text(item.get("label"), 30)
            sessions.append((day, int(time.group(1)), time.group(2), label))
    if sessions:
        sessions.sort(key=lambda s: (s[0], s[1], s[2]))
        add("Sessões", " · ".join(f"{d.strftime('%d/%m')} {h}h{m}" + (f" {label.lower()}" if label else "") for d, h, m, label in sessions))
    deadline = _day(data.get("entryDeadline"))
    add("Prazo de inscrição", _pt(deadline) if deadline else None)
    email = _text(data.get("entryEmail"), 120)
    add("Enviar inscrições para", email if "@" in email else None)
    add("Limite de provas", data.get("maxEvents"))
    add("Taxa de inscrição", data.get("entryFee"))
    add("Tempos de admissão válidos", data.get("qualifyingWindow"))
    add("Formato (individuais)", data.get("format"))
    return {"name": _text(data.get("name"), 120), "venue": venue, "course": course, "dates": dates, "facts": facts}
