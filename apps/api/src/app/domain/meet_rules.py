"""Meet regulations (PDF): keep only what a coach acts on — where/when, sessions, entry deadline,
entry limits, qualifying window and format. Everything is pulled with plain patterns from the text;
if a fact isn't clearly there we leave it out rather than guess.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from uuid import uuid4

from .commands import _audit, _now
from .models import Competition
from .serializers import as_uuid, competition_out
from .splash_pdf import extract_pages

MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}
EN_MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
LONG_DATE = r"\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}"


def _clean(value: str, limit: int = 160) -> str:
    return " ".join(value.split())[:limit].strip(" .;:,")


def _between(text: str, start: str, stops: list[str], limit: int = 160) -> str | None:
    match = re.search(start + r"\s*(?P<v>.+?)(?=" + "|".join(stops) + r"|$)", text, re.IGNORECASE | re.DOTALL)
    return _clean(match["v"], limit) if match else None


def _range_dates(value: str | None) -> tuple[date, date] | None:
    if not value:
        return None
    match = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s*(?:a|-|–|e|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:de\s+|of\s+)?([a-zç]+)\s+(?:de\s+)?(\d{4})", value, re.IGNORECASE)
    if not match:
        return None
    month = MONTHS.get(match.group(3).lower()) or MONTHS.get(match.group(3).lower()[:3]) or EN_MONTHS.get(match.group(3).lower()[:3])
    if not month:
        return None
    year = int(match.group(4))
    return date(year, month, int(match.group(1))), date(year, month, int(match.group(2)))


def extract_title(text: str) -> str:
    flat = " ".join(text.split())
    match = re.search(r"(?:^|\s)[a-z]\)\s*((?:Campeonato|Torneio|Meeting|Taça|Trofeu|Troféu|Encontro|Festival)[^.:]{3,120}?)(?=Introdu|Local|Data|$)", flat)
    if match:
        return _clean(match.group(1), 120)
    match = re.search(
        r"((?:Campeonato|Torneio|Meeting|Taça|Troféu|Encontro|[A-Z][\w ]{2,40}(?:Championships?|Open|Trophy|Cup|Grand Prix))\s?[^.:]{0,100}?)(?=Introdu|Local|Data|Venue|Dates?\b|\s{2}|$)",
        flat,
    )
    return _clean(match.group(1), 120) if match else ""


def extract_rules(text: str) -> list[dict]:
    flat = " ".join(text.split())
    facts: list[dict] = []

    def add(label: str, value: str | None) -> None:
        if value and len(value) > 1:
            facts.append({"label": label, "value": value})

    # Portuguese (FPN) wording first, then the usual English wording of international meets.
    add(
        "Local",
        _between(flat, r"(?<![a-z])Local(?=[A-Z ])", [r"Informa", r"(?<![a-z])Data", r"Participa"])
        or _between(flat, r"(?<![a-z])Venue\s*:?", [r"Dates?\b", r"Pool", r"Competition", r"Entr"]),
    )
    add(
        "Datas",
        _between(flat, r"(?<![a-z])Data(?=\s?\d)", [r"Participa", r"Programa"], 60)
        or _between(flat, r"(?<![a-z])Dates?\s*:", [r"Venue", r"Pool", r"Entr", r"Programme", r"Program"], 60),
    )
    deadline_en = re.search(
        r"(?:entry|entries)\s+deadline\s*:?\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|\d{1,2}[./]\d{1,2}[./]\d{4})", flat, re.IGNORECASE
    )
    add("Prazo de inscrição", deadline_en.group(1) if deadline_en else None)

    sessions = re.findall(r"(\d{1,2}\s+[A-Z][a-z]{2})\s*(\d{1,2}h\d{2})m?\s*(\d)ª\s*Sess[aã]o", flat)
    if sessions:
        ordered = sorted({(int(n), f"{day} {hour}") for day, hour, n in sessions})
        add("Sessões", " · ".join(f"{n}ª {when}" for n, when in ordered))

    deadline = re.search(r"inscri[cç][oõ]es.{0,200}?at[eé]\s*(" + LONG_DATE + ")", flat, re.IGNORECASE)
    add("Prazo de inscrição", deadline.group(1) if deadline else None)
    where = re.search(r"inscri[cç][oõ]es.{0,120}?para\s+([\w.+-]+@[\w-]+(?:\.[a-z]+?)+?)(?=at[eé]|\s|$)", flat, re.IGNORECASE)
    add("Enviar inscrições para", where.group(1) if where else None)

    limits = re.findall(r"(Nadador(?:es)?\s+[A-Za-zÀ-ÿ ]+?)\s*:\s*at[eé]\s+(\d+)\s+provas\s+individuais", flat, re.IGNORECASE)
    if limits:
        add("Limite de provas", " · ".join(f"{who.replace('Nadador ', '').replace('Nadadores ', '').strip()}: {n}" for who, n in limits))

    window = re.search(r"entre\s+(" + LONG_DATE + r")\s+e\s+(" + LONG_DATE + ")", flat, re.IGNORECASE)
    add("Tempos de admissão válidos", f"{window.group(1)} a {window.group(2)}" if window else None)

    add("Formato (individuais)", _between(flat, r"Provas Individuais\s*:", [r"Exce[cç][aã]o", r"Provas de Estafetas", r"Limite"], 200))
    add("Exceção", _between(flat, r"Exce[cç][aã]o\s*:", [r"Provas de Estafetas", r"Limite", r"Inscri"], 200))
    add("Participação", _between(flat, r"Participa[cç][aã]o\s*:", [r"Nadadores n[aã]o", r"Programa"], 160))
    add("Prémios", _between(flat, r"Pr[eé]mios\s*:", [r"\d\.\s*ANEXOS", r"Regulamento das"], 160))
    return facts


def process_rules(session: Session, payload: dict, data: bytes, body: dict, request) -> dict:
    pages = extract_pages(data)
    facts = extract_rules("\n".join(pages[:12]))
    if len(facts) < 2:
        raise HTTPException(status_code=400, detail="Não reconheci este PDF (nem start list, nem resultados, nem regulamento).")
    dates = _range_dates(next((f["value"] for f in facts if f["label"] == "Datas"), None))
    target = None
    if body.get("competitionId"):
        target = session.get(Competition, as_uuid(body["competitionId"], "competitionId"))
        if not target or target.team_id != payload["team_uuid"] or target.deleted_at:
            raise HTTPException(status_code=404, detail="Competição não encontrada.")
    elif dates:
        candidates = session.scalars(
            select(Competition).where(
                Competition.team_id == payload["team_uuid"],
                Competition.deleted_at.is_(None),
                Competition.meet_date >= dates[0] - timedelta(days=2),
                Competition.meet_date <= dates[1] + timedelta(days=2),
            )
        ).all()
        target = candidates[0] if len(candidates) == 1 else None
    text = "\n".join(pages[:12])
    title = extract_title(text)
    venue = next((f["value"] for f in facts if f["label"] == "Local"), "")
    summary = {
        "kind": "rules",
        "facts": facts,
        "competitionId": str(target.id) if target else None,
        "createsCompetition": target is None,
        "meet": {
            "name": title,
            "city": venue,
            "course": body.get("course") if body.get("course") in ("scm", "lcm") else "lcm",
            "date": dates[0].isoformat() if dates else "",
            "endDate": dates[1].isoformat() if dates else "",
        },
    }
    if body.get("dryRun"):
        return {**summary, "status": "ready"}
    if target is None:
        # The regulations create the competition; the start list comes closer to the meet.
        name = " ".join(str(body.get("title") or title).split())[:120]
        course = body.get("course") if body.get("course") in ("scm", "lcm") else None
        start = _iso(body.get("date")) or (dates[0] if dates else None)
        end = _iso(body.get("endDate")) or (dates[1] if dates else start)
        if not name or not course or not start:
            raise HTTPException(status_code=400, detail="Confirma o nome, a piscina e as datas da competição.")
        now = _now()
        target = Competition(
            id=uuid4(),
            team_id=payload["team_uuid"],
            created_by=payload["user_id"],
            title=name,
            meet_date=start,
            course=course,
            venue=venue[:120],
            athlete_ids=[],
            extra={"endDate": (end or start).isoformat(), "source": "rules"},
            created_at=now,
            updated_at=now,
        )
        session.add(target)
        session.flush()
    extra = dict(target.extra or {})
    extra["rules"] = facts
    target.extra = extra
    flag_modified(target, "extra")
    _audit(session, payload, "meet.import_rules", "competition", target.id, request)
    return {**summary, "status": "done", "competitionId": str(target.id), "competition": competition_out(target)}


def _iso(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")
