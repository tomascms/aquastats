# Baseline — modelo atual (antes de qualquer melhoria)

Dados **sintéticos** (gerador em `apps/web/src/lib/ml/synthetic.ts`), sementes 11, 22, 33; média (± desvio entre sementes).

Protocolo: cada rep do dia D é prevista só com reps de dias anteriores. Métricas em reps sem erro de registo; `MAE*` inclui as reps com erro de registo plausível.

## Arranque: 6 semanas, 3 treinos/semana, poucos tempos

6 atletas, ~648 reps cronometradas por réplica.

| Preditor | Reps previstas | MAE (s) | MAPE | Mediana APE | Viés | Cobertura (nominal) | Cob. a 80 % | Largura | Interval score | CRPS | MAE* (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| _oráculo (melhor possível na véspera)_ | — | 0.85 | 0.95% | 0.75% | 0.07% | — | — | — | — | — | — |
| último valor | 50% | 1.20 ± 0.18 | 1.26% | 1.02% | 0.11% | — | — | — | — | — | 1.33 |
| nível do grupo | 49% | 1.15 ± 0.14 | 1.18% | 0.97% | -0.07% | 58% (68%) | 67% | 8.2% | 10.60% | 1.50% | 1.28 |
| baseline | 49% | 1.77 ± 0.30 | 1.77% | 1.24% | 0.45% | 53% (68%) | 61% | 8.2% | 11.35% | 1.69% | 1.90 |

Por reps anteriores do mesmo grupo (piscina, distância, estilo, intensidade, material):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | —% · 0% | 2.07% · 100% | 1.22% · 100% | 1.41% · 100% | 1.21% · 100% | 1.07% · 100% | 1.02% · 100% |
| nível do grupo | —% · 0% | —% · 0% | 1.18% · 100% · cob 61% | 1.38% · 100% · cob 50% | 1.14% · 100% · cob 54% | 0.88% · 100% · cob 80% | 1.01% · 100% · cob 74% |
| baseline | —% · 0% | —% · 0% | 1.64% · 100% · cob 54% | 1.84% · 100% · cob 49% | 1.50% · 100% · cob 47% | 2.14% · 100% · cob 73% | 1.27% · 100% · cob 61% |

_Cada célula: MAPE · reps previstas · cobertura do intervalo._

Por semanas de histórico do atleta:

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16+ |
|---|---|---|---|---|---|
| último valor | 1.42% · 32% | 1.35% · 61% | 1.10% · 61% | — | — |
| nível do grupo | 1.36% · 32% | 1.30% · 60% | 0.99% · 60% | — | — |
| baseline | 1.60% · 32% | 1.87% · 60% | 1.87% · 60% | — | — |

Confiança declarada pelo baseline vs erro real:

| Confiança | Reps | MAPE | Cobertura |
|---|---|---|---|
| alta | 94 | 1.87% | 62% |
| baixa | 25 | 1.64% | 54% |
| média | 199 | 1.76% | 48% |

Verificação de fuga temporal (previsões que mudaram ao perturbar o futuro): último valor 0, nível do grupo 0, baseline 0.

## Esparso: 12 semanas, 3–5 treinos/semana

6 atletas, ~1756 reps cronometradas por réplica.

| Preditor | Reps previstas | MAE (s) | MAPE | Mediana APE | Viés | Cobertura (nominal) | Cob. a 80 % | Largura | Interval score | CRPS | MAE* (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| _oráculo (melhor possível na véspera)_ | — | 0.77 | 0.96% | 0.77% | 0.07% | — | — | — | — | — | — |
| último valor | 60% | 1.23 ± 0.22 | 1.36% | 1.06% | 0.08% | — | — | — | — | — | 1.40 |
| nível do grupo | 59% | 1.04 ± 0.10 | 1.22% | 0.97% | -0.12% | 67% (68%) | 76% | 6.7% | 8.66% | 1.27% | 1.22 |
| baseline | 59% | 1.41 ± 0.15 | 1.64% | 1.23% | 0.23% | 64% (68%) | 71% | 6.7% | 9.20% | 1.43% | 1.58 |

Por reps anteriores do mesmo grupo (piscina, distância, estilo, intensidade, material):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | —% · 0% | 4.62% · 100% | 3.58% · 100% | 1.36% · 100% | 1.31% · 100% | 1.23% · 100% | 1.25% · 100% |
| nível do grupo | —% · 0% | —% · 0% | 1.31% · 100% · cob 67% | 1.42% · 100% · cob 55% | 1.24% · 100% · cob 69% | 1.09% · 100% · cob 74% | 1.09% · 100% · cob 71% |
| baseline | —% · 0% | —% · 0% | 2.17% · 100% · cob 65% | 1.74% · 100% · cob 54% | 1.78% · 100% · cob 63% | 1.57% · 100% · cob 69% | 1.15% · 100% · cob 74% |

_Cada célula: MAPE · reps previstas · cobertura do intervalo._

Por semanas de histórico do atleta:

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16+ |
|---|---|---|---|---|---|
| último valor | 1.21% · 28% | 1.14% · 62% | 1.56% · 65% | 1.41% · 74% | — |
| nível do grupo | 1.15% · 28% | 1.14% · 62% | 1.21% · 65% | 1.28% · 74% | — |
| baseline | 1.59% · 28% | 1.67% · 62% | 1.68% · 65% | 1.58% · 74% | — |

Confiança declarada pelo baseline vs erro real:

| Confiança | Reps | MAPE | Cobertura |
|---|---|---|---|
| alta | 621 | 1.54% | 72% |
| baixa | 41 | 2.17% | 65% |
| média | 373 | 1.75% | 52% |

Verificação de fuga temporal (previsões que mudaram ao perturbar o futuro): último valor 0, nível do grupo 0, baseline 0.

## Típico: 26 semanas, 5–7 treinos/semana

8 atletas, ~8902 reps cronometradas por réplica.

| Preditor | Reps previstas | MAE (s) | MAPE | Mediana APE | Viés | Cobertura (nominal) | Cob. a 80 % | Largura | Interval score | CRPS | MAE* (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| _oráculo (melhor possível na véspera)_ | — | 0.71 | 0.95% | 0.77% | 0.01% | — | — | — | — | — | — |
| último valor | 83% | 1.02 ± 0.05 | 1.35% | 1.10% | 0.12% | — | — | — | — | — | 1.14 |
| nível do grupo | 82% | 0.93 ± 0.05 | 1.24% | 1.00% | -0.01% | 79% (68%) | 86% | 8.0% | 9.26% | 1.33% | 1.05 |
| baseline | 82% | 1.09 ± 0.08 | 1.46% | 1.13% | 0.20% | 78% (68%) | 84% | 8.0% | 9.48% | 1.41% | 1.21 |

Por reps anteriores do mesmo grupo (piscina, distância, estilo, intensidade, material):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | —% · 0% | 1.30% · 100% | 1.63% · 100% | 1.43% · 100% | 1.45% · 100% | 1.35% · 100% | 1.28% · 100% |
| nível do grupo | —% · 0% | —% · 0% | 1.57% · 100% · cob 53% | 1.44% · 100% · cob 63% | 1.37% · 100% · cob 68% | 1.22% · 100% · cob 79% | 1.15% · 100% · cob 88% |
| baseline | —% · 0% | —% · 0% | 1.69% · 100% · cob 54% | 1.80% · 100% · cob 59% | 1.53% · 100% · cob 67% | 1.49% · 100% · cob 77% | 1.34% · 100% · cob 87% |

_Cada célula: MAPE · reps previstas · cobertura do intervalo._

Por semanas de histórico do atleta:

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16+ |
|---|---|---|---|---|---|
| último valor | 1.18% · 45% | 1.24% · 78% | 1.31% · 76% | 1.47% · 87% | 1.35% · 94% |
| nível do grupo | 1.15% · 45% | 1.17% · 78% | 1.21% · 76% | 1.35% · 87% | 1.23% · 94% |
| baseline | 1.29% · 45% | 1.29% · 78% | 1.52% · 76% | 1.60% · 87% | 1.44% · 94% |

Confiança declarada pelo baseline vs erro real:

| Confiança | Reps | MAPE | Cobertura |
|---|---|---|---|
| alta | 6159 | 1.42% | 82% |
| baixa | 110 | 1.69% | 54% |
| média | 1016 | 1.68% | 55% |

Verificação de fuga temporal (previsões que mudaram ao perturbar o futuro): último valor 0, nível do grupo 0, baseline 0.

## Denso: 40 semanas, 6–9 treinos/semana

6 atletas, ~16713 reps cronometradas por réplica.

| Preditor | Reps previstas | MAE (s) | MAPE | Mediana APE | Viés | Cobertura (nominal) | Cob. a 80 % | Largura | Interval score | CRPS | MAE* (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| _oráculo (melhor possível na véspera)_ | — | 0.73 | 0.97% | 0.79% | 0.03% | — | — | — | — | — | — |
| último valor | 90% | 1.10 ± 0.01 | 1.43% | 1.16% | 0.17% | — | — | — | — | — | 1.22 |
| nível do grupo | 90% | 0.98 ± 0.02 | 1.29% | 1.05% | 0.08% | 82% (68%) | 88% | 7.3% | 8.40% | 1.25% | 1.10 |
| baseline | 90% | 1.15 ± 0.05 | 1.48% | 1.17% | 0.23% | 80% (68%) | 86% | 7.3% | 8.60% | 1.32% | 1.27 |

Por reps anteriores do mesmo grupo (piscina, distância, estilo, intensidade, material):

| Preditor | 0 | 1 | 2–3 | 4–7 | 8–15 | 16–31 | 32+ |
|---|---|---|---|---|---|---|---|
| último valor | —% · 0% | 1.01% · 100% | 1.50% · 100% | 1.57% · 100% | 1.44% · 100% | 1.51% · 100% | 1.39% · 100% |
| nível do grupo | —% · 0% | —% · 0% | 1.49% · 100% · cob 61% | 1.56% · 100% · cob 62% | 1.38% · 100% · cob 68% | 1.39% · 100% · cob 75% | 1.22% · 100% · cob 88% |
| baseline | —% · 0% | —% · 0% | 1.78% · 100% · cob 51% | 1.78% · 100% · cob 59% | 1.70% · 100% · cob 64% | 1.62% · 100% · cob 73% | 1.36% · 100% · cob 87% |

_Cada célula: MAPE · reps previstas · cobertura do intervalo._

Por semanas de histórico do atleta:

| Preditor | sem 0–1 | sem 2–3 | sem 4–7 | sem 8–15 | sem 16+ |
|---|---|---|---|---|---|
| último valor | 1.27% · 48% | 1.28% · 80% | 1.32% · 83% | 1.49% · 90% | 1.45% · 98% |
| nível do grupo | 1.23% · 48% | 1.23% · 80% | 1.18% · 83% | 1.37% · 90% | 1.30% · 98% |
| baseline | 1.75% · 48% | 1.59% · 80% | 1.50% · 83% | 1.47% · 90% | 1.45% · 98% |

Confiança declarada pelo baseline vs erro real:

| Confiança | Reps | MAPE | Cobertura |
|---|---|---|---|
| alta | 13829 | 1.45% | 83% |
| baixa | 125 | 1.78% | 51% |
| média | 1071 | 1.73% | 54% |

Verificação de fuga temporal (previsões que mudaram ao perturbar o futuro): último valor 0, nível do grupo 0, baseline 0.
