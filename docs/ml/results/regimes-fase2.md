# Regimes — campeão da Fase 2 vs referências

Dados **sintéticos** (gerador 2.0), sementes de teste. Protocolo: `docs/ml/protocolo.md`. Métricas em reps limpas (sem erro de digitação), média ± desvio entre sementes.

## Regimes (multi-ano e regresso de agosto)

### multiano · em-falta/base/carga

Multi-ano: 4 épocas com férias de agosto e crescimento. 10 atletas, ~27193 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.58 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 89% | 0.98 | 1.65% ± 0.05 | 0.58% | — | — | — | — | 1.83% |
| dia | mediana | 89% | 0.94 | 1.58% ± 0.05 | 0.55% | 84% (68%) | 89% | 12.3% | 1.87% | 1.76% |
| dia | modelo atual | 89% | 1.08 | 1.86% ± 0.07 | 0.29% | 83% (68%) | 88% | 12.3% | 1.93% | 2.03% |
| dia | modelo de estado + qualidade + conformal | 100% | 0.76 | 1.30% ± 0.04 | 0.04% | 80% (80%) | 80% | 4.3% | 0.93% | 1.47% |
| semana | último valor | 88% | 1.00 | 1.67% ± 0.05 | 0.61% | — | — | — | — | 1.85% |
| semana | mediana | 88% | 0.96 | 1.61% ± 0.05 | 0.58% | 84% (68%) | 89% | 12.2% | 1.88% | 1.78% |
| semana | modelo atual | 88% | 1.10 | 1.88% ± 0.07 | 0.33% | 83% (68%) | 88% | 12.2% | 1.94% | 2.05% |
| semana | modelo de estado + qualidade + conformal | 100% | 0.79 | 1.34% ± 0.05 | 0.06% | 80% (80%) | 80% | 4.4% | 0.96% | 1.51% |
| mês | último valor | 84% | 1.05 | 1.77% ± 0.06 | 0.74% | — | — | — | — | 1.95% |
| mês | mediana | 84% | 1.01 | 1.70% ± 0.05 | 0.72% | 82% (68%) | 87% | 12.3% | 1.94% | 1.88% |
| mês | modelo atual | 84% | 1.13 | 1.95% ± 0.06 | 0.46% | 82% (68%) | 87% | 12.3% | 1.99% | 2.12% |
| mês | modelo de estado + qualidade + conformal | 100% | 0.98 | 1.60% ± 0.07 | -0.09% | 80% (80%) | 80% | 5.9% | 1.18% | 1.77% |
| ano | último valor | 62% | 1.41 | 2.34% ± 0.16 | 1.76% | — | — | — | — | 2.52% |
| ano | mediana | 62% | 1.39 | 2.29% ± 0.17 | 1.74% | 71% (68%) | 77% | 11.5% | 2.24% | 2.47% |
| ano | modelo atual | 62% | 1.38 | 2.34% ± 0.14 | 1.41% | 74% (68%) | 80% | 11.5% | 2.16% | 2.51% |
| ano | modelo de estado + qualidade + conformal | 100% | 2.04 | 3.36% ± 0.24 | -1.05% | 79% (80%) | 79% | 19.8% | 2.94% | 3.52% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 0.68% · 100% | 2.02% · 100% | 1.92% · 100% | 1.80% · 100% | 1.70% · 100% | 1.58% · 100% |
| mediana | — | — | 1.98% · 100% · 67% | 1.85% · 100% · 71% | 1.76% · 100% · 76% | 1.64% · 100% · 85% | 1.51% · 100% · 94% |
| modelo atual | — | — | 2.20% · 100% · 67% | 2.08% · 100% · 70% | 2.02% · 100% · 75% | 1.98% · 100% · 84% | 1.77% · 100% · 94% |
| modelo de estado + qualidade + conformal | 1.78% · 100% · 80% | 0.53% · 100% · 100% | 1.24% · 100% · 83% | 1.27% · 100% · 80% | 1.25% · 100% · 80% | 1.25% · 100% · 80% | 1.22% · 100% · 80% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 | ano 3+ |
|---|---|---|---|---|---|---|---|
| último valor | 1.14% · 21% | 1.46% · 34% | 1.55% · 51% | 1.58% · 60% | 1.59% · 76% | 1.67% · 95% | 1.67% · 99% |
| mediana | 1.10% · 21% · 61% | 1.43% · 34% · 49% | 1.55% · 51% · 54% | 1.52% · 60% · 68% | 1.52% · 76% · 78% | 1.61% · 95% · 89% | 1.60% · 99% · 95% |
| modelo atual | 1.13% · 21% · 60% | 1.50% · 34% · 49% | 1.71% · 51% · 54% | 2.01% · 60% · 66% | 1.90% · 76% · 75% | 1.86% · 95% · 89% | 1.85% · 99% · 95% |
| modelo de estado + qualidade + conformal | 3.18% · 100% · 80% | 1.85% · 100% · 80% | 1.79% · 100% · 75% | 1.54% · 100% · 80% | 1.28% · 100% · 81% | 1.24% · 100% · 80% | 1.23% · 100% · 80% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.79% · 90% | 1.55% · 90% | 1.56% · 94% | 1.70% · 94% |
| mediana | 1.71% · 90% · 93% | 1.50% · 90% · 92% | 1.50% · 94% · 93% | 1.64% · 94% · 91% |
| modelo atual | 2.14% · 90% · 90% | 1.73% · 90% · 91% | 1.77% · 94% · 91% | 1.80% · 94% · 91% |
| modelo de estado + qualidade + conformal | 1.30% · 100% · 83% | 1.24% · 100% · 79% | 1.24% · 100% · 78% | 1.29% · 100% · 79% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 22141 | 1.85% | 90% |
| baixa | 58 | 2.20% | 67% |
| média | 1832 | 2.00% | 65% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.

