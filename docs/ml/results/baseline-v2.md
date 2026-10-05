# Baseline v2 — modelo atual e referências (protocolo completo)

Dados **sintéticos** (gerador 2.0), sementes de teste. Protocolo: `docs/ml/protocolo.md`. Métricas em reps limpas (sem erro de digitação), média ± desvio entre sementes.

## Células de decisão

### arranque · em-falta/base/carga

Arranque: 6 semanas a meio da época. 6 atletas, ~504 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.53 | 0.76% | — | — | — | — | — | — |
| próxima rep | último valor | 90% | 1.04 | 1.68% ± 0.37 | 0.41% | — | — | — | — | 1.89% |
| próxima rep | mediana | 21% | 1.10 | 1.52% ± 0.35 | 0.56% | 42% (68%) | 51% | 3.2% | 1.32% | 1.70% |
| próxima rep | modelo atual | 21% | 1.15 | 1.66% ± 0.45 | 0.48% | 41% (68%) | 50% | 3.2% | 1.37% | 1.84% |
| dia | _oráculo (véspera)_ | — | 0.70 | 1.00% | — | — | — | — | — | — |
| dia | último valor | 21% | 1.13 | 1.57% ± 0.35 | 0.69% | — | — | — | — | 1.74% |
| dia | mediana | 21% | 1.10 | 1.52% ± 0.35 | 0.56% | 42% (68%) | 51% | 3.2% | 1.32% | 1.70% |
| dia | modelo atual | 21% | 1.15 | 1.66% ± 0.45 | 0.48% | 41% (68%) | 50% | 3.2% | 1.37% | 1.84% |
| semana | último valor | 17% | 1.12 | 1.65% ± 0.45 | 0.82% | — | — | — | — | 1.79% |
| semana | mediana | 17% | 1.09 | 1.60% ± 0.44 | 0.69% | 40% (68%) | 48% | 2.7% | 1.33% | 1.74% |
| semana | modelo atual | 17% | 1.12 | 1.71% ± 0.49 | 0.59% | 38% (68%) | 47% | 2.7% | 1.37% | 1.85% |
| mês | último valor | 3% | 0.89 | 2.11% ± 0.77 | 1.95% | — | — | — | — | 2.11% |
| mês | mediana | 3% | 0.83 | 1.85% ± 0.74 | 1.62% | 30% (68%) | 38% | 2.1% | 1.48% | 1.85% |
| mês | modelo atual | 3% | 0.84 | 1.98% ± 0.81 | 1.74% | 27% (68%) | 34% | 2.1% | 1.60% | 1.98% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 2.62% · 100% | 1.51% · 100% | 1.64% · 100% | 1.37% · 100% | 0.32% · 100% |
| mediana | — | 2.62% · 100% · 6% | 1.49% · 100% · 50% | 1.60% · 100% · 48% | 1.31% · 100% · 58% | 0.97% · 100% · 80% |
| modelo atual | — | 2.98% · 100% · 6% | 1.63% · 100% · 51% | 1.67% · 100% · 46% | 2.11% · 100% · 53% | 0.49% · 100% · 100% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 |
|---|---|---|---|
| último valor | 1.40% · 10% | 1.60% · 28% | 1.67% · 30% |
| mediana | 1.38% · 10% · 49% | 1.61% · 28% · 47% | 1.57% · 30% · 54% |
| modelo atual | 1.39% · 10% · 49% | 1.63% · 28% · 47% | 1.90% · 30% · 53% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| média | 103 | 1.64% | 51% |
| baixa | 7 | 2.98% | 6% |
| alta | 37 | 1.85% | 43% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

### esparso · em-falta/base/carga

