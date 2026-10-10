# Estado inicial da fase final (sementes de desenvolvimento)

Dados **sintéticos** (gerador 3.0), sementes de ajuste. Protocolo: `docs/ml/protocolo.md`. Métricas em reps limpas (sem erro de digitação), média ± desvio entre sementes.

## Células de decisão

### arranque · em-falta/base/carga

Arranque: 6 semanas a meio da época. 6 atletas, ~522 reps avaliáveis por réplica, sementes 3001–3015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.51 | 0.77% | — | — | — | — | — | — |
| próxima rep | último valor | 90% | 1.01 | 1.78% ± 0.60 | 0.24% | — | — | — | — | 1.93% |
| próxima rep | mediana | 24% | 1.08 | 1.72% ± 0.42 | 0.57% | 46% (68%) | 54% | 4.7% | 1.56% | 1.88% |
| próxima rep | modelo atual | 24% | 1.25 | 1.98% ± 0.59 | 0.54% | 41% (68%) | 50% | 4.6% | 1.74% | 2.14% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.88 | 1.40% ± 0.21 | -0.02% | 78% (80%) | 78% | 4.5% | 1.07% | 1.55% |
| dia | _oráculo (véspera)_ | — | 0.65 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 24% | 1.13 | 1.77% ± 0.46 | 0.69% | — | — | — | — | 1.93% |
| dia | mediana | 24% | 1.08 | 1.72% ± 0.42 | 0.57% | 46% (68%) | 54% | 4.7% | 1.56% | 1.88% |
| dia | modelo atual | 24% | 1.25 | 1.98% ± 0.59 | 0.54% | 41% (68%) | 50% | 4.6% | 1.74% | 2.14% |
| dia | modelo de estado + qualidade + conformal | 100% | 2.02 | 3.10% ± 0.63 | 0.31% | 76% (80%) | 76% | 11.4% | 2.37% | 3.25% |
| semana | último valor | 20% | 1.16 | 1.81% ± 0.47 | 0.70% | — | — | — | — | 1.97% |
| semana | mediana | 20% | 1.13 | 1.78% ± 0.45 | 0.61% | 43% (68%) | 51% | 4.4% | 1.59% | 1.94% |
| semana | modelo atual | 20% | 1.28 | 2.03% ± 0.58 | 0.61% | 37% (68%) | 46% | 4.4% | 1.76% | 2.19% |
| semana | modelo de estado + qualidade + conformal | 100% | 2.35 | 3.46% ± 0.72 | 0.25% | 78% (80%) | 78% | 15.4% | 2.75% | 3.61% |
| mês | último valor | 3% | 1.14 | 2.08% ± 0.71 | 1.49% | — | — | — | — | 2.34% |
| mês | mediana | 3% | 1.09 | 1.95% ± 0.73 | 1.35% | 38% (68%) | 45% | 3.1% | 1.59% | 2.21% |
| mês | modelo atual | 3% | 1.15 | 2.03% ± 0.85 | 1.26% | 36% (68%) | 43% | 3.1% | 1.66% | 2.29% |
| mês | modelo de estado + qualidade + conformal | 100% | 3.97 | 5.46% ± 0.89 | 0.72% | 92% (80%) | 92% | 37.6% | 4.78% | 5.59% |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.75% · 25% | 1.78% · 19% |
| mediana | 1.72% · 25% · 55% | 1.66% · 19% · 53% |
| modelo atual | 1.98% · 25% · 52% | 1.88% · 19% · 48% |
| modelo de estado + qualidade + conformal | 2.71% · 100% · 78% | 4.65% · 100% · 73% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|
| último valor | — | 3.04% · 100% | 1.91% · 100% | 1.58% · 100% | 1.83% · 100% | 1.18% · 100% |
| mediana | — | 2.52% · 100% · 67% | 1.95% · 100% · 46% | 1.52% · 100% · 56% | 1.69% · 100% · 58% | 0.97% · 100% · 72% |
| modelo atual | — | 3.72% · 100% · 46% | 2.20% · 100% · 44% | 1.71% · 100% · 54% | 2.21% · 100% · 47% | 1.52% · 100% · 56% |
| modelo de estado + qualidade + conformal | 3.57% · 100% · 75% | 2.47% · 100% · 70% | 1.76% · 100% · 71% | 1.36% · 100% · 81% | 1.46% · 100% · 83% | 0.98% · 100% · 89% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 |
|---|---|---|---|
| último valor | 1.25% · 11% | 1.63% · 31% | 2.16% · 35% |
| mediana | 1.24% · 11% · 62% | 1.52% · 31% · 53% | 2.14% · 35% · 52% |
| modelo atual | 1.28% · 11% · 61% | 1.60% · 31% · 55% | 2.54% · 35% · 46% |
| modelo de estado + qualidade + conformal | 3.89% · 100% · 81% | 2.74% · 100% · 74% | 2.55% · 100% · 70% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| média | 110 | 1.90% | 50% |
| alta | 21 | 2.53% | 56% |
| baixa | 5 | 3.72% | 46% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.