### regresso-curta · em-falta/base/carga

Regresso após pausa curta (3 semanas). 8 atletas, ~7551 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.60 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 72% | 0.97 | 1.56% ± 0.05 | 0.48% | — | — | — | — | 1.70% |
| dia | mediana | 72% | 0.93 | 1.49% ± 0.04 | 0.43% | 70% (68%) | 77% | 8.5% | 1.57% | 1.64% |
| dia | modelo atual | 72% | 1.14 | 1.84% ± 0.13 | 0.32% | 67% (68%) | 75% | 8.5% | 1.69% | 1.98% |
| dia | modelo de estado + qualidade + conformal | 100% | 0.87 | 1.42% ± 0.04 | 0.07% | 80% (80%) | 80% | 4.7% | 1.02% | 1.57% |
| semana | último valor | 71% | 0.98 | 1.58% ± 0.06 | 0.51% | — | — | — | — | 1.73% |
| semana | mediana | 71% | 0.94 | 1.51% ± 0.05 | 0.47% | 69% (68%) | 77% | 8.5% | 1.58% | 1.66% |
| semana | modelo atual | 71% | 1.13 | 1.83% ± 0.12 | 0.35% | 67% (68%) | 74% | 8.5% | 1.69% | 1.98% |
| semana | modelo de estado + qualidade + conformal | 100% | 0.92 | 1.48% ± 0.03 | 0.07% | 80% (80%) | 80% | 5.0% | 1.07% | 1.63% |
| mês | último valor | 61% | 1.05 | 1.68% ± 0.06 | 0.65% | — | — | — | — | 1.83% |
| mês | mediana | 61% | 1.01 | 1.60% ± 0.07 | 0.60% | 66% (68%) | 74% | 8.2% | 1.61% | 1.76% |
| mês | modelo atual | 61% | 1.16 | 1.88% ± 0.13 | 0.43% | 65% (68%) | 73% | 8.2% | 1.71% | 2.04% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.19 | 1.82% ± 0.09 | -0.06% | 80% (80%) | 80% | 7.1% | 1.37% | 1.97% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.75% · 100% | 1.62% · 100% | 1.56% · 100% | 1.56% · 100% | 1.51% · 100% |
| mediana | — | 1.73% · 100% · 64% | 1.57% · 100% · 67% | 1.52% · 100% · 71% | 1.48% · 100% · 77% | 1.43% · 100% · 86% |
| modelo atual | — | 2.07% · 100% · 63% | 1.81% · 100% · 64% | 1.85% · 100% · 68% | 1.89% · 100% · 74% | 1.78% · 100% · 85% |
| modelo de estado + qualidade + conformal | 1.88% · 100% · 79% | 1.31% · 100% · 78% | 1.28% · 100% · 79% | 1.26% · 100% · 80% | 1.25% · 100% · 79% | 1.19% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 |
|---|---|---|---|---|---|---|
| último valor | 1.25% · 27% | 1.44% · 30% | 1.32% · 43% | 1.53% · 58% | 1.55% · 77% | 1.66% · 96% |
| mediana | 1.24% · 27% · 58% | 1.39% · 30% · 51% | 1.28% · 43% · 59% | 1.49% · 58% · 66% | 1.48% · 77% · 77% | 1.59% · 96% · 88% |
| modelo atual | 1.28% · 27% · 56% | 1.74% · 30% · 51% | 1.56% · 43% · 53% | 1.81% · 58% · 62% | 1.87% · 77% · 74% | 1.84% · 96% · 88% |
| modelo de estado + qualidade + conformal | 3.10% · 100% · 83% | 2.13% · 100% · 75% | 1.88% · 100% · 76% | 1.58% · 100% · 78% | 1.28% · 100% · 81% | 1.24% · 100% · 80% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.64% · 83% | 1.46% · 95% | 1.54% · 94% | 1.69% · 96% |
| mediana | 1.64% · 83% · 86% | 1.38% · 95% · 90% | 1.48% · 94% · 89% | 1.62% · 96% · 88% |
| modelo atual | 1.80% · 83% · 88% | 1.64% · 95% · 89% | 1.82% · 94% · 87% | 1.88% · 96% · 88% |
| modelo de estado + qualidade + conformal | 1.16% · 100% · 87% | 1.12% · 100% · 81% | 1.26% · 100% · 77% | 1.25% · 100% · 80% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4309 | 1.85% | 78% |
| baixa | 43 | 2.07% | 63% |
| média | 1098 | 1.77% | 60% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.

