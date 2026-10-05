# Baseline v3 — gerador heterogéneo (3.0)

Dados **sintéticos** (gerador 3.0), sementes de teste. Protocolo: `docs/ml/protocolo.md`. Métricas em reps limpas (sem erro de digitação), média ± desvio entre sementes.

## Células de decisão

### arranque · em-falta/base/carga

Arranque: 6 semanas a meio da época. 6 atletas, ~517 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.53 | 0.79% | — | — | — | — | — | — |
| próxima rep | último valor | 90% | 1.00 | 1.58% ± 0.32 | 0.17% | — | — | — | — | 1.78% |
| próxima rep | mediana | 24% | 0.96 | 1.50% ± 0.25 | 0.57% | 46% (68%) | 54% | 5.4% | 1.46% | 1.73% |
| próxima rep | modelo atual | 24% | 1.07 | 1.66% ± 0.30 | 0.47% | 44% (68%) | 52% | 5.4% | 1.56% | 1.89% |
| próxima rep | fronteira (q20) | 24% | 0.97 | 1.50% ± 0.26 | 0.57% | — | 54% | — | 1.13% | 1.73% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.91 | 1.35% ± 0.12 | 0.05% | 80% (80%) | 80% | 4.5% | 1.02% | 1.56% |
| dia | _oráculo (véspera)_ | — | 0.67 | 0.98% | — | — | — | — | — | — |
| dia | último valor | 24% | 0.98 | 1.54% ± 0.28 | 0.64% | — | — | — | — | 1.77% |
| dia | mediana | 24% | 0.96 | 1.50% ± 0.25 | 0.57% | 46% (68%) | 54% | 5.4% | 1.46% | 1.73% |
| dia | modelo atual | 24% | 1.07 | 1.66% ± 0.30 | 0.47% | 44% (68%) | 52% | 5.4% | 1.56% | 1.89% |
| dia | fronteira (q20) | 24% | 0.97 | 1.50% ± 0.26 | 0.57% | — | 54% | — | 1.13% | 1.73% |
| dia | modelo de estado + qualidade + conformal | 100% | 2.03 | 3.13% ± 0.52 | 0.24% | 75% (80%) | 75% | 11.6% | 2.38% | 3.31% |
| semana | último valor | 20% | 1.07 | 1.64% ± 0.44 | 0.86% | — | — | — | — | 1.87% |
| semana | mediana | 20% | 1.04 | 1.58% ± 0.38 | 0.77% | 41% (68%) | 49% | 4.1% | 1.40% | 1.81% |
| semana | modelo atual | 20% | 1.14 | 1.75% ± 0.48 | 0.73% | 38% (68%) | 45% | 4.1% | 1.52% | 1.98% |
| semana | fronteira (q20) | 20% | 1.04 | 1.58% ± 0.39 | 0.78% | — | 51% | — | 1.19% | 1.81% |
| semana | modelo de estado + qualidade + conformal | 100% | 2.44 | 3.62% ± 0.83 | 0.51% | 75% (80%) | 75% | 15.9% | 2.88% | 3.81% |
| mês | último valor | 3% | 1.08 | 2.05% ± 0.62 | 1.24% | — | — | — | — | 2.22% |
| mês | mediana | 3% | 1.04 | 2.00% ± 0.66 | 1.19% | 23% (68%) | 28% | 2.3% | 1.63% | 2.18% |
| mês | modelo atual | 3% | 1.11 | 2.10% ± 0.81 | 0.93% | 23% (68%) | 28% | 2.3% | 1.73% | 2.27% |
| mês | fronteira (q20) | 3% | 1.04 | 2.01% ± 0.67 | 1.19% | — | 36% | — | 1.56% | 2.18% |
| mês | modelo de estado + qualidade + conformal | 100% | 3.82 | 5.36% ± 1.50 | 1.03% | 89% (80%) | 89% | 36.3% | 4.73% | 5.54% |

"Devia fazer" (capacidade) e custo das condições, horizonte dia:

| Preditor | MAPE vs verdade | Viés | Cob. 80 % vs verdade | Interval score | MAPE em reps de referência | Cob. 80 % em referência | Erro do custo (pp) |
|---|---|---|---|---|---|---|---|
| fronteira (q20) | 1.07% | 0.27% | 70% | 5.41% | 1.67% (n≈4) | 66% | 0.92 |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.52% · 24% | 1.45% · 21% |
| mediana | 1.50% · 24% · 54% | 1.37% · 21% · 48% |
| modelo atual | 1.67% · 24% · 52% | 1.44% · 21% · 48% |
| fronteira (q20) | 1.50% · 24% · 54% | 1.38% · 21% · 51% |
| modelo de estado + qualidade + conformal | 2.92% · 100% · 76% | 4.27% · 100% · 74% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 8.41% · 100% | 2.10% · 100% | 1.76% · 100% | 1.47% · 100% | 1.48% · 100% | 1.34% · 100% |
| mediana | — | — | 2.25% · 100% · 90% | 1.74% · 100% · 43% | 1.46% · 100% · 57% | 1.32% · 100% · 58% | 1.15% · 100% · 56% |
| modelo atual | — | — | 3.83% · 100% · 85% | 1.62% · 100% · 48% | 1.58% · 100% · 56% | 1.92% · 100% · 43% | 2.33% · 100% · 44% |
| fronteira (q20) | — | — | 2.29% · 75% · 46% | 1.75% · 100% · 43% | 1.47% · 100% · 56% | 1.32% · 100% · 67% | 1.15% · 100% · 72% |
| modelo de estado + qualidade + conformal | 3.69% · 100% · 74% | 8.21% · 100% · 33% | 2.21% · 100% · 68% | 1.53% · 100% · 76% | 1.42% · 100% · 81% | 1.34% · 100% · 79% | 1.12% · 100% · 56% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 |
|---|---|---|---|
| último valor | 1.76% · 15% | 1.30% · 28% | 1.76% · 34% |
| mediana | 1.72% · 15% · 52% | 1.29% · 28% · 57% | 1.70% · 34% · 48% |
| modelo atual | 1.84% · 15% · 51% | 1.48% · 28% · 50% | 1.87% · 34% · 49% |
| fronteira (q20) | 1.72% · 15% · 46% | 1.31% · 28% · 61% | 1.70% · 34% · 49% |
| modelo de estado + qualidade + conformal | 4.09% · 100% · 80% | 2.33% · 100% · 76% | 2.68% · 100% · 67% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| média | 116 | 1.62% | 52% |
| alta | 20 | 2.40% | 56% |
| baixa | 4 | 3.83% | 85% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, fronteira (q20): 0, modelo de estado + qualidade + conformal: 0.

### esparso · em-falta/base/carga

Esparso: 12 semanas, poucos treinos e tempos. 6 atletas, ~488 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.57 | 0.77% | — | — | — | — | — | — |
| próxima rep | último valor | 89% | 1.06 | 1.62% ± 0.43 | 0.25% | — | — | — | — | 1.79% |
| próxima rep | mediana | 25% | 1.46 | 1.66% ± 0.38 | 0.87% | 44% (68%) | 53% | 4.2% | 1.46% | 1.82% |
| próxima rep | modelo atual | 25% | 1.57 | 1.86% ± 0.59 | 0.65% | 43% (68%) | 52% | 4.2% | 1.54% | 2.02% |
| próxima rep | fronteira (q20) | 24% | 1.46 | 1.67% ± 0.43 | 0.87% | — | 50% | — | 1.32% | 1.83% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.95 | 1.29% ± 0.12 | -0.00% | 78% (80%) | 78% | 4.4% | 0.97% | 1.46% |
| dia | _oráculo (véspera)_ | — | 0.76 | 1.01% | — | — | — | — | — | — |
| dia | último valor | 25% | 1.52 | 1.74% ± 0.40 | 1.01% | — | — | — | — | 1.90% |
| dia | mediana | 25% | 1.46 | 1.66% ± 0.38 | 0.87% | 44% (68%) | 53% | 4.2% | 1.46% | 1.82% |
| dia | modelo atual | 25% | 1.57 | 1.86% ± 0.59 | 0.65% | 43% (68%) | 52% | 4.2% | 1.54% | 2.02% |
| dia | fronteira (q20) | 24% | 1.46 | 1.67% ± 0.43 | 0.87% | — | 50% | — | 1.32% | 1.83% |
| dia | modelo de estado + qualidade + conformal | 100% | 2.04 | 2.89% ± 0.41 | 0.27% | 77% (80%) | 77% | 10.9% | 2.19% | 3.05% |
| semana | último valor | 22% | 1.65 | 1.79% ± 0.42 | 1.01% | — | — | — | — | 1.96% |
| semana | mediana | 22% | 1.60 | 1.73% ± 0.42 | 0.91% | 41% (68%) | 50% | 4.0% | 1.52% | 1.91% |
| semana | modelo atual | 22% | 1.71 | 1.90% ± 0.58 | 0.74% | 39% (68%) | 47% | 4.0% | 1.59% | 2.07% |
| semana | fronteira (q20) | 22% | 1.61 | 1.73% ± 0.43 | 0.89% | — | 48% | — | 1.36% | 1.90% |
| semana | modelo de estado + qualidade + conformal | 100% | 2.15 | 3.02% ± 0.50 | 0.39% | 77% (80%) | 77% | 11.7% | 2.33% | 3.18% |
| mês | último valor | 9% | 1.80 | 2.09% ± 0.80 | 1.54% | — | — | — | — | 2.15% |
| mês | mediana | 9% | 1.76 | 2.04% ± 0.77 | 1.46% | 36% (68%) | 42% | 5.9% | 1.94% | 2.10% |
| mês | modelo atual | 9% | 2.09 | 2.40% ± 1.39 | 1.67% | 33% (68%) | 39% | 5.9% | 2.09% | 2.47% |
| mês | fronteira (q20) | 9% | 1.76 | 2.03% ± 0.78 | 1.45% | — | 38% | — | 1.65% | 2.09% |
| mês | modelo de estado + qualidade + conformal | 100% | 3.27 | 4.19% ± 1.16 | 0.63% | 80% (80%) | 80% | 22.0% | 3.42% | 4.34% |

