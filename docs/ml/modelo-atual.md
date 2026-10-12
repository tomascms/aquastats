# Modelo de previsão de treino — estado atual (baseline)

Documento do ponto de partida, antes de qualquer melhoria. Resultados do backtest em
[`results/baseline.md`](results/baseline.md).

## O que existe

| Ficheiro | Função | Onde aparece |
|---|---|---|
| `apps/web/src/lib/training-context.ts` | `annotateTrainingReps`: transforma treinos + tempos numa linha por repetição, com contexto (piscina, distância, estilo, intensidade, material, saída, posição na série, carga antes, carga semanal, sono, ginásio). `isPlausibleRep` descarta tempos fisicamente impossíveis (< 0,4 s/m ou > 3 s/m). | Análise › Treino |
| `apps/web/src/lib/training-prediction.ts` | `predictTrainingTargets` (tempo estimado por rep), `learnedPatterns` (efeitos aprendidos), `formTimeline` (índice de forma semanal), `formBefore` (forma nas 4 semanas antes de uma prova). | Painel de treino, Análise de série, Provas × preparação |
| `apps/web/src/lib/race-analysis.ts` | Métricas de prova a partir das marcas (velocidade, SR, DPS, índice de braçada, subaquáticos, quebra). Sem previsão. | Análise de prova |
| `apps/web/src/lib/race-factors.ts` | Correlação de Pearson entre fatores de preparação e métricas de prova (só reporta \|r\| ≥ 0,5 com n ≥ 4). | Provas × preparação |
| `apps/web/src/lib/season.ts` | Volume por banda de intensidade, carga semanal (volume × esforço), ACWR semanal (semana ÷ média das 4 anteriores), taper em degraus. | Época |

## Como `predictTrainingTargets` estima uma repetição

1. **Grupo** = piscina | distância | estilo | intensidade | material. Nunca compara entre grupos
   (um 50 em piscina de 25 m nunca informa um 50 em piscina de 50 m).
2. **Nível** = mediana ponderada (meia-vida 28 dias) das reps **de datas anteriores** do mesmo
   grupo. Exige ≥ 2 reps anteriores; sem isso, não há estimativa.
3. **Contexto** = regressão ridge (λ = 4, intercepto não penalizado, pesos com meia-vida de 180
   dias) do desvio relativo `tempo / nível − 1` sobre 20 variáveis: dia da semana (7), manhã,
   2.º treino do dia, posição na série, saída face à habitual, partida do bloco, km antes no treino,
   km na semana, dias seguidos, regresso de paragem, horas de sono abaixo de 8, ginásio
   (força/explosivo/mobilidade). Só entra quando há ≥ 8 amostras; o ajuste é limitado a ±8 %.
4. **Banda** = ± 1 desvio-padrão residual da regressão (ou dispersão do grupo quando não há
   regressão), com mínimo de 0,5 %. Corresponde a ≈ 68 % se os erros forem normais.
5. **Confiança** = "alta" com ≥ 8 reps no grupo e ≥ 30 amostras de regressão; "média" com ≥ 4 reps
   no grupo; senão "baixa".
6. **Sem fuga temporal**: o nível e a regressão só usam datas estritamente anteriores
   (verificado no harness ao perturbar o futuro: 0 previsões alteradas).

## Pontos fracos identificados (a confirmar/medir no backtest)

- **Arranque a frio**: um grupo novo precisa de 2 reps anteriores; nada é partilhado entre grupos,
  piscinas, atletas ou equipa. Em dados esparsos, ~50 % das reps ficam sem estimativa.
- **Regressão não robusta**: mínimos quadrados sobre desvios relativos; um erro de registo
  ("+1 minuto" num 50) vale um desvio de +200 % e arrasta coeficientes e o desvio residual.
- **20 variáveis com λ = 4** (quase sem regularização face a centenas de amostras), efeitos iguais
  para todas as intensidades.
- **Banda não calibrada**: largura vem do resíduo dentro da amostra, não do erro fora da amostra.
- **Confiança heurística**: não verificada contra o erro real.
- **Forma = mediana**: não separa tendência real de ruído nem quantifica a incerteza do estado.
- `season.ts`: ACWR semanal (média simples), sem modelo fitness-fadiga; taper só por volume.

## Gerador 4.0 — backtest de confirmação (2026-10-12)

Pré-registo: [`protocolo.md`](protocolo.md), adenda gerador 4.0. Uma única execução, sementes 6201–6215, horizonte
dia, v1.0.1 contra "último valor", gerador congelado (4.ª vez) antes de correr. Resultado completo:
[`results/confirmacao-gerador4.md`](results/confirmacao-gerador4.md).

| Célula | MAPE último valor | MAPE v1.0.1 | ΔMAPE [IC 95 %] | Cobertura 80 % |
|---|---|---|---|---|
| arranque | 1,52 % | 1,34 % | −0,179 [−0,201; −0,157] | 79,0 % |
| esparso | 1,44 % | 1,22 % | −0,215 [−0,233; −0,195] | 79,5 % |
| típico | 1,55 % | 1,36 % | −0,192 [−0,211; −0,169] | 79,5 % |
| denso | 1,56 % | 1,37 % | −0,187 [−0,207; −0,167] | 79,3 % |

- M1 ✓ (IC < 0 nas 4), M2 ✓ (cobertura 79,0–79,5 %), M3 ✓ (fuga 0). Todos os subgrupos (sexo, escalão, estilo) e
  atípicos melhoram; nenhum atleta piora com IC > 0.
- O "NÃO MANTER" do ficheiro vem das regras R3/R4 do protocolo de experiências (CRPS e calibração contra o campeão),
  que não se aplicam a um campeão sem intervalo ("último valor"). Os critérios desta adenda são M1–M3.
- **Não comparar com o gerador 3.0** (1,56–2,98 %): o MAPE mais baixo vem de dados completos sem erros de digitação
  e com muitas reps fáceis (aquecimento, A1) agora cronometradas, não de uma melhoria do modelo.
- Limite: tudo continua a ser sintético; em dados reais o v1.0.1 não foi avaliado (0 tempos reais).

## Confirmação após o 5.º congelamento do gerador (4.0, sementes 6201–6215)

Resultado tal como saiu (`docs/ml/results/confirmacao-gerador4.md`): v1.0.1 bate "último valor" em todas as
células decisivas. MAPE dia 1,21–1,32 % vs 1,43–1,53 %; ΔMAPE agregado −0,209 pp, limite unilateral
(Bonferroni) −0,195 pp < 0. M1 passa. Horizonte mês continua melhor que o campeão em todos os cenários
(ΔMAPE −0,10 a −0,63 pp).
