"""Meet regulations read by Gemini: works for any association, country and language.

Only the regulation text is sent (public document, no athlete or team data). Returns None on any
problem — no key, timeout, quota, bad answer — so the caller falls back to the local parser.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import time
from datetime import date

import httpx

from ..core.config import get_settings

log = logging.getLogger(__name__)

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MAX_CHARS = 40_000

PROMPT = """You read swimming competition regulations (any country, any language) and extract facts for a coach.
Return only what the document states; use null (or an empty list) for anything it does not say. Never guess.
- name: the competition's name as printed (title case, keep the edition number, e.g. "XII Meeting Internacional do Algarve").
- venue: pool / complex name; city: the city. Keep place names exactly as printed (never translate them).
- startDate / endDate: days the competition itself is swum (not deadlines, not training days), YYYY-MM-DD.
- course: "lcm" for a 50 m competition pool, "scm" for 25 m. Ignore warm-up pools and pools where entry times were swum. Base this only on what the document itself states (e.g. "50 m", "25 m", "piscina longa/curta", course records labelled LCM/SCM) — never on what you know or assume about the venue from outside the document, even if you recognise the pool's name. If the document never states the pool length, return null: a venue can be renovated or have more than one pool, so a remembered length can be wrong.
- lanes: number of lanes of the competition pool.
- sessions: each competition session with date (YYYY-MM-DD), start time of the races (HH:MM, not warm-up) and a short label in Portuguese (e.g. "Eliminatórias", "Finais", "Sessão A"). Copy every time exactly as printed in the document; never compute, shift or estimate a time. In schedule tables the race start is the "Início"/"Start" column, not the warm-up one. If a session's start time is not printed, leave that session out.
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


MAX_PDF_BYTES = 15 * 1024 * 1024


def read_regulations(text: str, pdf: bytes | None = None) -> dict | None:
    """{"name", "venue", "course", "dates": (start, end) | None, "facts": [...]} or None.
    The PDF itself is sent when available (tables and layout are read as printed; extracted text
    breaks them). Preview and confirm send the same file, so answers are kept per file."""
    settings = get_settings()
    own = bool(settings.ai_worker_url and settings.ai_worker_key and pdf)
    if not (own or settings.gemini_api_key) or not (text.strip() or pdf):
        return None
    key = hashlib.sha256(pdf or text[:MAX_CHARS].encode()).hexdigest()
    if key in _CACHE:
        return _CACHE[key]
    small_pdf = pdf if pdf and len(pdf) <= MAX_PDF_BYTES else None
    result = (_ask_own(text, settings, small_pdf) if own and small_pdf else None) or (
        _ask(text, settings, small_pdf) if settings.gemini_api_key else None
    )
    if result is not None:
        if len(_CACHE) > 200:
            _CACHE.clear()
        _CACHE[key] = result
    return result


def _json_schema(node: dict) -> dict:
    """Gemini's schema dialect (OBJECT/STRING, nullable) → standard JSON Schema for Workers AI."""
    kind = node["type"].lower()
    out: dict = {"type": [kind, "null"] if node.get("nullable") else kind}
    if "enum" in node:
        out["enum"] = [*node["enum"], *([None] if node.get("nullable") else [])]
    if kind == "object":
        out["properties"] = {name: _json_schema(child) for name, child in node["properties"].items()}
        if node.get("required"):
            out["required"] = node["required"]
    if kind == "array":
        out["items"] = _json_schema(node["items"])
    return out


def _ask_own(text: str, settings, pdf: bytes) -> dict | None:
    """Our reader on Workers AI: PDF → Markdown (tables kept) → open model with the same schema."""
    try:
        response = httpx.post(
            settings.ai_worker_url,
            json={
                "pdf": base64.b64encode(pdf).decode(),
                "text": text[:MAX_CHARS],
                "system": PROMPT,
                "schema": {"name": "regulation", "schema": _json_schema(SCHEMA)},
            },
            headers={"x-aquastats-key": settings.ai_worker_key},
            timeout=60.0,
        )
        response.raise_for_status()
        answer = response.json()
        data, markdown = answer.get("data"), answer.get("markdown") or ""
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        log.warning("own reader failed: %s", type(exc).__name__)
        return None
    if not isinstance(data, dict):
        return None
    # Values are checked against both readings of the PDF (Markdown and extracted text).
    return _to_facts(data, " ".join((markdown + " " + text).split()))


