from app.domain.meet_rules import _range_dates, extract_rules, extract_title

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
    assert facts["Limite de provas"].startswith("4 individuais")
    assert facts["Sessões"] == "06/06 9h00 eliminatórias · 06/06 16h30 finais"
    assert facts["Taxa de inscrição"] == "5,50€ por prova individual"
    assert facts["Tempos limite"].startswith("50 Livres F 30,81 / M 27,28")
