# E3 · provas como observações + qualidade + conformal vs campeão da fase final + qualidade + conformal (sementes de desenvolvimento 3001–3015, gerador 3.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 519 | 3.07% | 2.98% | -0.090 [-0.155; -0.029] | -0.058 [-0.103; -0.015] | 0.719 [-0.025; 1.477] | 0.036 [-0.132; 0.312] |
| esparso · em-falta/base/carga | 476 | 2.90% | 2.80% | -0.092 [-0.171; -0.025] | -0.060 [-0.116; -0.016] | 0.353 [-0.348; 1.048] | -0.505 [-1.468; 0.022] |
| tipico · em-falta/base/carga | 3393 | 1.95% | 1.93% | -0.026 [-0.037; -0.015] | -0.018 [-0.026; -0.011] | -0.051 [-0.129; 0.034] | -0.021 [-0.050; 0.003] |
| denso · em-falta/base/carga | 6727 | 1.70% | 1.69% | -0.009 [-0.014; -0.005] | -0.007 [-0.010; -0.004] | -0.016 [-0.044; 0.019] | -0.015 [-0.029; -0.002] |

ΔMAPE agregado (média das células por semente): -0.054 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.022.

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 19287 | 1.88% | 1.85% | -0.036 | -0.1 |
| Escalão (idade) | ≥ 17 anos | 45366 | 2.00% | 1.98% | -0.025 | 0.0 |
| Escalão (idade) | 13–14 anos | 49143 | 1.85% | 1.83% | -0.014 | 0.1 |
| Escalão (idade) | 15–16 anos | 52923 | 1.82% | 1.80% | -0.019 | 0.1 |
| Estilo principal | back | 24598 | 1.95% | 1.92% | -0.028 | 0.0 |
| Estilo principal | breast | 24459 | 1.87% | 1.84% | -0.026 | -0.0 |
| Estilo principal | fly | 32816 | 1.96% | 1.93% | -0.024 | 0.1 |
| Estilo principal | free | 65492 | 1.85% | 1.83% | -0.017 | 0.0 |
| Estilo principal | im | 19354 | 1.82% | 1.81% | -0.015 | 0.1 |
| Sexo | F | 80400 | 1.86% | 1.83% | -0.030 | -0.0 |
| Sexo | M | 86319 | 1.90% | 1.89% | -0.013 | 0.1 |

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 411.1 (gl 377), p = 0.109. Melhoram com IC 95 % < 0: 26 de 378 (7 %); pioram com IC > 0: 15 (4 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 301 | -0.012 | 20 | 13 |
| atípico | 77 | -0.008 | 6 | 2 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → não cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 519 | 1.40% | 1.38% | -0.021 [-0.031; -0.010] | -0.016 [-0.022; -0.009] |
| arranque · em-falta/base/carga | semana | 519 | 3.44% | 3.35% | -0.089 [-0.164; -0.019] | -0.060 [-0.113; -0.010] |
| arranque · em-falta/base/carga | mês | 519 | 5.43% | 5.37% | -0.053 [-0.116; 0.009] | -0.028 [-0.066; 0.007] |
| esparso · em-falta/base/carga | próxima rep | 476 | 1.37% | 1.34% | -0.025 [-0.045; -0.008] | -0.019 [-0.035; -0.007] |
| esparso · em-falta/base/carga | semana | 476 | 3.10% | 2.96% | -0.139 [-0.280; -0.028] | -0.086 [-0.173; -0.018] |
| esparso · em-falta/base/carga | mês | 476 | 4.35% | 4.17% | -0.175 [-0.352; -0.054] | -0.113 [-0.238; -0.025] |
| tipico · em-falta/base/carga | próxima rep | 3393 | 1.25% | 1.24% | -0.005 [-0.008; -0.002] | -0.003 [-0.005; -0.001] |
| tipico · em-falta/base/carga | semana | 3393 | 2.02% | 1.99% | -0.031 [-0.044; -0.018] | -0.020 [-0.029; -0.012] |
| tipico · em-falta/base/carga | mês | 3393 | 2.70% | 2.66% | -0.036 [-0.069; -0.006] | -0.021 [-0.044; 0.002] |
| denso · em-falta/base/carga | próxima rep | 6727 | 1.21% | 1.21% | -0.001 [-0.001; 0.000] | -0.000 [-0.001; 0.000] |
| denso · em-falta/base/carga | semana | 6727 | 1.77% | 1.76% | -0.008 [-0.016; -0.001] | -0.005 [-0.010; -0.001] |
| denso · em-falta/base/carga | mês | 6727 | 2.33% | 2.32% | -0.015 [-0.031; -0.001] | -0.010 [-0.024; 0.004] |
