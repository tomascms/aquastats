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
from .meet_rules_ai import read_regulations
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


def _month(word: str) -> int | None:
    word = word.lower()
    return MONTHS.get(word) or MONTHS.get(word[:3]) or EN_MONTHS.get(word[:3])


def _safe(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


ORD = r"(?:st|nd|rd|th|\.?º)?"
SEP = r"\s*(?:a|e|-|–|to|and|&)\s*"
_DATE_PATTERNS = [
    # 30 de maio a 1 de junho de 2026 · 30 May - 1 June 2026
    (rf"(\d{{1,2}}){ORD}\s+(?:de\s+)?([a-zç]+){SEP}(\d{{1,2}}){ORD}\s+(?:de\s+)?([a-zç]+)\s+(?:de\s+)?(\d{{4}})", "dm-dm-y"),
    # 6 e 7 de junho de 2026 · 6, 7 e 8 de junho de 2026 · 6-7 June 2026
    (rf"(\d{{1,2}}){ORD}(?:\s*,\s*\d{{1,2}}{ORD})*{SEP}(\d{{1,2}}){ORD}\s+(?:de\s+|of\s+)?([a-zç]+),?\s+(?:de\s+)?(\d{{4}})", "d-d-m-y"),
    # June 6-7, 2026
    (rf"([A-Za-z]+)\s+(\d{{1,2}}){ORD}{SEP}(\d{{1,2}}){ORD},?\s+(\d{{4}})", "m-d-d-y"),
    # 06/06/2026 a 07/06/2026
    (r"(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})" + SEP + r"(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})", "n-n"),
    # 6 e 7/06/2026
    (r"(\d{1,2})" + SEP + r"(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})", "d-d/m/y"),
    # 6 de junho de 2026 · June 6, 2026 · 06/06/2026 (single day)
    (rf"(\d{{1,2}}){ORD}\s+(?:de\s+|of\s+)?([a-zç]+),?\s+(?:de\s+)?(\d{{4}})", "d-m-y"),
    (rf"([A-Za-z]+)\s+(\d{{1,2}}){ORD},?\s+(\d{{4}})", "m-d-y"),
    (r"(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})", "n"),
]


def _dates_from(match: re.Match, kind: str) -> tuple[date, date] | None:
    g = match.groups()
    if kind == "dm-dm-y":
        m1, m2 = _month(g[1]), _month(g[3])
        return (_safe(int(g[4]) - (1 if m1 and m2 and m1 > m2 else 0), m1, int(g[0])), _safe(int(g[4]), m2, int(g[2]))) if m1 and m2 else None
    if kind == "d-d-m-y":
        m = _month(g[2])
        return (_safe(int(g[3]), m, int(g[0])), _safe(int(g[3]), m, int(g[1]))) if m else None
    if kind == "m-d-d-y":
        m = _month(g[0])
        return (_safe(int(g[3]), m, int(g[1])), _safe(int(g[3]), m, int(g[2]))) if m else None
    if kind == "n-n":
        return _safe(int(g[2]), int(g[1]), int(g[0])), _safe(int(g[5]), int(g[4]), int(g[3]))
    if kind == "d-d/m/y":
        return _safe(int(g[3]), int(g[2]), int(g[0])), _safe(int(g[3]), int(g[2]), int(g[1]))
    if kind == "d-m-y":
        m = _month(g[1])
        day = _safe(int(g[2]), m, int(g[0])) if m else None
        return (day, day) if day else None
    if kind == "m-d-y":
        m = _month(g[0])
        day = _safe(int(g[2]), m, int(g[1])) if m else None
        return (day, day) if day else None
    day = _safe(int(g[2]), int(g[1]), int(g[0]))
    return (day, day) if day else None


def _first_dates(text: str) -> tuple[tuple[date, date], str] | None:
    # PDF text often splits years ("de 20 26").
    text = re.sub(r"(?<=de )(19|20)\s(\d{2})\b", r"\1\2", text)
    for pattern, kind in _DATE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            found = _dates_from(match, kind)
            if found and found[0] and found[1] and timedelta(0) <= found[1] - found[0] <= timedelta(days=10):
                return found, _clean(match.group(0), 60)
    return None


def find_meet_dates(flat: str) -> tuple[tuple[date, date], str] | None:
    """When the meet happens, whatever the wording. Looks first where the date is announced (cover page,
    "realiza-se / disputa-se / data / dates"), so an entry deadline further down isn't taken for it."""
    deadline = re.compile(r"inscri|entr(?:y|ies)|limite|deadline|at[eé]\s*(?:ao|à|a)?\s*(?:dia)?\s*$|until|prazo|tempos", re.IGNORECASE)

    def around(cues: str) -> tuple[tuple[date, date], str] | None:
        for match in re.finditer(cues, flat, re.IGNORECASE):
            if deadline.search(flat[max(0, match.start() - 60): match.start()]):
                continue
            found = _first_dates(flat[match.start(): match.start() + 140])
            if found:
                return found
        return None

    return (
        around(r"(?:realiza|disputa|decorre|ter[aá]\s+lugar|will\s+be\s+held|takes\s+place|held\s+on)")
        or _first_dates(flat[:600])
        or around(r"(?:(?<![a-z])datas?\b|(?<![a-z])dates?\b|(?<![a-z])dias?\b)")
        or _first_dates(flat)
    )


def _range_dates(value: str | None) -> tuple[date, date] | None:
    found = _first_dates(value or "")
    return found[0] if found else None


def detect_course(flat: str) -> str | None:
    """Pool length for the meet: "scm" (25 m) or "lcm" (50 m), or None when the text doesn't say."""
    # "tempos obtidos em piscina de 50 metros" talks about entry times, not about this pool.
    text = re.sub(r"(?:tempos?|marcas?|times?)[^.]{0,80}?(?:piscina|pool)\s+(?:de\s+)?(?:25|50)\s*m\w*", " ", flat.lower())
    long_votes = len(re.findall(r"ol[ií]mpic|piscina\s+longa|long\s+course|\blcm\b|\(pl\)|50\s*m(?:etros)?\s*(?:x|×|/|,|-|com)\s*\d+\s*(?:pistas|lanes)|piscina\s+(?:coberta\s+|descoberta\s+)?de\s+50\s*m|50\s*(?:m|metros)\s+pool|pool\s*:?\s*50", text))
    short_votes = len(re.findall(r"piscina\s+curta|short\s+course|\bscm\b|\(pc\)|25\s*m(?:etros)?\s*(?:x|×|/|,|-|com)\s*\d+\s*(?:pistas|lanes)|piscina\s+(?:coberta\s+|descoberta\s+)?de\s+25\s*m|25\s*(?:m|metros)\s+pool|pool\s*:?\s*25", text))
    if long_votes > short_votes:
        return "lcm"
    if short_votes > long_votes:
        return "scm"
    return None


SMALL_WORDS = {"de", "do", "da", "dos", "das", "e", "of", "the", "and", "em", "a", "o"}


def _title_case(value: str) -> str:
    """ "XII MEETING INTERNACIONAL DO ALGARVE" → "XII Meeting Internacional do Algarve"; mixed case is kept."""
    if value != value.upper():
        return value
    words = []
    for index, word in enumerate(value.split()):
        low = word.lower()
        if re.fullmatch(r"[IVXLC]+", word) or re.search(r"\d", word) or (len(word) <= 5 and word.isalpha() and index and low not in SMALL_WORDS and word in {"FPN", "ANL", "ANNP", "ANCNP", "ANA", "LEN", "ANDL", "ANCM"}):
            words.append(word)
        elif index and low in SMALL_WORDS:
            words.append(low)
        else:
            words.append(low[:1].upper() + low[1:])
    return " ".join(words)


MEET_WORDS = r"(?:Campeonatos?|Torneio|Meeting|Taça|Trof[eé]u|Encontro|Festival|Open|Grand Prix)"


def extract_title(text: str) -> str:
    # A cover page usually has the name alone on a line ("Meeting Internacional do Porto").
    # Optional edition in front: "XII Meeting…", "41.º Torneio…", "3rd Open…".
    edition = r"(?:[IVXLC]+\s+|\d+\s*\.?\s*[ªºa-z]{0,2}\s+)?"
    for line in text.splitlines()[:40]:
        line = _clean(line, 120)
        if re.match(edition + MEET_WORDS + r"\b", line, re.IGNORECASE) and 2 <= len(line.split()) <= 12:
            return _title_case(line)
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

    fmt = _between(flat, r"Provas Individuais\s*:", [r"Exce[cç][aã]o", r"Provas de Estafetas", r"Limite", r";"], 200)
    # "Provas individuais: 6€" is a fee line, not the format.
    add("Formato (individuais)", fmt if fmt and re.search(r"final|elimin|s[eé]rie|heat", fmt, re.IGNORECASE) else None)
    add("Exceção", _between(flat, r"Exce[cç][aã]o\s*:", [r"Provas de Estafetas", r"Limite", r"Inscri"], 200))
    add("Participação", _between(flat, r"Participa[cç][aã]o\s*:", [r"Nadadores n[aã]o", r"Programa"], 160))
    add("Prémios", _between(flat, r"Pr[eé]mios\s*:", [r"\d\.\s*ANEXOS", r"Regulamento das"], 160))
    _numbered_wording(flat, add, {f["label"] for f in facts}, facts)
    _tidy(facts)
    return facts


def _tidy(facts: list[dict]) -> None:
    """Values cut from running text can drag the next section along ("… Albufeira (25m…). 3. ARBITRAGEM")."""
    for fact in facts:
        value = fact["value"]
        if fact["label"] == "Local":
            value = re.split(r"\s\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ý]{3}|\s\(", value)[0]
        elif fact["label"] == "Datas":
            found = _first_dates(value)
            value = found[1] if found else value
        fact["value"] = _clean(value)


def _numeric_date(value: str) -> str:
    return re.sub(r"\s+", "", value)


def _numbered_wording(flat: str, add, seen: set[str], facts_ref: list[dict]) -> None:
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
    # Keep a "Data:" label only if it holds a real date; otherwise find the meet dates in any wording.
    labelled = next((f for f in facts_ref if f["label"] == "Datas"), None)
    if labelled is None or not _range_dates(labelled["value"]):
        found = find_meet_dates(flat)
        if found:
            if labelled is not None:
                facts_ref.remove(labelled)
                seen.discard("Datas")
            once("Datas", found[1])

    course = detect_course(flat)
    if course:
        lanes = re.search(r"(\d+)\s+(?:pistas|lanes)", flat, re.IGNORECASE)
        once("Piscina", ("50 m" if course == "lcm" else "25 m") + (f", {lanes.group(1)} pistas" if lanes else ""))

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
    if not sessions and "Sessões" not in seen:
        # Generic "1.ª Sessão … 9h30" / "Session 1 … 09:30".
        generic = re.findall(
            r"(\d)\s*\.?\s*[ªº]?\s*(?:Sess[aã]o|Session)[^0-9]{0,60}?(\d{1,2}[h:]\d{2})|(?:Sess[aã]o|Session)\s*(\d)[^0-9]{0,60}?(\d{1,2}[h:]\d{2})",
            flat,
            re.IGNORECASE,
        )
        found = sorted({(int(a or c), (b or d).replace(":", "h")) for a, b, c, d in generic})
        if found:
            once("Sessões", " · ".join(f"{n}ª {hour}" for n, hour in found))
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
    fee = re.search(r"(?:taxa\s+de\s+inscri[cç][aã]o|entry\s+fee)[^.]{0,40}?(\d+(?:[,.]\d{2})?)\s*(?:€|euros?|eur)\s*(por\s+(?:cada\s+)?(?:prova|atleta|nadador)|per\s+(?:event|swimmer))?", flat, re.IGNORECASE)
    once("Taxa de inscrição", f"{fee.group(1)}€" + (f" {fee.group(2)}" if fee and fee.group(2) else "") if fee else None)

    # Entry deadline in other wordings: "inscrições … até às 24h00 do dia 03 de Novembro de 2026".
    any_date = r"(" + LONG_DATE + r"|\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4})"
    # Skip withdrawal / change deadlines ("desistências … anulação de inscrições … até 07-11").
    deadline = next(
        (
            match
            # A dot followed by a letter (inscricoes@analgarve.com) doesn't end the sentence.
            for match in re.finditer(r"inscri[cç][oõ]es(?:[^.]|\.(?=\w)){0,160}?at[eé](?:[^.]|\.(?=\w)){0,40}?" + any_date, flat, re.IGNORECASE)
            if not re.search(r"desist|anula|baixa|altera|substitu", flat[max(0, match.start() - 80): match.end()], re.IGNORECASE)
        ),
        None,
    ) or re.search(
        r"(?:entry|entries)\s+(?:deadline|close)[^.]{0,40}?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})", flat, re.IGNORECASE
    )
    once("Prazo de inscrição", _numeric_date(deadline.group(1)) if deadline and "/" in deadline.group(1) else _clean(deadline.group(1)) if deadline else None)

    most = re.search(r"m[aá]ximo\s+de\s+(\d+)\s+provas(?:\s+individuais)?", flat, re.IGNORECASE)
    once("Limite de provas", f"{most.group(1)} por nadador" if most else None)

    # Schedule tables: one row per session, "13-11-2026 … 14:00 15:15 15:30" (warm-up, end, start).
    if "Sessões" not in seen and re.search(r"in[ií]cio|start|hor[aá]rio", flat, re.IGNORECASE):
        rows = re.findall(r"(\d{2})[-/.](\d{2})[-/.]\d{4}((?:(?!\d{2}[-/.]\d{2}[-/.]\d{4}).){0,70})", flat)
        starts: list[tuple[int, int, str]] = []
        for day, month, rest in rows:
            times = re.findall(r"\b(\d{1,2})[:h](\d{2})\b", rest)
            if not times or len(times) > 4:
                continue
            h, mi = times[2] if len(times) >= 3 else times[-1]
            starts.append((int(month), int(day), f"{day}/{month} {int(h)}h{mi}"))
        ordered = [label for *_, label in sorted(set(starts), key=lambda item: (item[0], item[1], int(item[2].split()[1].split("h")[0]), item[2]))]
        if len(ordered) >= 2:
            once("Sessões", " · ".join(ordered))

    limits = re.findall(r"(\d{2}:\d{2},\d{2})\s+(\d{2,4})\s+(LIVRES|COSTAS|BRU[CÇ]OS|MARIPOSA|ESTILOS)\s+(\d{2}:\d{2},\d{2})", flat)
    if limits:
        def short(t: str) -> str:
            return t[3:] if t.startswith("00:") else t.lstrip("0")
        rows = [f"{d} {s.capitalize()} F {short(f)} / M {short(m)}" for f, d, s, m in limits]
        once("Tempos limite", " · ".join(rows))


ESSENTIAL = ("Local", "Datas", "Piscina", "Sessões")


def process_rules(session: Session, payload: dict, data: bytes, body: dict, request) -> dict:
    pages = extract_pages(data)
    text = "\n".join(pages[:12])
    flat = " ".join(text.split())
    facts = extract_rules(text)
    title = extract_title(text)
    dates = _range_dates(next((f["value"] for f in facts if f["label"] == "Datas"), None))
    detected = detect_course(flat)
    # Gemini reads any association / country / language; the local parser is the fallback.
    ai = read_regulations(text, data)
    if ai:
        # Gemini read the PDF as printed. A value it gave that the text can't back up is replaced by the
        # local reading when there is one; never shown as if it were confirmed.
        local = {fact["label"]: fact for fact in facts}
        merged = []
        for fact in ai["facts"]:
            if fact.get("check") and fact["label"] in local:
                merged.append(local[fact["label"]])
            else:
                merged.append({"label": fact["label"], "value": fact["value"]})
        known = {fact["label"] for fact in merged}
        facts = merged + [fact for fact in facts if fact["label"] not in known]
        title = ai["name"] or title
        if ai["dates"] and not ("dates" in ai["check"] and dates):
            dates = ai["dates"]
        detected = ai["course"] or detected
    # Only what a coach needs to plan the meet; the name goes in meet.name.
    facts = [{"label": fact["label"], "value": fact["value"]} for fact in facts if fact["label"] in ESSENTIAL]
    # Any regulation is accepted with whatever it states; the coach fills in what's missing.
    looks_like_rules = re.search(r"regulamento|regulations?|reglamento|r[eè]glement|nata[cç][aã]o|nataci[oó]n|natation|swimming|piscina|piscine|pool", flat, re.IGNORECASE)
    if len(flat) < 80 or not (facts or title or looks_like_rules):
        raise HTTPException(status_code=400, detail="Não reconheci este PDF (nem start list, nem resultados, nem regulamento).")
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
    venue = next((f["value"] for f in facts if f["label"] == "Local"), "")
    summary = {
        "kind": "rules",
        "facts": facts,
        "competitionId": str(target.id) if target else None,
        "createsCompetition": target is None,
        "meet": {
            "name": title,
            "city": venue,
            "course": body.get("course") if body.get("course") in ("scm", "lcm") else (detected or ""),
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
    extra["rules"] = [{"label": fact["label"], "value": fact["value"]} for fact in facts]
    target.extra = extra
    flag_modified(target, "extra")
    _audit(session, payload, "meet.import_rules", "competition", target.id, request)
    return {**summary, "status": "done", "competitionId": str(target.id), "competition": competition_out(target)}


def _iso(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")