### esparso · em-falta/base/carga

Esparso: 12 semanas, poucos treinos e tempos. 6 atletas, ~479 reps avaliáveis por réplica, sementes 3001–3015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.57 | 0.77% | — | — | — | — | — | — |
| próxima rep | último valor | 89% | 1.16 | 1.86% ± 0.41 | 0.36% | — | — | — | — | 2.14% |
| próxima rep | mediana | 27% | 1.28 | 1.58% ± 0.21 | 0.64% | 44% (68%) | 53% | 3.4% | 1.35% | 1.81% |
| próxima rep | modelo atual | 27% | 1.38 | 1.74% ± 0.19 | 0.43% | 41% (68%) | 50% | 3.4% | 1.45% | 1.96% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.98 | 1.37% ± 0.09 | 0.02% | 78% (80%) | 78% | 4.4% | 1.04% | 1.63% |
| dia | _oráculo (véspera)_ | — | 0.72 | 0.99% | — | — | — | — | — | — |
| dia | último valor | 27% | 1.32 | 1.64% ± 0.24 | 0.86% | — | — | — | — | 1.86% |
| dia | mediana | 27% | 1.28 | 1.58% ± 0.21 | 0.64% | 44% (68%) | 53% | 3.4% | 1.35% | 1.81% |
| dia | modelo atual | 27% | 1.38 | 1.74% ± 0.19 | 0.43% | 41% (68%) | 50% | 3.4% | 1.45% | 1.96% |
| dia | modelo de estado + qualidade + conformal | 100% | 2.09 | 2.94% ± 0.40 | 0.35% | 76% (80%) | 76% | 10.4% | 2.19% | 3.19% |
| semana | último valor | 23% | 1.39 | 1.70% ± 0.30 | 1.05% | — | — | — | — | 1.96% |
| semana | mediana | 23% | 1.31 | 1.62% ± 0.25 | 0.87% | 43% (68%) | 52% | 3.2% | 1.36% | 1.88% |
| semana | modelo atual | 23% | 1.38 | 1.73% ± 0.22 | 0.64% | 41% (68%) | 49% | 3.2% | 1.44% | 1.99% |
| semana | modelo de estado + qualidade + conformal | 100% | 2.24 | 3.14% ± 0.44 | 0.34% | 76% (80%) | 76% | 11.7% | 2.38% | 3.39% |
| mês | último valor | 8% | 1.91 | 1.99% ± 0.73 | 1.75% | — | — | — | — | 2.11% |
| mês | mediana | 8% | 1.72 | 1.84% ± 0.72 | 1.58% | 36% (68%) | 42% | 2.6% | 1.51% | 1.96% |
| mês | modelo atual | 8% | 1.69 | 1.77% ± 0.57 | 1.33% | 36% (68%) | 43% | 2.6% | 1.44% | 1.89% |
| mês | modelo de estado + qualidade + conformal | 100% | 3.40 | 4.41% ± 0.54 | 0.37% | 76% (80%) | 76% | 21.4% | 3.62% | 4.65% |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.66% · 28% | 1.46% · 17% |
| mediana | 1.61% · 28% · 52% | 1.37% · 17% · 54% |
| modelo atual | 1.71% · 28% · 50% | 1.54% · 17% · 48% |
| modelo de estado + qualidade + conformal | 2.74% · 100% · 77% | 4.51% · 100% · 65% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 5.10% · 100% | 3.14% · 100% | 1.74% · 100% | 1.65% · 100% | 1.30% · 100% | 2.29% · 100% |
| mediana | — | — | 2.32% · 100% · 56% | 1.64% · 100% · 49% | 1.64% · 100% · 51% | 1.24% · 100% · 68% | 1.91% · 100% · 67% |
| modelo atual | — | — | 2.45% · 100% · 53% | 1.84% · 100% · 49% | 1.76% · 100% · 48% | 1.61% · 100% · 53% | 1.41% · 100% · 91% |
| modelo de estado + qualidade + conformal | 3.52% · 100% · 75% | 4.30% · 100% · 33% | 1.90% · 100% · 63% | 1.53% · 100% · 77% | 1.31% · 100% · 81% | 1.15% · 100% · 86% | 1.46% · 100% · 80% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 |
|---|---|---|---|---|
| último valor | 1.10% · 15% | 1.50% · 27% | 1.64% · 31% | 1.83% · 33% |
| mediana | 1.08% · 15% · 59% | 1.46% · 27% · 49% | 1.60% · 31% · 51% | 1.71% · 33% · 62% |
| modelo atual | 1.12% · 15% · 58% | 1.48% · 27% · 46% | 1.80% · 31% · 45% | 1.92% · 33% · 59% |
| modelo de estado + qualidade + conformal | 4.13% · 100% · 88% | 2.70% · 100% · 75% | 2.48% · 100% · 72% | 2.79% · 100% · 72% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 40 | 2.71% | 43% |
| média | 109 | 1.63% | 50% |
| baixa | 9 | 2.45% | 53% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.