### regresso-longa · em-falta/base/carga

Regresso após pausa longa (7 semanas). 8 atletas, ~7777 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.61 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 73% | 1.03 | 1.62% ± 0.04 | 0.55% | — | — | — | — | 1.77% |
| dia | mediana | 73% | 0.99 | 1.56% ± 0.05 | 0.53% | 69% (68%) | 77% | 7.5% | 1.50% | 1.71% |
| dia | modelo atual | 73% | 1.16 | 1.83% ± 0.09 | 0.21% | 67% (68%) | 74% | 7.5% | 1.60% | 1.98% |
| dia | modelo de estado + qualidade + conformal | 100% | 0.88 | 1.41% ± 0.04 | 0.08% | 80% (80%) | 80% | 4.7% | 1.02% | 1.56% |
| semana | último valor | 71% | 1.05 | 1.65% ± 0.04 | 0.59% | — | — | — | — | 1.80% |
| semana | mediana | 71% | 1.01 | 1.59% ± 0.05 | 0.57% | 69% (68%) | 76% | 7.5% | 1.52% | 1.73% |
| semana | modelo atual | 71% | 1.17 | 1.86% ± 0.10 | 0.27% | 66% (68%) | 74% | 7.5% | 1.62% | 2.00% |
| semana | modelo de estado + qualidade + conformal | 100% | 0.92 | 1.47% ± 0.04 | 0.09% | 80% (80%) | 80% | 5.0% | 1.07% | 1.62% |
| mês | último valor | 61% | 1.16 | 1.79% ± 0.09 | 0.75% | — | — | — | — | 1.94% |
| mês | mediana | 61% | 1.11 | 1.71% ± 0.09 | 0.72% | 65% (68%) | 73% | 7.3% | 1.59% | 1.86% |
| mês | modelo atual | 61% | 1.23 | 1.92% ± 0.09 | 0.39% | 64% (68%) | 72% | 7.3% | 1.65% | 2.07% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.23 | 1.89% ± 0.06 | -0.03% | 80% (80%) | 80% | 7.4% | 1.42% | 2.03% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.83% · 100% | 1.76% · 100% | 1.63% · 100% | 1.63% · 100% | 1.55% · 100% |
| mediana | — | 1.77% · 100% · 57% | 1.71% · 100% · 65% | 1.59% · 100% · 70% | 1.56% · 100% · 78% | 1.48% · 100% · 87% |
| modelo atual | — | 1.77% · 100% · 58% | 1.96% · 100% · 63% | 1.85% · 100% · 67% | 1.89% · 100% · 74% | 1.72% · 100% · 85% |
| modelo de estado + qualidade + conformal | 1.87% · 100% · 79% | 1.16% · 100% · 85% | 1.28% · 100% · 80% | 1.27% · 100% · 80% | 1.26% · 100% · 79% | 1.19% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 |
|---|---|---|---|---|---|---|
| último valor | 1.10% · 14% | 1.26% · 34% | 1.46% · 49% | 1.61% · 59% | 1.62% · 76% | 1.70% · 95% |
| mediana | 1.10% · 14% · 62% | 1.27% · 34% · 53% | 1.45% · 49% · 57% | 1.57% · 59% · 67% | 1.54% · 76% · 76% | 1.66% · 95% · 89% |
| modelo atual | 1.11% · 14% · 62% | 1.30% · 34% · 54% | 1.57% · 49% · 52% | 1.84% · 59% · 64% | 1.87% · 76% · 73% | 1.82% · 95% · 89% |
| modelo de estado + qualidade + conformal | 3.46% · 100% · 81% | 1.79% · 100% · 78% | 1.81% · 100% · 74% | 1.59% · 100% · 79% | 1.29% · 100% · 81% | 1.24% · 100% · 79% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.89% · 93% | 1.63% · 91% | 1.56% · 93% | 1.74% · 96% |
| mediana | 1.82% · 93% · 86% | 1.61% · 91% · 86% | 1.51% · 93% · 92% | 1.69% · 96% · 89% |
| modelo atual | 2.09% · 93% · 80% | 1.83% · 91% · 86% | 1.74% · 93% · 90% | 1.81% · 96% · 90% |
| modelo de estado + qualidade + conformal | 1.29% · 100% · 84% | 1.16% · 100% · 79% | 1.22% · 100% · 80% | 1.26% · 100% · 79% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4457 | 1.83% | 79% |
| baixa | 30 | 1.77% | 58% |
| média | 1151 | 1.85% | 59% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.

