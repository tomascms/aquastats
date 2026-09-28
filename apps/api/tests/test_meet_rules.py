from datetime import date

import pytest

from app.domain.meet_rules import _range_dates, detect_course, extract_rules, extract_title, find_meet_dates

# Numbered-clause wording used by regional associations (ANNP Meeting Internacional do Porto).
ANNP = """
Meeting Internacional do Porto
41.ª edição
6 e 7 de junho de 2026
Piscina de Campanhã
1.2. Disputa-se nos dias 6 e 7 de junho de 2026, na Piscina de Campanhã, no Porto, com dimensões olímpicas e 8 pistas.
1.4. Os tempos de inscrição serão tidos em consideração no período compreendido entre 19 de maio de 2025, obtidos em piscina de 50 metros.
1.5.1. Na sessão da manhã, séries eliminatórias. 1.5.2. Na sessão da tarde, finais A e B.
1.6. Cada nadador poderá apenas ser inscrito e participar em 4 provas individuais (2 provas por jornada) mais as provas de estafetas.
00:30,81 50 LIVRES 00:27,28
01:06,27 100 LIVRES 00:59,46
3.1. As equipas deverão realizar as suas inscrições até ao dia 19 /05/2026, sendo dirigidas para o email info@annp.pt. As inscrições poderão ainda ser enviadas no prazo extraordinário até 21/05/2026.
3.3. A inscrição em cada prova individual, por atleta, no prazo regular, deverá ser acompanhada de 5,50€.
FINAIS Sábado, 06/06/2026 Início da Competição às 16h30
ELIMINATÓRIAS Sábado, 06/06/2026 Início da Competição às 9h00
"""


def test_numbered_regulations_are_recognised():
    facts = {f["label"]: f["value"] for f in extract_rules(ANNP)}
    assert extract_title(ANNP) == "Meeting Internacional do Porto"
    assert facts["Local"] == "Piscina de Campanhã, Porto"
    assert _range_dates(facts["Datas"])[0].isoformat() == "2026-06-06"
    assert facts["Piscina"] == "50 m, 8 pistas"
    assert facts["Prazo de inscrição"] == "19/05/2026 (extraordinário até 21/05/2026)"
    assert facts["Enviar inscrições para"] == "info@annp.pt"
    assert facts["Sessões"] == "06/06 9h00 eliminatórias · 06/06 16h30 finais"
    assert facts["Tempos limite"].startswith("50 Livres F 30,81 / M 27,28")


def test_minimal_regulation_only_needs_what_it_has():
    """A short regional regulation: name, one date, a 25 m pool. Nothing else is required."""
    text = "Torneio de Abertura ANL\nRealiza-se no dia 18 de outubro de 2026 nas Piscinas Municipais de Setúbal (piscina de 25 metros)."
    facts = {f["label"]: f["value"] for f in extract_rules(text)}
    assert extract_title(text) == "Torneio de Abertura ANL"
    assert _range_dates(facts["Datas"]) == (date(2026, 10, 18), date(2026, 10, 18))
    assert detect_course(" ".join(text.split())) == "scm"
    assert "Sessões" not in facts and "Prazo de inscrição" not in facts


@pytest.mark.parametrize(
    "text, expected",
    [
        ("A prova decorre de 30 de maio a 1 de junho de 2026.", (date(2026, 5, 30), date(2026, 6, 1))),
        ("Datas: 14-15 March 2026", (date(2026, 3, 14), date(2026, 3, 15))),
        ("The meet will be held on June 6-7, 2026 in Lisbon.", (date(2026, 6, 6), date(2026, 6, 7))),
        ("Data: 06/12/2026 e 07/12/2026", (date(2026, 12, 6), date(2026, 12, 7))),
        ("Disputa-se nos dias 6 e 7 de junho de 20 26, no Porto. Inscrições até ao dia 19/05/2026.", (date(2026, 6, 6), date(2026, 6, 7))),
        ("Inscrições até 1 de maio de 2026. A competição realiza-se a 9 e 10 de maio de 2026.", (date(2026, 5, 9), date(2026, 5, 10))),
    ],
)
def test_meet_dates_in_any_wording(text, expected):
    assert find_meet_dates(text)[0] == expected


@pytest.mark.parametrize(
    "text, course",
    [
        ("Piscina Olímpica do Jamor", "lcm"),
        ("Competição em piscina curta (25 m).", "scm"),
        ("Pool: 50m, 10 lanes", "lcm"),
        ("Tempos obtidos em piscina de 50 metros. Piscina de 25 metros com 6 pistas.", "scm"),
        ("Regulamento geral das provas.", None),
    ],
)
def test_pool_length_detection(text, course):
    assert detect_course(text) == course