Esparso: 12 semanas, poucos treinos e tempos. 6 atletas, ~508 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.52 | 0.76% | — | — | — | — | — | — |
| próxima rep | último valor | 90% | 1.06 | 1.71% ± 0.41 | 0.35% | — | — | — | — | 1.96% |
| próxima rep | mediana | 24% | 1.15 | 1.53% ± 0.30 | 0.68% | 42% (68%) | 52% | 3.3% | 1.28% | 1.65% |
| próxima rep | modelo atual | 24% | 1.19 | 1.65% ± 0.31 | 0.45% | 41% (68%) | 51% | 3.3% | 1.34% | 1.77% |
| dia | _oráculo (véspera)_ | — | 0.69 | 0.97% | — | — | — | — | — | — |
| dia | último valor | 24% | 1.17 | 1.55% ± 0.30 | 0.75% | — | — | — | — | 1.67% |
| dia | mediana | 24% | 1.15 | 1.53% ± 0.30 | 0.68% | 42% (68%) | 52% | 3.3% | 1.28% | 1.65% |
| dia | modelo atual | 24% | 1.19 | 1.65% ± 0.31 | 0.45% | 41% (68%) | 51% | 3.3% | 1.34% | 1.77% |
| semana | último valor | 22% | 1.15 | 1.56% ± 0.32 | 0.81% | — | — | — | — | 1.68% |
| semana | mediana | 22% | 1.14 | 1.55% ± 0.31 | 0.75% | 42% (68%) | 51% | 3.2% | 1.28% | 1.67% |
| semana | modelo atual | 22% | 1.17 | 1.67% ± 0.36 | 0.54% | 40% (68%) | 50% | 3.2% | 1.35% | 1.79% |
| mês | último valor | 9% | 1.66 | 1.91% ± 0.80 | 1.58% | — | — | — | — | 1.91% |
| mês | mediana | 9% | 1.63 | 1.86% ± 0.78 | 1.51% | 30% (68%) | 41% | 2.2% | 1.52% | 1.86% |
| mês | modelo atual | 9% | 1.66 | 1.89% ± 0.76 | 1.42% | 31% (68%) | 41% | 2.2% | 1.55% | 1.89% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 2.09% · 100% | 1.64% · 100% | 1.52% · 100% | 1.28% · 100% | 1.00% · 100% |
| mediana | — | 2.29% · 100% · 31% | 1.61% · 100% · 51% | 1.52% · 100% · 52% | 1.14% · 100% · 70% | 0.80% · 100% · 92% |
| modelo atual | — | 1.98% · 100% · 58% | 1.87% · 100% · 48% | 1.58% · 100% · 54% | 1.53% · 100% · 59% | 2.27% · 100% · 74% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 |
|---|---|---|---|---|
| último valor | 0.99% · 11% | 1.53% · 24% | 1.69% · 28% | 1.69% · 26% |
| mediana | 0.98% · 11% · 59% | 1.50% · 24% · 52% | 1.68% · 28% · 46% | 1.55% · 26% · 57% |
| modelo atual | 1.04% · 11% · 57% | 1.57% · 24% · 52% | 1.73% · 28% · 46% | 1.72% · 26% · 55% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| média | 111 | 1.66% | 50% |
| alta | 23 | 1.53% | 59% |
| baixa | 7 | 1.98% | 58% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

### tipico · em-falta/base/carga

Típico: 26 semanas desde o regresso de setembro. 8 atletas, ~3607 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.47 | 0.78% | — | — | — | — | — | — |
| próxima rep | último valor | 95% | 0.92 | 1.68% ± 0.18 | 0.37% | — | — | — | — | 1.85% |
| próxima rep | mediana | 63% | 0.93 | 1.52% ± 0.10 | 0.54% | 64% (68%) | 72% | 7.7% | 1.55% | 1.67% |
| próxima rep | modelo atual | 63% | 1.16 | 1.89% ± 0.19 | 0.24% | 61% (68%) | 70% | 7.7% | 1.68% | 2.04% |
| dia | _oráculo (véspera)_ | — | 0.61 | 1.00% | — | — | — | — | — | — |
| dia | último valor | 63% | 0.97 | 1.58% ± 0.10 | 0.56% | — | — | — | — | 1.73% |
| dia | mediana | 63% | 0.93 | 1.52% ± 0.10 | 0.54% | 64% (68%) | 72% | 7.7% | 1.55% | 1.67% |
| dia | modelo atual | 63% | 1.16 | 1.89% ± 0.19 | 0.24% | 61% (68%) | 70% | 7.7% | 1.68% | 2.04% |
| semana | último valor | 61% | 1.00 | 1.61% ± 0.10 | 0.62% | — | — | — | — | 1.77% |
| semana | mediana | 61% | 0.95 | 1.55% ± 0.10 | 0.60% | 63% (68%) | 71% | 7.4% | 1.55% | 1.70% |
| semana | modelo atual | 61% | 1.17 | 1.90% ± 0.18 | 0.26% | 60% (68%) | 69% | 7.4% | 1.67% | 2.05% |
| mês | último valor | 46% | 1.07 | 1.74% ± 0.15 | 0.80% | — | — | — | — | 1.90% |
| mês | mediana | 46% | 1.03 | 1.67% ± 0.14 | 0.78% | 60% (68%) | 69% | 7.3% | 1.62% | 1.83% |
| mês | modelo atual | 46% | 1.24 | 2.00% ± 0.29 | 0.49% | 57% (68%) | 66% | 7.3% | 1.74% | 2.16% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.72% · 100% | 1.67% · 100% | 1.63% · 100% | 1.58% · 100% | 1.44% · 100% |
| mediana | — | 1.75% · 100% · 64% | 1.62% · 100% · 64% | 1.58% · 100% · 68% | 1.48% · 100% · 75% | 1.39% · 100% · 82% |
| modelo atual | — | 2.27% · 100% · 60% | 1.91% · 100% · 61% | 1.94% · 100% · 66% | 1.91% · 100% · 72% | 1.76% · 100% · 80% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 |
|---|---|---|---|---|---|
| último valor | 1.23% · 19% | 1.30% · 36% | 1.64% · 48% | 1.60% · 61% | 1.59% · 81% |
| mediana | 1.20% · 19% · 57% | 1.27% · 36% · 52% | 1.59% · 48% · 56% | 1.56% · 61% · 67% | 1.51% · 81% · 80% |
| modelo atual | 1.22% · 19% · 57% | 1.42% · 36% · 50% | 1.77% · 48% · 56% | 1.93% · 61% · 64% | 1.95% · 81% · 77% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 1652 | 1.92% | 74% |
| baixa | 21 | 2.27% | 60% |
| média | 606 | 1.80% | 58% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

