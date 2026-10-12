# Gerador sintético 4.0 — especificação

Código: [`apps/web/src/lib/ml/synthetic.ts`](../../apps/web/src/lib/ml/synthetic.ts) (`GENERATOR_VERSION = "4.0"`).
Invariantes: [`synthetic.test.ts`](../../apps/web/src/lib/ml/synthetic.test.ts) (correm no CI com `npm test`).
Fontes de todos os números: [`referencias.md`](referencias.md). Pré-registo: [`../ml/protocolo.md`](../ml/protocolo.md), adenda gerador 4.0.

Só dados inventados: atletas "Sintético N", ids `syn-`, emails `.test`. Determinístico por semente
(`createRng(seed)`); sementes ≥ 9001 são da demo, as restantes pertencem ao protocolo.

## O que mudou face ao 3.0 (críticas do treinador)

| Crítica | 3.0 | 4.0 |
|---|---|---|
| Tempos irrealistas | Um único "talento" à volta de 55,5 s (H) / 61,5 s (M) no 100 L adulto; razões 200/100 ≈ 2,1 (curtas demais) | 6 níveis com bandas de 100 L por sexo; razões 50/100/200/400/1500 e por estilo ancoradas nos recordes mundiais |
| Reps sem tempo | Cronometragem parcial por intensidade, reps más omitidas, séries abandonadas, erros de digitação | Variante por omissão `completos`: todas as reps de todos os presentes cronometradas, incluindo aquecimento; sem erros; as faltas ficam registadas numa chamada |
| Volume sem relação com o nível | Grupos por especialidade, ≈ 12 km/semana para todos | Grupos de treino por nível (formação, competição, rendimento) com sessões e volume próprios |
| Só blocos de 1 segmento simulados | Blocos com vários segmentos (ex.: 400 + 6×50) só tinham a 1.ª parte | Todos os segmentos simulados |
| Provas sem estrutura | Só tempo final | Parciais de 50 m (soma = final) e tempo de reação |

A variante `em-falta` (falta informativa, erros) continua disponível para testar a robustez do modelo.

## Atleta

- **Nível** (`LEVELS`): iniciação, regional, nacional jovem, nacional absoluto, internacional, elite,
  atribuído de forma intercalada (`índice mod 6`) para qualquer equipa cobrir todos os níveis.
- **Idade no fim dos dados** por nível (`LEVEL_AGE`): 11–13, 12–18, 14–18, 17–26, 18–28, 20–30.
- **Prova principal da especialidade** (velocista 100 L, meio-fundo 200 L, fundista 400 L; partida de bloco,
  piscina de 50 m) no fim dos dados: pontos World Aquatics uniformes entre 10 % e 90 % da banda do nível
  (`LEVEL_POINTS`: 150–300, 300–450, 450–600, 600–750, 750–870, 870–930; referências §1.6; elite limitada a 930
  para nenhuma prova passar o recorde). A banda é a da **prova no pico** (taper e fato); o tempo fresco a meio da
  época é `PEAK_GAIN` = 2,5 % mais lento (taper ≈ 2 %, referências §4.3). Na semente 6105, a mediana das provas
  principais em PL por nível fica dentro da banda (elite 862, máx. 911; internacional 799; nacional absoluto 598). As outras distâncias seguem as razões; o potencial adulto obtém-se
  invertendo a curva de crescimento `1 + devA·exp(−(idade−12)/devTau)`.
- **Especialidade** (velocidade / meio-fundo / fundo): define as razões de distância e a reserva anaeróbia.
  - 200/100: 2,19–2,30 / 2,16–2,23 / 2,12–2,19;
  - 400/200: 2,13–2,22 / 2,09–2,16 / 2,05–2,11;
  - 1500/400: 3,95–4,08 (fundo 3,90–3,97). Recordes mundiais: 2,17–2,20; 2,09–2,16; 3,93–3,96.
  - 50/100: 0,447–0,47 (recordes mundiais 0,451 / 0,457), independente das outras.