"Devia fazer" (capacidade) e custo das condições, horizonte dia:

| Preditor | MAPE vs verdade | Viés | Cob. 80 % vs verdade | Interval score | MAPE em reps de referência | Cob. 80 % em referência | Erro do custo (pp) |
|---|---|---|---|---|---|---|---|
| fronteira (q20) | 1.26% | 0.51% | 60% | 7.22% | 1.79% (n≈3) | 61% | 0.86 |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.67% · 24% | 2.07% · 19% |
| mediana | 1.60% · 24% · 56% | 1.98% · 19% · 38% |
| modelo atual | 1.84% · 24% · 54% | 1.89% · 19% · 40% |
| fronteira (q20) | 1.61% · 24% · 52% | 1.89% · 19% · 48% |
| modelo de estado + qualidade + conformal | 2.53% · 100% · 79% | 5.09% · 100% · 66% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 2.51% · 100% | 1.84% · 100% | 1.78% · 100% | 1.29% · 100% | 1.32% · 100% |
| mediana | — | 1.96% · 100% · 58% | 1.74% · 100% · 50% | 1.73% · 100% · 53% | 1.30% · 100% · 69% | 1.19% · 100% · 74% |
| modelo atual | — | 2.27% · 100% · 51% | 1.81% · 100% · 51% | 1.92% · 100% · 52% | 1.92% · 100% · 62% | 2.66% · 100% · 26% |
| fronteira (q20) | — | 2.25% · 66% · 25% | 1.72% · 100% · 47% | 1.74% · 100% · 47% | 1.30% · 100% · 77% | 1.19% · 100% · 74% |
| modelo de estado + qualidade + conformal | 3.37% · 100% · 76% | 1.85% · 100% · 76% | 1.48% · 100% · 80% | 1.43% · 100% · 81% | 1.33% · 100% · 88% | 1.23% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 |
|---|---|---|---|---|
| último valor | 1.12% · 7% | 1.62% · 27% | 1.78% · 29% | 1.78% · 28% |
| mediana | 1.10% · 7% · 63% | 1.56% · 27% · 48% | 1.74% · 29% · 54% | 1.66% · 28% · 50% |
| modelo atual | 1.24% · 7% · 62% | 1.71% · 27% · 45% | 2.06% · 29% · 50% | 1.55% · 28% · 53% |
| fronteira (q20) | 1.12% · 7% · 53% | 1.55% · 27% · 51% | 1.73% · 29% · 51% | 1.68% · 27% · 47% |
| modelo de estado + qualidade + conformal | 4.80% · 100% · 85% | 2.90% · 100% · 73% | 2.27% · 100% · 77% | 2.52% · 100% · 73% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 31 | 2.30% | 65% |
| média | 104 | 1.85% | 51% |
| baixa | 7 | 2.27% | 51% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, fronteira (q20): 0, modelo de estado + qualidade + conformal: 0.

### tipico · em-falta/base/carga

