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
        }
    )
    facts = {f["label"]: f["value"] for f in out["facts"]}
    assert out["dates"] == (date(2026, 2, 14), date(2026, 2, 15)) and out["course"] == "lcm"
    assert facts["Piscina"] == "50 m, 10 pistas"
    assert facts["Sessões"] == "14/02 8h30 sessão a · 14/02 16h30 finais"
    assert facts["Prazo de inscrição"] == "02/02/2026"
    assert "Limite de provas" not in facts


def test_gemini_failure_falls_back(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "k")

    def boom(*_a, **_k):
        raise meet_rules_ai.httpx.ConnectError("down")

    monkeypatch.setattr(meet_rules_ai.httpx, "post", boom)
    assert meet_rules_ai.read_regulations("texto que nunca foi visto antes 123") is None