- **Estilos**: razão ao livre dos recordes mundiais (H costas 1,112, bruços 1,226, mariposa 1,066,
  estilos 1,105; M 1,105 / 1,240 / 1,056 / 1,120), ±2–4 % individual; o estilo principal ganha 2–5 %.
- **25 m vs 50 m**: viragens extra com tempo individual; razão 50 m/25 m de 1,005 a 1,08 (invariante G4).
- **Zonas** como fração da velocidade CSS 200/400 (SUAVE 0,80, A1 0,885, A2 0,935, A3 0,975, PROG 0,96,
  PA 1,04; referências §4.1); ritmos de prova a partir do tempo da prova.
- **Reserva W′ mínima** = 1,1 × (400 − 197,2·r/(r − 1)), r = T400/T200: o que um 400 máximo precisa acima da
  velocidade crítica; sem isto o teste CSS "quebrava" e media a CSS 7 % mais lenta (G9).
- **Recuperação sentida (1–5)** centrada na forma habitual do atleta (média móvel ≈ 4 semanas): 3,4 + 80 × (forma −
  habitual) + ruído; distribuição na demo ≈ 2 / 11 / 31 / 38 / 18 %.
- **Velocidade crítica do W′** = 0,986 × CSS (Dekerle, referências §2.3), ajustada à piscina da rep: em 25 m
  as viragens tornam a rep mais rápida sem gastar W′.
- Fisiologia herdada do 3.0: W′ e recuperação, fadiga na série, impulso-resposta de Banister com memória
  muscular, sono, ginásio, ruído dia/sessão/rep (t de Student), atípicos (~20 %).

## Época e treino

- Macrociclo setembro–julho com 3 provas A (semanas 13, 27, 44) e provas B; fases geral, específica,
  competitiva, taper, transição; pausa de agosto; regressos individuais tardios, lesões (12 %/época,
  2–5 semanas) e doença (50 %/época, 4–10 dias).
- **Grupos de treino por nível**: sessões/semana = base do cenário × 0,8 / 1,15 / 1,45 e reps por série
  × 1,1 / 1,9 / 2,5 (formação / competição / rendimento). Volume a meio da época na equipa de demo
  (semente 9001, média por nível; o Sintético 30 saiu da equipa e fica com 0): iniciação 14,6, regional 14,5,
  nacional jovem 27,9, nacional absoluto 27,1, internacional 48,9, elite 48,7 km/semana (referência:
  24–32 km aos 11–15 anos, ≥ 44 km depois; a formação fica abaixo, de propósito, por ter menos sessões).
- A carga de referência de Banister (`steadyDaily`) é a carga efetiva medida (só as séries principais
  escalam; ninguém vai a todas as sessões): 0,9 × (0,3 + 0,7 × reps do grupo).
- **Teste CSS** (400 e 200 máximos, 10 min entre eles) de 7 em 7 semanas, à quarta-feira à tarde, nas fases
  geral e específica; é a âncora das zonas no perfil do atleta.
- **Faltas**: cada sessão gera uma chamada (`attendance`) com presentes e ausentes; ausentes não têm treino.
- **Parciais** de 50 m em reps ≥ 100 m e em provas, somando exatamente ao tempo final.

## Dados acrescentados na exportação da demo (fora do gerador congelado)

O produto agrupa atletas por **especialidade** (velocidade / intermédio / fundo, fixo na API); a exportação usa esses
grupos para os atletas e marca cada sessão com os grupos de quem esteve presente. Os grupos de treino por nível do
gerador ficam como pistas dentro da sessão (definem o volume de cada atleta).