### tipico · em-falta/base/carga

Típico: 26 semanas desde o regresso de setembro. 8 atletas, ~3414 reps avaliáveis por réplica, sementes 3001–3015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.49 | 0.79% | — | — | — | — | — | — |
| próxima rep | último valor | 95% | 1.02 | 1.79% ± 0.19 | 0.29% | — | — | — | — | 1.97% |
| próxima rep | mediana | 62% | 1.09 | 1.75% ± 0.14 | 0.63% | 65% (68%) | 72% | 7.3% | 1.63% | 1.93% |
| próxima rep | modelo atual | 62% | 1.32 | 2.11% ± 0.22 | 0.22% | 62% (68%) | 69% | 7.3% | 1.79% | 2.29% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.75 | 1.25% ± 0.11 | -0.01% | 79% (80%) | 79% | 3.7% | 0.92% | 1.43% |
| dia | _oráculo (véspera)_ | — | 0.63 | 1.01% | — | — | — | — | — | — |
| dia | último valor | 63% | 1.14 | 1.83% ± 0.15 | 0.68% | — | — | — | — | 2.01% |
| dia | mediana | 62% | 1.09 | 1.75% ± 0.14 | 0.63% | 65% (68%) | 72% | 7.3% | 1.63% | 1.93% |
| dia | modelo atual | 62% | 1.32 | 2.11% ± 0.22 | 0.22% | 62% (68%) | 69% | 7.3% | 1.79% | 2.29% |
| dia | modelo de estado + qualidade + conformal | 100% | 1.19 | 1.96% ± 0.17 | 0.19% | 78% (80%) | 78% | 6.3% | 1.44% | 2.14% |
| semana | último valor | 60% | 1.15 | 1.85% ± 0.14 | 0.75% | — | — | — | — | 2.03% |
| semana | mediana | 60% | 1.10 | 1.77% ± 0.13 | 0.68% | 64% (68%) | 72% | 7.3% | 1.64% | 1.95% |
| semana | modelo atual | 60% | 1.32 | 2.12% ± 0.24 | 0.29% | 61% (68%) | 69% | 7.3% | 1.79% | 2.30% |
| semana | modelo de estado + qualidade + conformal | 100% | 1.24 | 2.03% ± 0.17 | 0.21% | 78% (80%) | 78% | 6.7% | 1.50% | 2.21% |
| mês | último valor | 46% | 1.24 | 1.99% ± 0.15 | 0.96% | — | — | — | — | 2.16% |
| mês | mediana | 46% | 1.19 | 1.90% ± 0.16 | 0.91% | 62% (68%) | 69% | 7.0% | 1.71% | 2.07% |
| mês | modelo atual | 46% | 1.36 | 2.20% ± 0.25 | 0.52% | 59% (68%) | 67% | 7.0% | 1.83% | 2.37% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.77 | 2.72% ± 0.25 | 0.17% | 77% (80%) | 77% | 10.5% | 2.09% | 2.90% |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.78% · 62% | 1.99% · 63% |
| mediana | 1.71% · 62% · 74% | 1.92% · 62% · 67% |
| modelo atual | 2.10% · 62% · 70% | 2.11% · 62% · 65% |
| modelo de estado + qualidade + conformal | 1.88% · 100% · 79% | 2.42% · 100% · 76% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 5.83% · 100% | 3.55% · 100% | 2.08% · 100% | 1.84% · 100% | 1.70% · 100% | 1.61% · 100% |
| mediana | — | — | 3.41% · 100% · 47% | 2.00% · 100% · 62% | 1.78% · 100% · 68% | 1.63% · 100% · 77% | 1.53% · 100% · 84% |
| modelo atual | — | — | 3.66% · 100% · 46% | 2.32% · 100% · 60% | 2.11% · 100% · 65% | 2.00% · 100% · 74% | 1.94% · 100% · 81% |
| modelo de estado + qualidade + conformal | 2.72% · 100% · 77% | 5.62% · 100% · 30% | 2.65% · 100% · 69% | 1.69% · 100% · 77% | 1.52% · 100% · 80% | 1.44% · 100% · 79% | 1.32% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 |
|---|---|---|---|---|---|
| último valor | 1.50% · 20% | 1.68% · 35% | 1.75% · 46% | 1.89% · 59% | 1.85% · 81% |
| mediana | 1.45% · 20% · 50% | 1.60% · 35% · 47% | 1.72% · 45% · 51% | 1.80% · 58% · 69% | 1.76% · 81% · 81% |
| modelo atual | 1.45% · 20% · 50% | 1.63% · 35% · 47% | 1.99% · 45% · 48% | 2.21% · 58% · 65% | 2.14% · 81% · 78% |
| modelo de estado + qualidade + conformal | 4.03% · 100% · 79% | 2.18% · 100% · 79% | 2.11% · 100% · 78% | 1.93% · 100% · 77% | 1.64% · 100% · 79% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 1519 | 2.06% | 75% |
| baixa | 30 | 3.66% | 46% |
| média | 579 | 2.15% | 56% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.