Típico: 26 semanas desde o regresso de setembro. 8 atletas, ~3288 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.48 | 0.79% | — | — | — | — | — | — |
| próxima rep | último valor | 95% | 0.95 | 1.73% ± 0.14 | 0.27% | — | — | — | — | 1.90% |
| próxima rep | mediana | 62% | 1.02 | 1.71% ± 0.11 | 0.59% | 63% (68%) | 71% | 7.2% | 1.61% | 1.87% |
| próxima rep | modelo atual | 62% | 1.20 | 2.04% ± 0.19 | 0.20% | 60% (68%) | 68% | 7.2% | 1.74% | 2.20% |
| próxima rep | fronteira (q20) | 48% | 0.97 | 1.67% ± 0.12 | 0.51% | — | 55% | — | 1.28% | 1.83% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.72 | 1.21% ± 0.08 | -0.01% | 79% (80%) | 79% | 3.6% | 0.89% | 1.38% |
| dia | _oráculo (véspera)_ | — | 0.62 | 1.01% | — | — | — | — | — | — |
| dia | último valor | 62% | 1.06 | 1.79% ± 0.11 | 0.63% | — | — | — | — | 1.96% |
| dia | mediana | 62% | 1.02 | 1.71% ± 0.11 | 0.59% | 63% (68%) | 71% | 7.2% | 1.61% | 1.87% |
| dia | modelo atual | 62% | 1.20 | 2.04% ± 0.19 | 0.20% | 60% (68%) | 68% | 7.2% | 1.74% | 2.20% |
| dia | fronteira (q20) | 48% | 0.97 | 1.67% ± 0.12 | 0.51% | — | 55% | — | 1.28% | 1.83% |
| dia | modelo de estado + qualidade + conformal | 100% | 1.17 | 1.94% ± 0.12 | 0.15% | 78% (80%) | 78% | 6.3% | 1.41% | 2.11% |
| semana | último valor | 60% | 1.08 | 1.81% ± 0.12 | 0.69% | — | — | — | — | 1.98% |
| semana | mediana | 60% | 1.04 | 1.73% ± 0.12 | 0.64% | 62% (68%) | 70% | 7.2% | 1.62% | 1.90% |
| semana | modelo atual | 60% | 1.22 | 2.07% ± 0.24 | 0.25% | 59% (68%) | 67% | 7.2% | 1.76% | 2.23% |
| semana | fronteira (q20) | 45% | 0.99 | 1.70% ± 0.13 | 0.57% | — | 54% | — | 1.30% | 1.86% |
| semana | modelo de estado + qualidade + conformal | 100% | 1.22 | 2.01% ± 0.11 | 0.17% | 78% (80%) | 78% | 6.7% | 1.48% | 2.18% |
| mês | último valor | 45% | 1.18 | 1.96% ± 0.14 | 0.91% | — | — | — | — | 2.12% |
| mês | mediana | 45% | 1.13 | 1.87% ± 0.17 | 0.85% | 59% (68%) | 67% | 7.3% | 1.74% | 2.04% |
| mês | modelo atual | 45% | 1.26 | 2.15% ± 0.25 | 0.52% | 58% (68%) | 66% | 7.3% | 1.83% | 2.31% |
| mês | fronteira (q20) | 33% | 1.06 | 1.79% ± 0.17 | 0.64% | — | 51% | — | 1.40% | 1.95% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.79 | 2.76% ± 0.33 | 0.16% | 77% (80%) | 77% | 11.2% | 2.13% | 2.93% |

"Devia fazer" (capacidade) e custo das condições, horizonte dia:

| Preditor | MAPE vs verdade | Viés | Cob. 80 % vs verdade | Interval score | MAPE em reps de referência | Cob. 80 % em referência | Erro do custo (pp) |
|---|---|---|---|---|---|---|---|
| fronteira (q20) | 1.22% | 0.20% | 67% | 6.67% | 1.86% (n≈74) | 60% | 1.08 |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.76% · 62% | 1.92% · 62% |
| mediana | 1.68% · 62% · 71% | 1.82% · 62% · 69% |
| modelo atual | 2.02% · 62% · 68% | 2.23% · 62% · 67% |
| fronteira (q20) | 1.64% · 48% · 56% | 1.84% · 47% · 52% |
| modelo de estado + qualidade + conformal | 1.85% · 100% · 79% | 2.38% · 100% · 76% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 3.45% · 100% | 3.07% · 100% | 1.98% · 100% | 1.84% · 100% | 1.67% · 100% | 1.66% · 100% |
| mediana | — | — | 3.00% · 100% · 57% | 1.87% · 100% · 62% | 1.77% · 100% · 66% | 1.59% · 100% · 75% | 1.57% · 100% · 80% |
| modelo atual | — | — | 3.25% · 100% · 54% | 2.19% · 100% · 60% | 2.11% · 100% · 63% | 1.95% · 100% · 71% | 1.88% · 100% · 79% |
| fronteira (q20) | — | — | 3.05% · 49% · 46% | 1.82% · 71% · 52% | 1.70% · 73% · 53% | 1.60% · 78% · 57% | 1.61% · 89% · 59% |
| modelo de estado + qualidade + conformal | 2.68% · 100% · 77% | 3.79% · 100% · 57% | 2.66% · 100% · 70% | 1.59% · 100% · 79% | 1.52% · 100% · 78% | 1.39% · 100% · 79% | 1.36% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 |
|---|---|---|---|---|---|
| último valor | 1.67% · 19% | 1.64% · 33% | 1.62% · 49% | 1.86% · 63% | 1.83% · 79% |
| mediana | 1.57% · 19% · 44% | 1.62% · 33% · 49% | 1.60% · 49% · 59% | 1.75% · 63% · 68% | 1.74% · 79% · 78% |
| modelo atual | 1.63% · 19% · 43% | 1.74% · 33% · 45% | 1.83% · 49% · 56% | 2.26% · 63% · 63% | 2.04% · 79% · 76% |
| fronteira (q20) | 1.55% · 19% · 45% | 1.58% · 33% · 51% | 1.59% · 49% · 55% | 1.77% · 50% · 57% | 1.66% · 52% · 56% |
| modelo de estado + qualidade + conformal | 3.85% · 100% · 80% | 2.10% · 100% · 78% | 2.00% · 100% · 76% | 1.90% · 100% · 78% | 1.62% · 100% · 79% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 1427 | 2.02% | 73% |
| baixa | 27 | 3.25% | 54% |
| média | 579 | 2.05% | 55% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, fronteira (q20): 0, modelo de estado + qualidade + conformal: 0.

### denso · em-falta/base/carga

Denso: 40 semanas, muitos treinos e tempos. 6 atletas, ~6774 reps avaliáveis por réplica, sementes 1001–1015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.50 | 0.78% | — | — | — | — | — | — |
| próxima rep | último valor | 97% | 0.96 | 1.62% ± 0.11 | 0.24% | — | — | — | — | 1.74% |
| próxima rep | mediana | 76% | 1.06 | 1.66% ± 0.11 | 0.52% | 71% (68%) | 78% | 7.8% | 1.57% | 1.79% |
| próxima rep | modelo atual | 76% | 1.26 | 1.96% ± 0.17 | 0.18% | 69% (68%) | 76% | 7.8% | 1.69% | 2.08% |
| próxima rep | fronteira (q20) | 60% | 1.03 | 1.64% ± 0.09 | 0.44% | — | 57% | — | 1.25% | 1.76% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.70 | 1.12% ± 0.10 | -0.00% | 80% (80%) | 80% | 3.5% | 0.82% | 1.24% |
| dia | _oráculo (véspera)_ | — | 0.65 | 1.02% | — | — | — | — | — | — |
| dia | último valor | 76% | 1.11 | 1.75% ± 0.12 | 0.50% | — | — | — | — | 1.87% |
| dia | mediana | 76% | 1.06 | 1.66% ± 0.11 | 0.52% | 71% (68%) | 78% | 7.8% | 1.57% | 1.79% |
| dia | modelo atual | 76% | 1.26 | 1.96% ± 0.17 | 0.18% | 69% (68%) | 76% | 7.8% | 1.69% | 2.08% |
| dia | fronteira (q20) | 60% | 1.03 | 1.64% ± 0.09 | 0.44% | — | 57% | — | 1.25% | 1.76% |
| dia | modelo de estado + qualidade + conformal | 100% | 1.02 | 1.64% ± 0.13 | 0.12% | 80% (80%) | 80% | 5.3% | 1.19% | 1.75% |
| semana | último valor | 74% | 1.13 | 1.78% ± 0.12 | 0.56% | — | — | — | — | 1.90% |
| semana | mediana | 74% | 1.07 | 1.69% ± 0.11 | 0.58% | 71% (68%) | 78% | 7.8% | 1.59% | 1.81% |
| semana | modelo atual | 74% | 1.27 | 1.97% ± 0.18 | 0.24% | 68% (68%) | 76% | 7.8% | 1.70% | 2.10% |
| semana | fronteira (q20) | 57% | 1.05 | 1.67% ± 0.09 | 0.50% | — | 56% | — | 1.28% | 1.79% |
| semana | modelo de estado + qualidade + conformal | 100% | 1.08 | 1.71% ± 0.11 | 0.14% | 80% (80%) | 80% | 5.7% | 1.25% | 1.83% |
| mês | último valor | 60% | 1.22 | 1.93% ± 0.16 | 0.77% | — | — | — | — | 2.05% |
| mês | mediana | 60% | 1.16 | 1.82% ± 0.16 | 0.78% | 67% (68%) | 75% | 7.8% | 1.68% | 1.95% |
| mês | modelo atual | 60% | 1.32 | 2.07% ± 0.22 | 0.45% | 66% (68%) | 73% | 7.8% | 1.77% | 2.20% |
| mês | fronteira (q20) | 44% | 1.11 | 1.79% ± 0.11 | 0.60% | — | 52% | — | 1.38% | 1.91% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.49 | 2.27% ± 0.21 | 0.08% | 80% (80%) | 80% | 9.2% | 1.75% | 2.39% |