### denso · em-falta/base/carga

Denso: 40 semanas, muitos treinos e tempos. 6 atletas, ~7021 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.49 | 0.78% | — | — | — | — | — | — |
| próxima rep | último valor | 97% | 0.93 | 1.55% ± 0.14 | 0.26% | — | — | — | — | 1.68% |
| próxima rep | mediana | 77% | 0.98 | 1.51% ± 0.08 | 0.53% | 69% (68%) | 77% | 7.7% | 1.50% | 1.64% |
| próxima rep | modelo atual | 77% | 1.16 | 1.80% ± 0.15 | 0.21% | 67% (68%) | 74% | 7.7% | 1.61% | 1.93% |
| dia | _oráculo (véspera)_ | — | 0.63 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 77% | 1.03 | 1.59% ± 0.08 | 0.51% | — | — | — | — | 1.72% |
| dia | mediana | 77% | 0.98 | 1.51% ± 0.08 | 0.53% | 69% (68%) | 77% | 7.7% | 1.50% | 1.64% |
| dia | modelo atual | 77% | 1.16 | 1.80% ± 0.15 | 0.21% | 67% (68%) | 74% | 7.7% | 1.61% | 1.93% |
| semana | último valor | 75% | 1.05 | 1.61% ± 0.08 | 0.55% | — | — | — | — | 1.74% |
| semana | mediana | 75% | 1.00 | 1.54% ± 0.08 | 0.57% | 68% (68%) | 76% | 7.6% | 1.51% | 1.67% |
| semana | modelo atual | 75% | 1.17 | 1.81% ± 0.14 | 0.24% | 66% (68%) | 74% | 7.6% | 1.61% | 1.94% |
| mês | último valor | 62% | 1.14 | 1.76% ± 0.08 | 0.77% | — | — | — | — | 1.89% |
| mês | mediana | 62% | 1.09 | 1.68% ± 0.09 | 0.81% | 63% (68%) | 71% | 7.5% | 1.63% | 1.81% |
| mês | modelo atual | 62% | 1.25 | 1.95% ± 0.14 | 0.50% | 62% (68%) | 70% | 7.5% | 1.71% | 2.08% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 2.07% · 100% | 1.65% · 100% | 1.73% · 100% | 1.65% · 100% | 1.55% · 100% | 1.53% · 100% |
| mediana | — | — | 1.67% · 100% · 59% | 1.68% · 100% · 64% | 1.60% · 100% · 68% | 1.47% · 100% · 77% | 1.44% · 100% · 85% |
| modelo atual | — | — | 1.94% · 100% · 56% | 1.93% · 100% · 62% | 1.90% · 100% · 65% | 1.80% · 100% · 74% | 1.70% · 100% · 84% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 |
|---|---|---|---|---|---|
| último valor | 1.33% · 25% | 1.35% · 48% | 1.57% · 58% | 1.65% · 72% | 1.59% · 85% |
| mediana | 1.29% · 25% · 53% | 1.30% · 48% · 58% | 1.53% · 58% · 59% | 1.59% · 72% · 70% | 1.50% · 85% · 81% |
| modelo atual | 1.45% · 25% · 48% | 1.52% · 48% · 52% | 1.80% · 58% · 56% | 1.92% · 72% · 67% | 1.78% · 85% · 79% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4437 | 1.78% | 78% |
| baixa | 36 | 1.94% | 56% |
| média | 894 | 1.87% | 57% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

## Regimes (multi-ano e regresso de agosto)

### multiano · em-falta/base/carga