def _ask(text: str, settings, pdf: bytes | None = None) -> dict | None:
    parts = (
        [{"inline_data": {"mime_type": "application/pdf", "data": base64.b64encode(pdf).decode()}}, {"text": "Extract the facts from this regulation."}]
        if pdf
        else [{"text": text[:MAX_CHARS]}]
    )
    body = {
        "systemInstruction": {"parts": [{"text": PROMPT}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "responseSchema": SCHEMA},
    }
    # The free tier is often busy (429/503). The full model reads tables better, so it gets a few
    # tries with a short wait before the lighter one is used.
    attempts = [(settings.gemini_model, 0), (settings.gemini_model, 2), (settings.gemini_model, 4), (settings.gemini_model, 8), ("gemini-flash-lite-latest", 0)]
    data = None
    # The coach is waiting on the preview: never more than ~40 s, then the local reading answers.
    deadline = time.monotonic() + 40
    for model, wait in attempts:
        left = deadline - time.monotonic() - wait
        if left < 5:
            break
        if wait:
            time.sleep(wait)
        try:
            response = httpx.post(URL.format(model=model), json=body, headers={"x-goog-api-key": settings.gemini_api_key}, timeout=min(30.0, left))
            response.raise_for_status()
            data = json.loads(response.json()["candidates"][0]["content"]["parts"][0]["text"])
            break
        except httpx.HTTPStatusError as exc:
            log.warning("gemini %s failed: %s", model, exc.response.status_code)
            if exc.response.status_code not in (429, 500, 503, 504):
                return None
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
            log.warning("gemini %s failed: %s", model, type(exc).__name__)
    if not isinstance(data, dict):
        return None
    return _to_facts(data, " ".join(text.split()))


# Every value the model returns is checked against the regulation text. What can't be found there
# is dropped (times, emails) or flagged for the coach to confirm (dates, names, summaries).
MONTH_WORDS = {
    1: "jan|janeiro|january|enero|janvier|gennaio|januar",
    2: "fev|fevereiro|feb|february|febrero|f[eé]vrier|febbraio|februar",
    3: "mar|mar[cç]o|march|marzo|mars|m[aä]rz",
    4: "abr|abril|apr|april|avril|aprile",
    5: "mai|maio|may|mayo|maggio",
    6: "jun|junho|june|junio|juin|giugno|juni",
    7: "jul|julho|july|julio|juillet|luglio|juli",
    8: "ago|agosto|aug|august|ao[uû]t",
    9: "set|setembro|sep|sept|september|septiembre|septembre|settembre",
    10: "out|outubro|oct|october|octubre|octobre|ottobre|okt|oktober",
    11: "nov|novembro|november|noviembre|novembre",
    12: "dez|dezembro|dec|december|diciembre|d[eé]cembre|dicembre|dezember",
}


def _time_in(flat: str, hour: int, minute: str) -> bool:
    return re.search(rf"(?<!\d)0?{hour}\s*[:hH.]\s*{minute}(?!\d)", flat) is not None


def _day_in(flat: str, day: date) -> bool:
    d, m = day.day, day.month
    numeric = rf"(?<!\d)0?{d}\s*[./-]\s*0?{m}(?!\d)"
    # "13, 14 e 15 de Novembro": the day can sit a few numbers before the month word.
    worded = rf"(?<!\d)0?{d}(?:st|nd|rd|th|\.?º)?(?:[^\d]{{0,6}}\d{{1,2}}){{0,3}}[^\d]{{0,8}}(?:{MONTH_WORDS[m]})\b"
    reverse = rf"\b(?:{MONTH_WORDS[m]})\.?\s+(?:\d{{1,2}}\D{{1,5}}){{0,3}}0?{d}(?!\d)"
    return any(re.search(p, flat, re.IGNORECASE) for p in (numeric, worded, reverse))


def _words_in(flat: str, value: str) -> bool:
    words = [w for w in re.findall(r"[\wÀ-ÿ]{3,}", value.lower()) if w not in {"das", "dos", "the", "and"}]
    lower = flat.lower()
    return not words or sum(w in lower for w in words) / len(words) >= 0.7


def _to_facts(data: dict, flat: str = "") -> dict:
    start, end = _day(data.get("startDate")), _day(data.get("endDate"))
    if start and (not end or end < start):
        end = start
    dates = (start, end) if start and end and (end - start).days <= 14 else None
    course = data.get("course") if data.get("course") in ("lcm", "scm") else None
    venue = ", ".join(part for part in (_text(data.get("venue"), 100), _text(data.get("city"), 60)) if part)
    name = _text(data.get("name"), 120)

    facts: list[dict] = []
    check: set[str] = set()

    def add(label: str, value: str | None, ok: bool = True) -> None:
        value = _text(value, 400)
        if value:
            facts.append({"label": label, "value": value, "check": not ok})

    if name and not _words_in(flat, name):
        check.add("name")
    venue_ok = _words_in(flat, venue)
    if venue and not venue_ok:
        check.add("venue")
    add("Local", venue, venue_ok)
    if dates:
        dates_ok = _day_in(flat, dates[0]) and _day_in(flat, dates[1])
        if not dates_ok:
            check.add("dates")
        add("Datas", _pt(dates[0]) if dates[0] == dates[1] else f"{_pt(dates[0])} a {_pt(dates[1])}", dates_ok)
    if course:
        lanes = data.get("lanes")
        lanes_ok = isinstance(lanes, int) and 0 < lanes < 20 and re.search(rf"(?<!\d){lanes}\s*(?:pistas|lanes|calles|couloirs|corsie|bahnen)", flat, re.IGNORECASE)
        add("Piscina", ("50 m" if course == "lcm" else "25 m") + (f", {int(lanes)} pistas" if lanes_ok else ""))
    sessions, dropped = [], 0
    for item in data.get("sessions") or []:
        day = _day(item.get("date")) if isinstance(item, dict) else None
        found = re.match(r"(\d{1,2})[:h.](\d{2})", str(item.get("time") or "")) if day else None
        if not (day and found):
            continue
        hour, minute = int(found.group(1)), found.group(2)
        if flat and not _time_in(flat, hour, minute):
            dropped += 1  # a time that isn't printed anywhere in the regulation is never shown
            continue
        sessions.append((day, hour, minute, _text(item.get("label"), 30)))
    if sessions:
        sessions.sort(key=lambda s: (s[0], s[1], s[2]))
        add("Sessões", " · ".join(f"{d.strftime('%d/%m')} {h}h{m}" + (f" {label.lower()}" if label else "") for d, h, m, label in sessions), not dropped)
    return {"name": name, "venue": venue, "course": course, "dates": dates, "facts": facts, "check": check}
