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
