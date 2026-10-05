# E12 · fadiga individual (tentativa única) + qualidade + conformal vs campeão da fase final + qualidade + conformal (sementes da tentativa de fadiga 2001–2015, gerador 3.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 503 | 2.79% | 2.72% | -0.068 [-0.135; -0.001] | -0.073 [-0.125; -0.022] | -1.678 [-3.109; -0.272] | -0.018 [-0.292; 0.264] |
| esparso · em-falta/base/carga | 486 | 2.71% | 2.63% | -0.081 [-0.169; 0.005] | -0.085 [-0.150; -0.021] | -1.905 [-3.269; -0.493] | -0.039 [-0.313; 0.216] |
| tipico · em-falta/base/carga | 3399 | 1.93% | 1.81% | -0.115 [-0.156; -0.080] | -0.093 [-0.126; -0.065] | -0.986 [-1.237; -0.717] | -0.140 [-0.250; -0.044] |
| denso · em-falta/base/carga | 6801 | 1.61% | 1.51% | -0.105 [-0.133; -0.079] | -0.080 [-0.103; -0.060] | -0.223 [-0.369; -0.094] | -0.123 [-0.226; -0.025] |

ΔMAPE agregado (média das células por semente): -0.092 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.033.

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 11954 | 1.81% | 1.70% | -0.106 | -0.8 |
| Escalão (idade) | ≥ 17 anos | 46922 | 1.85% | 1.70% | -0.155 | -0.8 |
| Escalão (idade) | 13–14 anos | 74185 | 1.76% | 1.69% | -0.072 | -0.5 |
| Escalão (idade) | 15–16 anos | 34768 | 1.83% | 1.72% | -0.104 | -0.8 |
| Estilo principal | back | 29518 | 1.81% | 1.69% | -0.121 | -0.9 |
| Estilo principal | breast | 24229 | 1.88% | 1.75% | -0.122 | -0.8 |
| Estilo principal | fly | 31582 | 1.82% | 1.73% | -0.091 | -0.4 |
| Estilo principal | free | 65029 | 1.77% | 1.69% | -0.077 | -0.5 |
| Estilo principal | im | 17471 | 1.80% | 1.63% | -0.176 | -0.6 |
| Sexo | F | 78563 | 1.79% | 1.70% | -0.082 | -0.7 |
| Sexo | M | 89266 | 1.82% | 1.70% | -0.123 | -0.7 |

Probabilidade de quebra do desafiante vs taxa de quebra da equipa até à véspera (R8; Δ = modelo − referência, IC 95 % bootstrap das sementes):

| Célula | Taxa de quebra | ΔBrier | ΔLog loss |
|---|---|---|---|
| arranque · em-falta/base/carga | 10% | -0.0298 [-0.0423; -0.0188] | -0.1166 [-0.1517; -0.0850] |
| esparso · em-falta/base/carga | 9% | -0.0280 [-0.0387; -0.0180] | -0.1126 [-0.1480; -0.0806] |
| tipico · em-falta/base/carga | 10% | -0.0267 [-0.0351; -0.0191] | -0.1016 [-0.1259; -0.0787] |
| denso · em-falta/base/carga | 9% | -0.0214 [-0.0296; -0.0138] | -0.0825 [-0.1051; -0.0609] |

R8 (quebra): Brier com IC < 0 em 4 de 4 células → ✓.

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 1115.1 (gl 370), p < 0,001. Melhoram com IC 95 % < 0: 101 de 372 (27 %); pioram com IC > 0: 12 (3 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 313 | -0.068 | 84 | 11 |
| atípico | 59 | -0.004 | 17 | 1 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 503 | 1.33% | 1.43% | 0.106 [0.056; 0.156] | 0.061 [0.023; 0.099] |
| arranque · em-falta/base/carga | semana | 503 | 3.23% | 3.14% | -0.089 [-0.179; 0.005] | -0.094 [-0.162; -0.026] |
| arranque · em-falta/base/carga | mês | 503 | 5.45% | 5.40% | -0.056 [-0.162; 0.040] | -0.072 [-0.146; -0.007] |
| esparso · em-falta/base/carga | próxima rep | 486 | 1.32% | 1.39% | 0.068 [0.013; 0.131] | 0.024 [-0.018; 0.067] |
| esparso · em-falta/base/carga | semana | 486 | 2.91% | 2.83% | -0.077 [-0.160; 0.007] | -0.081 [-0.149; -0.014] |
| esparso · em-falta/base/carga | mês | 486 | 4.38% | 4.34% | -0.038 [-0.159; 0.073] | -0.049 [-0.136; 0.033] |
| tipico · em-falta/base/carga | próxima rep | 3399 | 1.23% | 1.19% | -0.041 [-0.072; -0.013] | -0.045 [-0.071; -0.021] |
| tipico · em-falta/base/carga | semana | 3399 | 2.03% | 1.91% | -0.116 [-0.155; -0.083] | -0.096 [-0.128; -0.068] |
| tipico · em-falta/base/carga | mês | 3399 | 2.74% | 2.67% | -0.073 [-0.127; -0.024] | -0.065 [-0.109; -0.026] |
| denso · em-falta/base/carga | próxima rep | 6801 | 1.14% | 1.09% | -0.042 [-0.061; -0.022] | -0.041 [-0.058; -0.024] |
| denso · em-falta/base/carga | semana | 6801 | 1.71% | 1.60% | -0.109 [-0.141; -0.081] | -0.084 [-0.110; -0.061] |
| denso · em-falta/base/carga | mês | 6801 | 2.24% | 2.13% | -0.110 [-0.147; -0.070] | -0.084 [-0.114; -0.052] |