### denso · em-falta/base/carga

Denso: 40 semanas, muitos treinos e tempos. 6 atletas, ~6753 reps avaliáveis por réplica, sementes 3001–3015.

| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |
|---|---|---|---|---|---|---|---|---|---|---|
| próxima rep | _oráculo (no dia)_ | — | 0.50 | 0.79% | — | — | — | — | — | — |
| próxima rep | último valor | 97% | 1.01 | 1.75% ± 0.21 | 0.25% | — | — | — | — | 1.88% |
| próxima rep | mediana | 77% | 1.10 | 1.75% ± 0.11 | 0.50% | 69% (68%) | 77% | 8.0% | 1.66% | 1.87% |
| próxima rep | modelo atual | 77% | 1.29 | 2.04% ± 0.15 | 0.22% | 67% (68%) | 75% | 8.0% | 1.78% | 2.16% |
| próxima rep | modelo de estado + qualidade + conformal | 100% | 0.74 | 1.21% ± 0.14 | -0.01% | 79% (80%) | 79% | 3.7% | 0.89% | 1.34% |
| dia | _oráculo (véspera)_ | — | 0.64 | 1.01% | — | — | — | — | — | — |
| dia | último valor | 77% | 1.15 | 1.83% ± 0.11 | 0.51% | — | — | — | — | 1.95% |
| dia | mediana | 77% | 1.10 | 1.75% ± 0.11 | 0.50% | 69% (68%) | 77% | 8.0% | 1.66% | 1.87% |
| dia | modelo atual | 77% | 1.29 | 2.04% ± 0.15 | 0.22% | 67% (68%) | 75% | 8.0% | 1.78% | 2.16% |
| dia | modelo de estado + qualidade + conformal | 100% | 1.06 | 1.71% ± 0.15 | 0.12% | 79% (80%) | 79% | 5.5% | 1.24% | 1.83% |
| semana | último valor | 75% | 1.17 | 1.86% ± 0.11 | 0.57% | — | — | — | — | 1.98% |
| semana | mediana | 75% | 1.12 | 1.77% ± 0.11 | 0.56% | 69% (68%) | 76% | 8.0% | 1.67% | 1.89% |
| semana | modelo atual | 75% | 1.30 | 2.07% ± 0.17 | 0.29% | 67% (68%) | 74% | 8.0% | 1.79% | 2.19% |
| semana | modelo de estado + qualidade + conformal | 100% | 1.10 | 1.78% ± 0.16 | 0.14% | 79% (80%) | 79% | 5.9% | 1.30% | 1.90% |
| mês | último valor | 61% | 1.27 | 2.03% ± 0.14 | 0.84% | — | — | — | — | 2.14% |
| mês | mediana | 61% | 1.21 | 1.92% ± 0.12 | 0.80% | 65% (68%) | 72% | 7.7% | 1.76% | 2.04% |
| mês | modelo atual | 61% | 1.36 | 2.18% ± 0.15 | 0.54% | 63% (68%) | 71% | 7.7% | 1.86% | 2.29% |
| mês | modelo de estado + qualidade + conformal | 100% | 1.55 | 2.34% ± 0.17 | 0.03% | 79% (80%) | 79% | 9.4% | 1.80% | 2.46% |

