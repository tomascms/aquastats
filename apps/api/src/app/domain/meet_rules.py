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


MEET_WORDS = r"(?:Campeonatos?|Torneio|Meeting|Taça|Trof[eé]u|Encontro|Festival|Open|Grand Prix)"


def extract_title(text: str) -> str:
    # A cover page usually has the name alone on a line ("Meeting Internacional do Porto").
    for line in text.splitlines()[:40]:
        line = _clean(line, 120)
        if re.match(MEET_WORDS + r"\b", line, re.IGNORECASE) and 2 <= len(line.split()) <= 12:
            return line
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
    _numbered_wording(flat, add, {f["label"] for f in facts})
    return facts


def _numeric_date(value: str) -> str:
    return re.sub(r"\s+", "", value)


def _numbered_wording(flat: str, add, seen: set[str]) -> None:
    """Regulations written as numbered clauses (ANNP / regional associations): facts sit inside
    sentences rather than after "Label:" headings."""

    def once(label: str, value: str | None) -> None:
        if label not in seen and value:
            add(label, value)
            seen.add(label)

    if "Local" not in seen:
        venue = re.search(r"\b((?:Piscina|Complexo|Centro de Nata[cç][aã]o|Est[aá]dio)\s+(?:[A-ZÀ-Ý][\w'’-]*|de|do|da|dos|das|\s)+?)(?=,|\.|\s+(?:no|na|em|com)\s|\s\d)", flat)
        city = re.search(r"Piscina[^.,]{0,60},\s+(?:no|na|em)\s+([A-ZÀ-Ý][\w-]+(?:\s[A-ZÀ-Ý][\w-]+)?)", flat)
        if venue:
            once("Local", _clean(venue.group(1)) + (f", {city.group(1)}" if city else ""))
    if "Datas" not in seen:
        span = re.search(r"\b(\d{1,2}\s*(?:a|e|-|–)\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})", flat, re.IGNORECASE)
        once("Datas", _clean(span.group(1)) if span else None)

    if re.search(r"dimens[oõ]es\s+ol[ií]mpicas|piscina\s+de\s+50\s*m", flat, re.IGNORECASE):
        lanes = re.search(r"(\d+)\s+pistas", flat)
        once("Piscina", "50 m" + (f", {lanes.group(1)} pistas" if lanes else ""))
    elif re.search(r"piscina\s+de\s+25\s*m", flat, re.IGNORECASE):
        once("Piscina", "25 m")

    num = r"(\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{4})"
    deadline = re.search(r"inscri[cç][oõ]es\s+at[eé]\s+(?:ao\s+dia\s+|dia\s+)?" + num, flat, re.IGNORECASE)
    late = re.search(r"prazo\s+extraordin[aá]rio\s+at[eé]\s+(?:ao\s+dia\s+)?" + num, flat, re.IGNORECASE)
    if deadline:
        once("Prazo de inscrição", _numeric_date(deadline.group(1)) + (f" (extraordinário até {_numeric_date(late.group(1))})" if late else ""))
    email = re.search(r"inscri[cç][oõ]es.{0,300}?\b([\w.+-]+@[\w-]+(?:\.[\w-]+)+)", flat, re.IGNORECASE)
    once("Enviar inscrições para", email.group(1).rstrip(".") if email else None)

    limit = re.search(r"(?:inscrito|participar)[^.]{0,60}?em\s+(\d+)\s+provas\s+individuais\s*(\([^)]{3,40}\))?", flat, re.IGNORECASE)
    if limit:
        once("Limite de provas", f"{limit.group(1)} individuais" + (f" {limit.group(2)}" if limit.group(2) else "") + " + estafetas")

    since = re.search(r"tempos\s+de\s+inscri[cç][aã]o.{0,120}?(?:entre|desde|a\s+partir\s+de)\s+(" + LONG_DATE + ")", flat, re.IGNORECASE)
    once("Tempos de admissão válidos", f"desde {since.group(1)}" if since else None)

    heats = re.search(r"s[eé]ries\s+eliminat[oó]rias", flat, re.IGNORECASE)
    finals = re.search(r"finais\s+A\s+e\s+B", flat, re.IGNORECASE)
    if heats and finals:
        once("Formato (individuais)", "Eliminatórias de manhã, finais A e B à tarde")
    elif heats:
        once("Formato (individuais)", "Séries eliminatórias")

    sessions = re.findall(
        r"(ELIMINAT[OÓ]RIAS|FINAIS)\s+[A-Za-zçá-]+,\s*(\d{1,2}/\d{1,2})/\d{4}\s+In[ií]cio\s+da\s+Competi[cç][aã]o\s+[aà]s\s+(\d{1,2}h\d{2})",
        flat,
        re.IGNORECASE,
    )
    if sessions:
        def when(item):
            _, day, hour = item
            d, m = day.split("/")
            h, mi = hour.split("h")
            return (int(m), int(d), int(h), int(mi))
        ordered = sorted(set(sessions), key=when)
        once("Sessões", " · ".join(f"{day} {hour} {'eliminatórias' if kind.upper().startswith('ELIM') else 'finais'}" for kind, day, hour in ordered))

    fee = re.search(r"prova\s+individual[^.]{0,80}?(\d+(?:,\d{2})?\s*€)", flat, re.IGNORECASE)
    once("Taxa de inscrição", f"{fee.group(1).replace(' ', '')} por prova individual" if fee else None)

    limits = re.findall(r"(\d{2}:\d{2},\d{2})\s+(\d{2,4})\s+(LIVRES|COSTAS|BRU[CÇ]OS|MARIPOSA|ESTILOS)\s+(\d{2}:\d{2},\d{2})", flat)
    if limits:
        def short(t: str) -> str:
            return t[3:] if t.startswith("00:") else t.lstrip("0")
        rows = [f"{d} {s.capitalize()} F {short(f)} / M {short(m)}" for f, d, s, m in limits]
        once("Tempos limite", " · ".join(rows))


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
    pool = next((f["value"] for f in facts if f["label"] == "Piscina"), "")
    detected = "lcm" if pool.startswith("50") else "scm" if pool.startswith("25") else None
    summary = {
        "kind": "rules",
        "facts": facts,
        "competitionId": str(target.id) if target else None,
        "createsCompetition": target is None,
        "meet": {
            "name": title,
            "city": venue,
            "course": body.get("course") if body.get("course") in ("scm", "lcm") else (detected or "lcm"),
            "date": dates[0].isoformat() if dates else "",
            "endDate": dates[1].isoformat() if dates else "",
        },
    }
    if body.get("dryRun"):
        return {**summary, "status": "ready"}
    if target is None:
        # The regulations create the competition; the start list comes closer to the meet.
        name = " ".join(str(body.get("title") or title).split())[:120]
        course = body.get("course") if body.get("course") in ("scm", "lcm") else detected
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
