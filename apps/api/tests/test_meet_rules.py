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


# Regional association layout (Analgarve): uppercase title with edition, "25m / 8 pistas", schedule table.
ALGARVE = """Associação de Natação do Algarve Época 2026-27
XII MEETING INTERNACIONAL DO ALGARVE
1. DATA
13, 14 e 15 de Novembro de 2026
2. LOCAL
Complexo de Piscinas Municipais de Albufeira (25m / 8 pistas + tanque 17m p/ aquecimento e descontração).
3. ARBITRAGEM
4.6. As desistências de provas (anulação de inscrições) deverão ser comunicadas à organização até às 24h00m do dia 07-11-2026.
4.7. HORÁRIOS DE AQUECIMENTOS E PROVAS Data Dia Sessões Aquecimento Termino aquecimento Início das provas
13-11-2026 1ª Única 14:00 15:15 15:30
14-11-2026 2ª 1ª 1ª ronda: 08:00 08:45 09:00
14-11-2026 2ª 2ª 14:30 15:45 16:00
6.2. Cada nadador poderá ser inscrito num máximo de 6 provas, ao longo de toda a competição.
9.2. As inscrições deverão ser enviadas para inscricoes@analgarve.com até às 24h00 do dia 03 de Novembro de 2026.
9.3. A taxa de inscrição será de 6 € por cada prova.
"""


def test_regional_layout_with_schedule_table():
    facts = {f["label"]: f["value"] for f in extract_rules(ALGARVE)}
    assert extract_title(ALGARVE) == "XII Meeting Internacional do Algarve"
    assert facts["Local"] == "Complexo de Piscinas Municipais de Albufeira"
    assert _range_dates(facts["Datas"]) == (date(2026, 11, 13), date(2026, 11, 15))
    assert detect_course(" ".join(ALGARVE.split())) == "scm"
    assert facts["Prazo de inscrição"] == "03 de Novembro de 2026"
    assert facts["Enviar inscrições para"] == "inscricoes@analgarve.com"
    assert facts["Sessões"] == "13/11 15h30 · 14/11 9h00 · 14/11 16h00"
    assert facts["Taxa de inscrição"] == "6€ por cada prova"
    assert facts["Limite de provas"] == "6 por nadador"