### regresso-tardia · em-falta/base/carga

Regresso tardio: ~40 % dos atletas voltam 3–5 semanas depois. 8 atletas, ~7690 reps avaliáveis por réplica, sementes 1001–1010.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| dia | _oráculo (véspera)_ | — | 0.61 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 73% | 1.01 | 1.59% ± 0.06 | 0.50% | — | — | — | — | 1.75% |
| dia | mediana | 73% | 0.97 | 1.53% ± 0.04 | 0.47% | 69% (68%) | 77% | 8.7% | 1.61% | 1.69% |
| dia | modelo atual | 73% | 1.16 | 1.87% ± 0.15 | 0.23% | 67% (68%) | 75% | 8.7% | 1.72% | 2.03% |
| dia | modelo de estado + qualidade + conformal | 100% | 0.89 | 1.42% ± 0.05 | 0.07% | 80% (80%) | 80% | 4.7% | 1.03% | 1.59% |
| semana | último valor | 71% | 1.03 | 1.62% ± 0.06 | 0.53% | — | — | — | — | 1.78% |
| semana | mediana | 71% | 0.99 | 1.55% ± 0.05 | 0.50% | 69% (68%) | 76% | 8.7% | 1.62% | 1.71% |
| semana | modelo atual | 71% | 1.17 | 1.88% ± 0.13 | 0.30% | 67% (68%) | 74% | 8.7% | 1.73% | 2.04% |
| semana | modelo de estado + qualidade + conformal | 100% | 0.93 | 1.48% ± 0.05 | 0.08% | 79% (80%) | 79% | 5.0% | 1.07% | 1.65% |
| mês | último valor | 61% | 1.09 | 1.72% ± 0.08 | 0.67% | — | — | — | — | 1.87% |
| mês | mediana | 61% | 1.05 | 1.65% ± 0.05 | 0.62% | 66% (68%) | 74% | 8.5% | 1.67% | 1.80% |
| mês | modelo atual | 61% | 1.22 | 1.95% ± 0.16 | 0.45% | 65% (68%) | 73% | 8.5% | 1.76% | 2.10% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.28 | 1.94% ± 0.06 | -0.13% | 79% (80%) | 79% | 7.6% | 1.47% | 2.10% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 1.84% · 100% | 1.68% · 100% | 1.64% · 100% | 1.55% · 100% | 1.56% · 100% |
| mediana | — | 1.79% · 100% · 58% | 1.63% · 100% · 67% | 1.59% · 100% · 69% | 1.47% · 100% · 78% | 1.49% · 100% · 86% |
| modelo atual | — | 2.20% · 100% · 57% | 1.90% · 100% · 64% | 1.92% · 100% · 66% | 1.88% · 100% · 77% | 1.80% · 100% · 85% |
| modelo de estado + qualidade + conformal | 1.91% · 100% · 79% | 1.24% · 100% · 82% | 1.30% · 100% · 80% | 1.28% · 100% · 80% | 1.21% · 100% · 80% | 1.20% · 100% · 80% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 | ano 2 |
|---|---|---|---|---|---|---|
| último valor | 1.45% · 21% | 1.51% · 37% | 1.42% · 49% | 1.54% · 57% | 1.56% · 77% | 1.75% · 95% |
| mediana | 1.43% · 21% · 43% | 1.49% · 37% · 49% | 1.40% · 49% · 56% | 1.47% · 57% · 64% | 1.49% · 77% · 77% | 1.69% · 95% · 88% |
| modelo atual | 1.46% · 21% · 43% | 1.63% · 37% · 47% | 1.50% · 49% · 55% | 1.79% · 57% · 61% | 1.90% · 77% · 75% | 1.93% · 95% · 88% |
| modelo de estado + qualidade + conformal | 3.35% · 100% · 82% | 2.08% · 100% · 74% | 1.84% · 100% · 77% | 1.60% · 100% · 79% | 1.26% · 100% · 80% | 1.26% · 100% · 79% |

Depois do regresso de agosto (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | regresso sem 0–1 | regresso sem 2–3 | regresso sem 4–5 | regresso sem 6–11 |
|---|---|---|---|---|
| último valor | 1.90% · 90% | 1.66% · 94% | 1.67% · 94% | 1.75% · 96% |
| mediana | 1.87% · 90% · 82% | 1.65% · 94% · 86% | 1.62% · 94% · 88% | 1.68% · 96% · 90% |
| modelo atual | 2.15% · 90% · 79% | 1.83% · 94% · 86% | 1.98% · 94% · 87% | 1.87% · 96% · 90% |
| modelo de estado + qualidade + conformal | 1.27% · 100% · 81% | 1.21% · 100% · 80% | 1.22% · 100% · 79% | 1.28% · 100% · 79% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4423 | 1.88% | 79% |
| baixa | 34 | 2.20% | 57% |
| média | 1106 | 1.80% | 59% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.