Multi-ano: 4 épocas com férias de agosto e crescimento. 10 atletas, ~27193 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.58 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 89% | 0.98 | 1.65% ± 0.05 | 0.58% | — | — | — | — | 1.83% |
| dia | mediana | 89% | 0.94 | 1.58% ± 0.05 | 0.55% | 84% (68%) | 89% | 12.3% | 1.87% | 1.76% |
| dia | modelo atual | 89% | 1.08 | 1.86% ± 0.07 | 0.29% | 83% (68%) | 88% | 12.3% | 1.93% | 2.03% |
| semana | último valor | 88% | 1.00 | 1.67% ± 0.05 | 0.61% | — | — | — | — | 1.85% |
| semana | mediana | 88% | 0.96 | 1.61% ± 0.05 | 0.58% | 84% (68%) | 89% | 12.2% | 1.88% | 1.78% |
| semana | modelo atual | 88% | 1.10 | 1.88% ± 0.07 | 0.33% | 83% (68%) | 88% | 12.2% | 1.94% | 2.05% |
| mês | último valor | 84% | 1.05 | 1.77% ± 0.06 | 0.74% | — | — | — | — | 1.95% |
| mês | mediana | 84% | 1.01 | 1.70% ± 0.05 | 0.72% | 82% (68%) | 87% | 12.3% | 1.94% | 1.88% |
| mês | modelo atual | 84% | 1.13 | 1.95% ± 0.06 | 0.46% | 82% (68%) | 87% | 12.3% | 1.99% | 2.12% |
| ano | último valor | 62% | 1.41 | 2.34% ± 0.16 | 1.76% | — | — | — | — | 2.52% |
| ano | mediana | 62% | 1.39 | 2.29% ± 0.17 | 1.74% | 71% (68%) | 77% | 11.5% | 2.24% | 2.47% |
| ano | modelo atual | 62% | 1.38 | 2.34% ± 0.14 | 1.41% | 74% (68%) | 80% | 11.5% | 2.16% | 2.51% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 0.68% · 100% | 2.02% · 100% | 1.92% · 100% | 1.80% · 100% | 1.70% · 100% | 1.58% · 100% |
| mediana | — | — | 1.98% · 100% · 67% | 1.85% · 100% · 71% | 1.76% · 100% · 76% | 1.64% · 100% · 85% | 1.51% · 100% · 94% |
| modelo atual | — | — | 2.20% · 100% · 67% | 2.08% · 100% · 70% | 2.02% · 100% · 75% | 1.98% · 100% · 84% | 1.77% · 100% · 94% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 | ano 3+ |
|---|---|---|---|---|---|---|---|
| último valor | 1.14% · 21% | 1.46% · 34% | 1.55% · 51% | 1.58% · 60% | 1.59% · 76% | 1.67% · 95% | 1.67% · 99% |
| mediana | 1.10% · 21% · 61% | 1.43% · 34% · 49% | 1.55% · 51% · 54% | 1.52% · 60% · 68% | 1.52% · 76% · 78% | 1.61% · 95% · 89% | 1.60% · 99% · 95% |
| modelo atual | 1.13% · 21% · 60% | 1.50% · 34% · 49% | 1.71% · 51% · 54% | 2.01% · 60% · 66% | 1.90% · 76% · 75% | 1.86% · 95% · 89% | 1.85% · 99% · 95% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.79% · 90% | 1.55% · 90% | 1.56% · 94% | 1.70% · 94% |
| mediana | 1.71% · 90% · 93% | 1.50% · 90% · 92% | 1.50% · 94% · 93% | 1.64% · 94% · 91% |
| modelo atual | 2.14% · 90% · 90% | 1.73% · 90% · 91% | 1.77% · 94% · 91% | 1.80% · 94% · 91% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 22141 | 1.85% | 90% |
| baixa | 58 | 2.20% | 67% |
| média | 1832 | 2.00% | 65% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

### regresso-curta · em-falta/base/carga

Regresso após pausa curta (3 semanas). 8 atletas, ~7551 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.60 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 72% | 0.97 | 1.56% ± 0.05 | 0.48% | — | — | — | — | 1.70% |
| dia | mediana | 72% | 0.93 | 1.49% ± 0.04 | 0.43% | 70% (68%) | 77% | 8.5% | 1.57% | 1.64% |
| dia | modelo atual | 72% | 1.14 | 1.84% ± 0.13 | 0.32% | 67% (68%) | 75% | 8.5% | 1.69% | 1.98% |
| semana | último valor | 71% | 0.98 | 1.58% ± 0.06 | 0.51% | — | — | — | — | 1.73% |
| semana | mediana | 71% | 0.94 | 1.51% ± 0.05 | 0.47% | 69% (68%) | 77% | 8.5% | 1.58% | 1.66% |
| semana | modelo atual | 71% | 1.13 | 1.83% ± 0.12 | 0.35% | 67% (68%) | 74% | 8.5% | 1.69% | 1.98% |
| mês | último valor | 61% | 1.05 | 1.68% ± 0.06 | 0.65% | — | — | — | — | 1.83% |
| mês | mediana | 61% | 1.01 | 1.60% ± 0.07 | 0.60% | 66% (68%) | 74% | 8.2% | 1.61% | 1.76% |
| mês | modelo atual | 61% | 1.16 | 1.88% ± 0.13 | 0.43% | 65% (68%) | 73% | 8.2% | 1.71% | 2.04% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.75% · 100% | 1.62% · 100% | 1.56% · 100% | 1.56% · 100% | 1.51% · 100% |
| mediana | — | 1.73% · 100% · 64% | 1.57% · 100% · 67% | 1.52% · 100% · 71% | 1.48% · 100% · 77% | 1.43% · 100% · 86% |
| modelo atual | — | 2.07% · 100% · 63% | 1.81% · 100% · 64% | 1.85% · 100% · 68% | 1.89% · 100% · 74% | 1.78% · 100% · 85% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 |
|---|---|---|---|---|---|---|
| último valor | 1.25% · 27% | 1.44% · 30% | 1.32% · 43% | 1.53% · 58% | 1.55% · 77% | 1.66% · 96% |
| mediana | 1.24% · 27% · 58% | 1.39% · 30% · 51% | 1.28% · 43% · 59% | 1.49% · 58% · 66% | 1.48% · 77% · 77% | 1.59% · 96% · 88% |
| modelo atual | 1.28% · 27% · 56% | 1.74% · 30% · 51% | 1.56% · 43% · 53% | 1.81% · 58% · 62% | 1.87% · 77% · 74% | 1.84% · 96% · 88% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.64% · 83% | 1.46% · 95% | 1.54% · 94% | 1.69% · 96% |
| mediana | 1.64% · 83% · 86% | 1.38% · 95% · 90% | 1.48% · 94% · 89% | 1.62% · 96% · 88% |
| modelo atual | 1.80% · 83% · 88% | 1.64% · 95% · 89% | 1.82% · 94% · 87% | 1.88% · 96% · 88% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4309 | 1.85% | 78% |
| baixa | 43 | 2.07% | 63% |
| média | 1098 | 1.77% | 60% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

