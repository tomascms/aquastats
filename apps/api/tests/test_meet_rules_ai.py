from datetime import date

from app.core.config import get_settings
from app.domain import meet_rules_ai


def test_without_key_the_local_parser_is_used(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    assert meet_rules_ai.read_regulations("Regulamento") is None


def test_answer_becomes_facts_and_missing_fields_stay_out():
    out = meet_rules_ai._to_facts(
        {
            "name": "Arena Lisbon International Meeting",
            "venue": "Complexo Desportivo do Jamor",
            "city": "Oeiras",
            "startDate": "2026-02-14",
            "endDate": "2026-02-15",
            "course": "lcm",
            "lanes": 10,
            "sessions": [{"date": "2026-02-14", "time": "16:30", "label": "Finais"}, {"date": "2026-02-14", "time": "08:30", "label": "Sessão A"}],
            "entryDeadline": "2026-02-02",
            "entryEmail": "arenalisbonmeeting@anlisboa.pt",
            "entryFee": "6 € por prova individual",
            "maxEvents": None,
        },
        "Arena Lisbon International Meeting, Complexo Desportivo do Jamor, Oeiras. 14 e 15 de Fevereiro de 2026. "
        "Piscina de 50 metros com 10 pistas. 8:30 Sessão A, 16:30 Finais. Prazo: 02/02/2026. "
        "arenalisbonmeeting@anlisboa.pt. Provas individuais: 6€.",
    )
    facts = {f["label"]: f["value"] for f in out["facts"]}
    assert out["dates"] == (date(2026, 2, 14), date(2026, 2, 15)) and out["course"] == "lcm"
    assert facts["Piscina"] == "50 m, 10 pistas"
    assert facts["Sessões"] == "14/02 8h30 sessão a · 14/02 16h30 finais"


def test_gemini_failure_falls_back(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "k")

    def boom(*_a, **_k):
        raise meet_rules_ai.httpx.ConnectError("down")

    monkeypatch.setattr(meet_rules_ai.httpx, "post", boom)
    monkeypatch.setattr(meet_rules_ai.time, "sleep", lambda _s: None)
    assert meet_rules_ai.read_regulations("texto que nunca foi visto antes 123") is None


PDF_TEXT = (
    "Arena Lisbon International Meeting Data: 14 e 15 de Fevereiro de 2026 Local: Jamor, PORTUGAL "
    "Piscina aquecida de 50 metros com 10 pista. Sessão A: 7.15* Sessão B: 10.00* 8.30* 11.00* Finais 15.00 16.30 "
    "Prazo Limite: 2 de Fevereiro de 2026 Email: arenalisbonmeeting@anlisboa.pt Provas individuais:6€"
)


def test_values_not_printed_in_the_pdf_are_dropped_or_flagged():
    out = meet_rules_ai._to_facts(
        {
            "name": "Arena Lisbon International Meeting",
            "venue": "Jamor",
            "startDate": "2026-02-14",
            "endDate": "2026-02-15",
            "course": "lcm",
            "sessions": [
                {"date": "2026-02-14", "time": "08:30", "label": "Sessão A"},
                {"date": "2026-02-14", "time": "11:30", "label": "Sessão B"},  # the PDF says 11.00
                {"date": "2026-02-14", "time": "16:30", "label": "Finais"},
            ],
            "entryDeadline": "2026-02-03",  # the PDF says 2 February
            "entryEmail": "inscricoes@outro.pt",  # not in the PDF
            "entryFee": "6 € por prova individual",
        },
        " ".join(PDF_TEXT.split()),
    )
    facts = {f["label"]: f for f in out["facts"]}
    assert facts["Sessões"]["value"] == "14/02 8h30 sessão a · 14/02 16h30 finais"
    assert facts["Sessões"]["check"] is True
    assert facts["Datas"]["check"] is False
    assert out["check"] == set()


def test_day_lists_and_numeric_dates_count_as_printed():
    flat = "13, 14 e 15 de Novembro de 2026 · prazo 03-11-2026 · June 6-7, 2026"
    assert meet_rules_ai._day_in(flat, date(2026, 11, 13)) and meet_rules_ai._day_in(flat, date(2026, 11, 15))
    assert meet_rules_ai._day_in(flat, date(2026, 11, 3))
    assert meet_rules_ai._day_in(flat, date(2026, 6, 7))
    assert not meet_rules_ai._day_in(flat, date(2026, 11, 20))