"Devia fazer" (capacidade) e custo das condições, horizonte dia:

| Preditor | MAPE vs verdade | Viés | Cob. 80 % vs verdade | Interval score | MAPE em reps de referência | Cob. 80 % em referência | Erro do custo (pp) |
|---|---|---|---|---|---|---|---|
| fronteira (q20) | 1.21% | 0.19% | 69% | 6.49% | 1.87% (n≈152) | 58% | 1.11 |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.69% · 77% | 1.94% · 75% |
| mediana | 1.61% · 77% · 79% | 1.84% · 75% · 79% |
| modelo atual | 1.90% · 77% · 76% | 2.27% · 75% · 77% |
| fronteira (q20) | 1.59% · 61% · 58% | 1.81% · 58% · 54% |
| modelo de estado + qualidade + conformal | 1.56% · 100% · 80% | 1.92% · 100% · 79% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 5.27% · 100% | 2.51% · 100% | 1.93% · 100% | 1.83% · 100% | 1.75% · 100% | 1.61% · 100% |
| mediana | — | — | 2.47% · 100% · 60% | 1.86% · 100% · 67% | 1.77% · 100% · 70% | 1.66% · 100% · 79% | 1.51% · 100% · 88% |
| modelo atual | — | — | 2.82% · 100% · 57% | 2.16% · 100% · 64% | 2.05% · 100% · 67% | 2.01% · 100% · 76% | 1.78% · 100% · 86% |
| fronteira (q20) | — | — | 2.27% · 59% · 35% | 1.80% · 70% · 49% | 1.72% · 74% · 52% | 1.65% · 80% · 59% | 1.54% · 84% · 62% |
| modelo de estado + qualidade + conformal | 2.26% · 100% · 79% | 4.22% · 100% · 58% | 2.03% · 100% · 78% | 1.56% · 100% · 79% | 1.50% · 100% · 80% | 1.45% · 100% · 79% | 1.34% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 |
|---|---|---|---|---|---|
| último valor | 1.24% · 23% | 1.39% · 47% | 1.77% · 62% | 1.74% · 71% | 1.76% · 84% |
| mediana | 1.24% · 23% · 54% | 1.38% · 47% · 56% | 1.72% · 62% · 60% | 1.66% · 71% · 76% | 1.66% · 84% · 83% |
| modelo atual | 1.29% · 23% · 55% | 1.52% · 47% · 53% | 1.96% · 62% · 55% | 2.07% · 71% · 73% | 1.95% · 84% · 81% |
| fronteira (q20) | 1.24% · 23% · 57% | 1.37% · 46% · 57% | 1.72% · 62% · 53% | 1.67% · 64% · 60% | 1.62% · 61% · 58% |
| modelo de estado + qualidade + conformal | 3.73% · 100% · 80% | 2.14% · 100% · 79% | 1.79% · 100% · 78% | 1.73% · 100% · 79% | 1.46% · 100% · 81% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4202 | 1.92% | 80% |
| baixa | 48 | 2.82% | 57% |
| média | 902 | 2.07% | 59% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, fronteira (q20): 0, modelo de estado + qualidade + conformal: 0.