Por tipo de atleta (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | típico | atípico |
|---|---|---|
| último valor | 1.80% · 77% | 1.98% · 76% |
| mediana | 1.72% · 77% · 76% | 1.88% · 76% · 77% |
| modelo atual | 2.01% · 77% · 74% | 2.18% · 76% · 75% |
| modelo de estado + qualidade + conformal | 1.66% · 100% · 80% | 1.92% · 100% · 79% |

Por reps anteriores do mesmo grupo (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | — | 5.08% · 100% | 3.03% · 100% | 2.11% · 100% | 1.95% · 100% | 1.81% · 100% | 1.65% · 100% |
| mediana | — | — | 3.13% · 100% · 54% | 2.05% · 100% · 64% | 1.89% · 100% · 68% | 1.72% · 100% · 77% | 1.55% · 100% · 87% |
| modelo atual | — | — | 3.37% · 100% · 52% | 2.35% · 100% · 61% | 2.18% · 100% · 65% | 2.06% · 100% · 75% | 1.81% · 100% · 85% |
| modelo de estado + qualidade + conformal | 2.35% · 100% · 79% | 4.22% · 100% · 53% | 2.42% · 100% · 77% | 1.70% · 100% · 78% | 1.58% · 100% · 80% | 1.52% · 100% · 79% | 1.39% · 100% · 81% |

Erro ao longo do tempo (semanas de histórico do atleta) (horizonte dia; MAPE · reps previstas · cobertura a 80 %):

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16–51 |
|---|---|---|---|---|---|
| último valor | 1.38% · 26% | 1.46% · 49% | 1.72% · 60% | 1.89% · 74% | 1.86% · 85% |
| mediana | 1.38% · 26% · 52% | 1.42% · 49% · 54% | 1.68% · 60% · 58% | 1.81% · 74% · 73% | 1.76% · 84% · 81% |
| modelo atual | 1.40% · 26% · 52% | 1.88% · 49% · 50% | 1.83% · 60% · 56% | 2.09% · 74% · 71% | 2.07% · 84% · 79% |
| modelo de estado + qualidade + conformal | 3.18% · 100% · 81% | 1.97% · 100% · 76% | 1.82% · 100% · 77% | 1.86% · 100% · 78% | 1.57% · 100% · 80% |

Confiança declarada (modelo atual) vs erro real:

| Confiança | Reps | MAPE | Cob. a 80 % |
|---|---|---|---|
| alta | 4214 | 1.98% | 79% |
| baixa | 54 | 3.37% | 52% |
| média | 899 | 2.23% | 56% |

Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): último valor: 0, mediana: 0, modelo atual: 0, modelo de estado + qualidade + conformal: 0.