### regresso-longa · em-falta/base/carga

Regresso após pausa longa (7 semanas). 8 atletas, ~7777 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.61 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 73% | 1.03 | 1.62% ± 0.04 | 0.55% | — | — | — | — | 1.77% |
| dia | mediana | 73% | 0.99 | 1.56% ± 0.05 | 0.53% | 69% (68%) | 77% | 7.5% | 1.50% | 1.71% |
| dia | modelo atual | 73% | 1.16 | 1.83% ± 0.09 | 0.21% | 67% (68%) | 74% | 7.5% | 1.60% | 1.98% |
| semana | último valor | 71% | 1.05 | 1.65% ± 0.04 | 0.59% | — | — | — | — | 1.80% |
| semana | mediana | 71% | 1.01 | 1.59% ± 0.05 | 0.57% | 69% (68%) | 76% | 7.5% | 1.52% | 1.73% |
| semana | modelo atual | 71% | 1.17 | 1.86% ± 0.10 | 0.27% | 66% (68%) | 74% | 7.5% | 1.62% | 2.00% |
| mês | último valor | 61% | 1.16 | 1.79% ± 0.09 | 0.75% | — | — | — | — | 1.94% |
| mês | mediana | 61% | 1.11 | 1.71% ± 0.09 | 0.72% | 65% (68%) | 73% | 7.3% | 1.59% | 1.86% |
| mês | modelo atual | 61% | 1.23 | 1.92% ± 0.09 | 0.39% | 64% (68%) | 72% | 7.3% | 1.65% | 2.07% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.83% · 100% | 1.76% · 100% | 1.63% · 100% | 1.63% · 100% | 1.55% · 100% |
| mediana | — | 1.77% · 100% · 57% | 1.71% · 100% · 65% | 1.59% · 100% · 70% | 1.56% · 100% · 78% | 1.48% · 100% · 87% |
| modelo atual | — | 1.77% · 100% · 58% | 1.96% · 100% · 63% | 1.85% · 100% · 67% | 1.89% · 100% · 74% | 1.72% · 100% · 85% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 |
|---|---|---|---|---|---|---|
| último valor | 1.10% · 14% | 1.26% · 34% | 1.46% · 49% | 1.61% · 59% | 1.62% · 76% | 1.70% · 95% |
| mediana | 1.10% · 14% · 62% | 1.27% · 34% · 53% | 1.45% · 49% · 57% | 1.57% · 59% · 67% | 1.54% · 76% · 76% | 1.66% · 95% · 89% |
| modelo atual | 1.11% · 14% · 62% | 1.30% · 34% · 54% | 1.57% · 49% · 52% | 1.84% · 59% · 64% | 1.87% · 76% · 73% | 1.82% · 95% · 89% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.89% · 93% | 1.63% · 91% | 1.56% · 93% | 1.74% · 96% |
| mediana | 1.82% · 93% · 86% | 1.61% · 91% · 86% | 1.51% · 93% · 92% | 1.69% · 96% · 89% |
| modelo atual | 2.09% · 93% · 80% | 1.83% · 91% · 86% | 1.74% · 93% · 90% | 1.81% · 96% · 90% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4457 | 1.83% | 79% |
| baixa | 30 | 1.77% | 58% |
| média | 1151 | 1.85% | 59% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

### regresso-tardia · em-falta/base/carga