`scripts/export-synthetic.ts` acrescenta, sem mexer nos números do gerador: bem-estar (variante `bem-estar`), plano de
época com as fases que o gerador seguiu (`seasonPlansOf`) e o **RPE da sessão** em ~75 % dos dias de treino, igual à
média do esforço das intensidades ponderada pelos metros (Suave 1, A1 2, A2 4, A3 6, PA/ritmo 8, MAX 9) + km/4 − 0,5,
com ruído determinístico de ±1, limitado a 1–10. Estes valores servem para mostrar os ecrãs e não são uma
referência científica.

## Invariantes (falham o CI)

| | Invariante | Teste |
|---|---|---|
| G1 | Todas as reps de todos os presentes têm tempo; a chamada coincide com os presentes | `synthetic.test.ts` |
| G2 | Ritmo mais rápido com a intensidade (SUAVE → A1 → A2 → A3 → PA → MAX), por atleta e distância | idem |
| G3 | Prova principal na banda de pontos do nível; nenhuma prova (fresca ou de competição) acima de 1000 pontos | idem |
| G4 | 50/100 ∈ ]0,43; 0,48[, 200/100 ∈ ]2,10; 2,32[, 400/200 ∈ ]2,04; 2,23[, 50 m/25 m ∈ ]1,005; 1,08[ | idem |
| G5 | Soma dos parciais = tempo final (±0,01 s) | idem |
| G6 | Mesma série em sessões ≤ 3 dias: p95 da variação < 5 %, máximo < 15 % | idem |
| G7 | Mesma semente → mesmos dados | idem |
| G8 | Todos os níveis e os dois sexos presentes | idem |
| G9 | O teste CSS em treino mede a CSS fresca com o erro de um teste real (mediana < 4 %, p90 < 8 %) | idem |

## Tabela de realismo — equipa de demonstração (semente 9001, 4 épocas)

Tempos frescos de partida de bloco em piscina de 50 m na data de hoje (o tempo de prova do dia varia com
a forma e o taper). CSS = (T400 − T200)/2. Gerada por `npx tsx scripts/synthetic-summary.ts`.

| Atleta | Nível | Sexo | Idade | Estilo | 50 L | 100 L | 200 L | 400 L | 100 estilo | CSS (s/100 m) | km/sem (meio da época) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sintético 1 | iniciacao | F | 12 | L | 38.31 | 1:26.07 | 3:13.19 | 7:01.37 | 1:26.07 | 114.1 | 15.4 |
| Sintético 2 | regional | F | 15 | B | 32.00 | 1:11.92 | 2:39.39 | 5:43.74 | 1:25.15 | 92.2 | 13.8 |
| Sintético 3 | nacional_jovem | F | 15 | C | 29.92 | 1:05.52 | 2:23.38 | 5:01.24 | 1:08.93 | 78.9 | 30.1 |
| Sintético 4 | nacional_absoluto | M | 22 | B | 24.41 | 54.26 | 2:03.19 | 4:32.92 | 1:05.80 | 74.9 | 23.8 |
| Sintético 5 | internacional | M | 21 | B | 23.01 | 51.94 | 1:53.95 | 4:03.97 | 1:04.60 | 65.0 | 44.4 |
| Sintético 6 | elite | M | 30 | C | 22.64 | 50.73 | 1:49.99 | 3:52.43 | 54.02 | 61.2 | 52.4 |
| Sintético 7 | iniciacao | F | 11 | L | 41.76 | 1:32.23 | 3:24.66 | 7:11.92 | 1:32.23 | 113.6 | 15.1 |
| Sintético 8 | regional | F | 16 | M | 34.14 | 1:16.10 | 2:43.76 | 5:43.91 | 1:20.38 | 90.1 | 14.2 |
| Sintético 9 | nacional_jovem | F | 14 | B | 30.23 | 1:07.84 | 2:35.65 | 5:35.28 | 1:23.75 | 89.8 | 28.6 |
| Sintético 10 | nacional_absoluto | M | 22 | B | 24.46 | 54.55 | 2:01.31 | 4:22.48 | 1:05.28 | 70.6 | 30.3 |
| Sintético 11 | internacional | F | 17 | L | 25.43 | 57.51 | 2:03.38 | 4:18.47 | 57.51 | 67.5 | 55.1 |
| Sintético 12 | elite | M | 22 | L | 22.38 | 49.52 | 1:53.66 | 4:04.01 | 49.52 | 65.2 | 49.6 |
| Sintético 13 | iniciacao | M | 12 | C | 40.71 | 1:30.53 | 3:15.36 | 6:48.57 | 1:36.59 | 106.6 | 12.5 |
| Sintético 14 | regional | M | 15 | L | 30.64 | 1:06.81 | 2:30.74 | 5:23.63 | 1:06.81 | 86.4 | 14.4 |
| Sintético 15 | nacional_jovem | F | 15 | B | 29.47 | 1:05.40 | 2:24.29 | 5:02.30 | 1:17.50 | 79.0 | 25.8 |
| Sintético 16 | nacional_absoluto | F | 20 | B | 25.66 | 58.32 | 2:08.23 | 4:26.52 | 1:12.40 | 69.1 | 20.3 |
| Sintético 17 | internacional | F | 22 | L | 25.76 | 56.42 | 2:07.21 | 4:33.12 | 56.42 | 73.0 | 53.4 |
| Sintético 18 | elite | F | 21 | L | 24.03 | 53.79 | 1:58.22 | 4:12.61 | 53.79 | 67.2 | 47.8 |
| Sintético 19 | iniciacao | M | 11 | B | 35.67 | 1:18.83 | 2:59.63 | 6:33.92 | 1:33.45 | 107.1 | 14.4 |
| Sintético 20 | regional | F | 12 | L | 32.81 | 1:13.71 | 2:44.45 | 5:53.41 | 1:13.71 | 94.5 | 15.1 |
| Sintético 21 | nacional_jovem | F | 16 | B | 29.80 | 1:07.10 | 2:25.90 | 5:04.51 | 1:19.95 | 79.3 | 30.2 |
| Sintético 22 | nacional_absoluto | F | 17 | L | 27.05 | 1:00.56 | 2:18.46 | 5:06.81 | 1:00.56 | 84.2 | 30.2 |
| Sintético 23 | internacional | F | 25 | L | 25.28 | 55.99 | 2:01.69 | 4:18.16 | 55.99 | 68.2 | 54.5 |
| Sintético 24 | elite | F | 29 | E | 24.42 | 54.83 | 2:00.18 | 4:08.66 | 54.83 | 64.2 | 51.1 |
| Sintético 25 | iniciacao | M | 11 | L | 36.12 | 1:20.45 | 2:55.61 | 6:07.99 | 1:20.45 | 96.2 | 12.9 |
| Sintético 26 | regional | F | 13 | M | 34.58 | 1:15.50 | 2:42.83 | 5:40.07 | 1:18.57 | 88.6 | 15.7 |
| Sintético 27 | nacional_jovem | F | 15 | B | 29.00 | 1:04.76 | 2:24.83 | 5:12.10 | 1:17.60 | 83.6 | 27.9 |
| Sintético 28 | nacional_absoluto | F | 26 | C | 26.78 | 58.55 | 2:08.09 | 4:37.13 | 1:02.81 | 74.5 | 29.5 |
| Sintético 29 | internacional | M | 20 | E | 23.94 | 52.71 | 1:56.38 | 4:00.95 | 52.71 | 62.3 | 47.9 |
| Sintético 30 | elite | M | 23 | M | 22.28 | 49.22 | 1:49.34 | 3:53.90 | 50.20 | 62.3 | 0.0 |
| Sintético 31 | iniciacao | M | 12 | B | 38.07 | 1:24.14 | 3:03.13 | 6:24.22 | 1:42.63 | 100.5 | 14.7 |
| Sintético 32 | regional | M | 15 | L | 29.01 | 1:04.39 | 2:26.26 | 5:21.19 | 1:04.39 | 87.5 | 10.5 |