Regresso tardio: ~40 % dos atletas voltam 3–5 semanas depois. 8 atletas, ~7690 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.61 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 73% | 1.01 | 1.59% ± 0.06 | 0.50% | — | — | — | — | 1.75% |
| dia | mediana | 73% | 0.97 | 1.53% ± 0.04 | 0.47% | 69% (68%) | 77% | 8.7% | 1.61% | 1.69% |
| dia | modelo atual | 73% | 1.16 | 1.87% ± 0.15 | 0.23% | 67% (68%) | 75% | 8.7% | 1.72% | 2.03% |
| semana | último valor | 71% | 1.03 | 1.62% ± 0.06 | 0.53% | — | — | — | — | 1.78% |
| semana | mediana | 71% | 0.99 | 1.55% ± 0.05 | 0.50% | 69% (68%) | 76% | 8.7% | 1.62% | 1.71% |
| semana | modelo atual | 71% | 1.17 | 1.88% ± 0.13 | 0.30% | 67% (68%) | 74% | 8.7% | 1.73% | 2.04% |
| mês | último valor | 61% | 1.09 | 1.72% ± 0.08 | 0.67% | — | — | — | — | 1.87% |
| mês | mediana | 61% | 1.05 | 1.65% ± 0.05 | 0.62% | 66% (68%) | 74% | 8.5% | 1.67% | 1.80% |
| mês | modelo atual | 61% | 1.22 | 1.95% ± 0.16 | 0.45% | 65% (68%) | 73% | 8.5% | 1.76% | 2.10% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.84% · 100% | 1.68% · 100% | 1.64% · 100% | 1.55% · 100% | 1.56% · 100% |
| mediana | — | 1.79% · 100% · 58% | 1.63% · 100% · 67% | 1.59% · 100% · 69% | 1.47% · 100% · 78% | 1.49% · 100% · 86% |
| modelo atual | — | 2.20% · 100% · 57% | 1.90% · 100% · 64% | 1.92% · 100% · 66% | 1.88% · 100% · 77% | 1.80% · 100% · 85% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 |
|---|---|---|---|---|---|---|
| último valor | 1.45% · 21% | 1.51% · 37% | 1.42% · 49% | 1.54% · 57% | 1.56% · 77% | 1.75% · 95% |
| mediana | 1.43% · 21% · 43% | 1.49% · 37% · 49% | 1.40% · 49% · 56% | 1.47% · 57% · 64% | 1.49% · 77% · 77% | 1.69% · 95% · 88% |
| modelo atual | 1.46% · 21% · 43% | 1.63% · 37% · 47% | 1.50% · 49% · 55% | 1.79% · 57% · 61% | 1.90% · 77% · 75% | 1.93% · 95% · 88% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.90% · 90% | 1.66% · 94% | 1.67% · 94% | 1.75% · 96% |
| mediana | 1.87% · 90% · 82% | 1.65% · 94% · 86% | 1.62% · 94% · 88% | 1.68% · 96% · 90% |
| modelo atual | 2.15% · 90% · 79% | 1.83% · 94% · 86% | 1.98% · 94% · 87% | 1.87% · 96% · 90% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4423 | 1.88% | 79% |
| baixa | 34 | 2.20% | 57% |
| média | 1106 | 1.80% | 59% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0.

## Matriz (horizonte dia, 5 sementes): MAPE em reps limpas · reps previstas

| Célula | último valor | mediana | modelo atual | oráculo |
|---|---|---|---|---|
| arranque · completos/baixo/nenhum | 1.38% · 55% | 1.35% · 55% | 1.52% · 55% | 0.97% |
| arranque · completos/baixo/basico | 1.38% · 55% | 1.35% · 55% | 1.52% · 55% | 0.97% |
| arranque · completos/baixo/carga | 1.38% · 55% | 1.35% · 55% | 1.52% · 55% | 0.97% |
| arranque · completos/baixo/bem-estar | 1.35% · 56% | 1.32% · 56% | 1.46% · 56% | 0.95% |
| arranque · completos/base/nenhum | 1.35% · 64% | 1.34% · 64% | 1.55% · 64% | 0.93% |
| arranque · completos/base/basico | 1.35% · 64% | 1.34% · 64% | 1.55% · 64% | 0.93% |
| arranque · completos/base/carga | 1.35% · 64% | 1.34% · 64% | 1.56% · 64% | 0.93% |
| arranque · completos/base/bem-estar | 1.37% · 66% | 1.35% · 66% | 1.52% · 66% | 0.93% |
| arranque · completos/alto/nenhum | 1.34% · 74% | 1.33% · 74% | 1.57% · 74% | 0.93% |
| arranque · completos/alto/basico | 1.34% · 74% | 1.33% · 74% | 1.57% · 74% | 0.93% |
| arranque · completos/alto/carga | 1.34% · 74% | 1.33% · 74% | 1.57% · 74% | 0.93% |
| arranque · completos/alto/bem-estar | 1.38% · 73% | 1.38% · 73% | 1.54% · 73% | 0.93% |
| arranque · em-falta/baixo/nenhum | 1.10% · 11% | 1.14% · 11% | 1.23% · 11% | 1.01% |
| arranque · em-falta/baixo/basico | 1.50% · 18% | 1.49% · 18% | 1.61% · 18% | 1.03% |
| arranque · em-falta/baixo/carga | 1.50% · 18% | 1.49% · 18% | 1.61% · 18% | 1.03% |
| arranque · em-falta/baixo/bem-estar | 1.60% · 14% | 1.59% · 14% | 1.82% · 14% | 0.99% |
| arranque · em-falta/base/nenhum | 1.80% · 18% | 1.78% · 18% | 1.75% · 18% | 1.00% |
| arranque · em-falta/base/basico | 1.60% · 19% | 1.58% · 19% | 1.74% · 19% | 0.98% |
| arranque · em-falta/base/bem-estar | 1.24% · 20% | 1.20% · 20% | 1.22% · 20% | 0.98% |
| arranque · em-falta/alto/nenhum | 1.47% · 29% | 1.46% · 29% | 1.84% · 29% | 0.94% |
| arranque · em-falta/alto/basico | 1.50% · 34% | 1.46% · 34% | 1.75% · 34% | 0.96% |
| arranque · em-falta/alto/carga | 1.50% · 34% | 1.46% · 34% | 1.77% · 34% | 0.96% |
| arranque · em-falta/alto/bem-estar | 1.52% · 34% | 1.51% · 34% | 1.68% · 34% | 0.97% |
| esparso · completos/baixo/nenhum | 1.32% · 63% | 1.29% · 63% | 1.38% · 63% | 0.95% |
| esparso · completos/baixo/basico | 1.32% · 63% | 1.29% · 63% | 1.38% · 63% | 0.95% |
| esparso · completos/baixo/carga | 1.32% · 63% | 1.29% · 63% | 1.38% · 63% | 0.95% |
| esparso · completos/baixo/bem-estar | 1.34% · 61% | 1.30% · 61% | 1.56% · 61% | 0.96% |
| esparso · completos/base/nenhum | 1.33% · 72% | 1.34% · 72% | 1.50% · 72% | 0.94% |
| esparso · completos/base/basico | 1.33% · 72% | 1.34% · 72% | 1.50% · 72% | 0.94% |
| esparso · completos/base/carga | 1.33% · 72% | 1.34% · 72% | 1.50% · 72% | 0.94% |
| esparso · completos/base/bem-estar | 1.36% · 72% | 1.34% · 72% | 1.44% · 72% | 0.95% |
| esparso · completos/alto/nenhum | 1.36% · 81% | 1.41% · 81% | 1.46% · 81% | 0.93% |
| esparso · completos/alto/basico | 1.36% · 81% | 1.41% · 81% | 1.46% · 81% | 0.93% |
| esparso · completos/alto/carga | 1.36% · 81% | 1.41% · 81% | 1.46% · 81% | 0.93% |
| esparso · completos/alto/bem-estar | 1.37% · 80% | 1.43% · 80% | 1.54% · 80% | 0.93% |
| esparso · em-falta/baixo/nenhum | 1.70% · 16% | 1.69% · 16% | 1.67% · 16% | 0.99% |
| esparso · em-falta/baixo/basico | 1.53% · 20% | 1.46% · 20% | 1.52% · 20% | 0.99% |
| esparso · em-falta/baixo/carga | 1.53% · 20% | 1.46% · 20% | 1.53% · 20% | 0.99% |
| esparso · em-falta/baixo/bem-estar | 1.33% · 14% | 1.30% · 14% | 1.35% · 14% | 0.93% |
| esparso · em-falta/base/nenhum | 1.50% · 29% | 1.45% · 29% | 1.49% · 29% | 0.97% |
| esparso · em-falta/base/basico | 1.60% · 25% | 1.56% · 25% | 1.63% · 25% | 0.96% |
| esparso · em-falta/base/bem-estar | 1.63% · 23% | 1.57% · 23% | 1.58% · 23% | 0.97% |
| esparso · em-falta/alto/nenhum | 1.69% · 34% | 1.71% · 34% | 1.88% · 34% | 0.96% |
| esparso · em-falta/alto/basico | 1.69% · 29% | 1.70% · 29% | 1.88% · 29% | 0.96% |
| esparso · em-falta/alto/carga | 1.69% · 29% | 1.70% · 29% | 1.88% · 29% | 0.96% |
| esparso · em-falta/alto/bem-estar | 1.91% · 30% | 1.89% · 30% | 2.07% · 30% | 0.97% |
| tipico · completos/baixo/nenhum | 1.38% · 83% | 1.32% · 83% | 1.47% · 83% | 0.99% |
| tipico · completos/baixo/basico | 1.38% · 83% | 1.32% · 83% | 1.48% · 83% | 0.99% |
| tipico · completos/baixo/carga | 1.38% · 83% | 1.32% · 83% | 1.48% · 83% | 0.99% |
| tipico · completos/baixo/bem-estar | 1.36% · 83% | 1.30% · 83% | 1.51% · 83% | 0.98% |
| tipico · completos/base/nenhum | 1.40% · 89% | 1.33% · 89% | 1.41% · 89% | 0.97% |
| tipico · completos/base/basico | 1.40% · 89% | 1.33% · 89% | 1.41% · 89% | 0.97% |
| tipico · completos/base/carga | 1.40% · 89% | 1.33% · 89% | 1.41% · 89% | 0.97% |
| tipico · completos/base/bem-estar | 1.38% · 88% | 1.32% · 88% | 1.44% · 88% | 0.97% |
| tipico · completos/alto/nenhum | 1.42% · 92% | 1.40% · 92% | 1.47% · 92% | 0.97% |
| tipico · completos/alto/basico | 1.42% · 92% | 1.40% · 92% | 1.47% · 92% | 0.97% |
| tipico · completos/alto/carga | 1.42% · 92% | 1.40% · 92% | 1.47% · 92% | 0.97% |
| tipico · completos/alto/bem-estar | 1.42% · 92% | 1.39% · 92% | 1.44% · 92% | 0.97% |
| tipico · em-falta/baixo/nenhum | 1.52% · 52% | 1.48% · 52% | 1.77% · 52% | 1.00% |
| tipico · em-falta/baixo/basico | 1.55% · 53% | 1.50% · 53% | 1.73% · 53% | 1.02% |
| tipico · em-falta/baixo/carga | 1.55% · 53% | 1.50% · 53% | 1.73% · 53% | 1.02% |
| tipico · em-falta/baixo/bem-estar | 1.56% · 51% | 1.48% · 51% | 1.80% · 51% | 1.01% |
| tipico · em-falta/base/nenhum | 1.60% · 62% | 1.56% · 62% | 1.86% · 62% | 1.00% |
| tipico · em-falta/base/basico | 1.57% · 63% | 1.52% · 63% | 1.82% · 63% | 1.00% |
| tipico · em-falta/base/bem-estar | 1.56% · 63% | 1.49% · 63% | 1.88% · 63% | 0.99% |
| tipico · em-falta/alto/nenhum | 1.64% · 71% | 1.59% · 71% | 1.96% · 71% | 0.99% |
| tipico · em-falta/alto/basico | 1.63% · 71% | 1.58% · 71% | 1.86% · 71% | 1.00% |
| tipico · em-falta/alto/carga | 1.63% · 71% | 1.58% · 71% | 1.86% · 71% | 1.00% |
| tipico · em-falta/alto/bem-estar | 1.68% · 73% | 1.62% · 73% | 2.04% · 73% | 1.01% |
| denso · completos/baixo/nenhum | 1.39% · 87% | 1.31% · 87% | 1.42% · 87% | 0.95% |
| denso · completos/baixo/basico | 1.39% · 87% | 1.31% · 87% | 1.42% · 87% | 0.95% |
| denso · completos/baixo/carga | 1.39% · 87% | 1.31% · 87% | 1.42% · 87% | 0.95% |
| denso · completos/baixo/bem-estar | 1.40% · 87% | 1.32% · 87% | 1.46% · 87% | 0.96% |
| denso · completos/base/nenhum | 1.42% · 92% | 1.34% · 92% | 1.39% · 92% | 0.95% |
| denso · completos/base/basico | 1.42% · 92% | 1.34% · 92% | 1.39% · 92% | 0.95% |
| denso · completos/base/carga | 1.42% · 92% | 1.34% · 92% | 1.40% · 92% | 0.95% |
| denso · completos/base/bem-estar | 1.40% · 92% | 1.34% · 92% | 1.42% · 92% | 0.94% |
| denso · completos/alto/nenhum | 1.38% · 95% | 1.35% · 95% | 1.40% · 95% | 0.94% |
| denso · completos/alto/basico | 1.38% · 95% | 1.35% · 95% | 1.40% · 95% | 0.94% |
| denso · completos/alto/carga | 1.38% · 95% | 1.35% · 95% | 1.41% · 95% | 0.94% |
| denso · completos/alto/bem-estar | 1.39% · 95% | 1.36% · 95% | 1.40% · 95% | 0.95% |
| denso · em-falta/baixo/nenhum | 1.53% · 63% | 1.47% · 63% | 1.69% · 63% | 0.98% |
| denso · em-falta/baixo/basico | 1.57% · 66% | 1.50% · 66% | 1.76% · 66% | 0.99% |
| denso · em-falta/baixo/carga | 1.57% · 66% | 1.50% · 66% | 1.76% · 66% | 0.99% |
| denso · em-falta/baixo/bem-estar | 1.57% · 65% | 1.48% · 65% | 1.92% · 65% | 1.00% |
| denso · em-falta/base/nenhum | 1.59% · 76% | 1.51% · 76% | 1.91% · 76% | 0.97% |
| denso · em-falta/base/basico | 1.55% · 77% | 1.48% · 77% | 1.77% · 77% | 0.97% |
| denso · em-falta/base/bem-estar | 1.58% · 77% | 1.51% · 77% | 1.81% · 77% | 0.99% |
| denso · em-falta/alto/nenhum | 1.59% · 83% | 1.54% · 83% | 1.81% · 83% | 0.98% |
| denso · em-falta/alto/basico | 1.54% · 83% | 1.51% · 83% | 1.78% · 83% | 0.98% |
| denso · em-falta/alto/carga | 1.54% · 83% | 1.51% · 83% | 1.78% · 83% | 0.98% |
| denso · em-falta/alto/bem-estar | 1.61% · 83% | 1.57% · 83% | 1.86% · 83% | 0.99% |
