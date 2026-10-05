# modelo de estado + fadiga individual + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 3.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 513 | 3.13% | 3.07% | -0.056 [-0.137; 0.036] | -0.050 [-0.103; 0.013] | -0.875 [-1.884; 0.135] | 0.047 [-0.060; 0.173] |
| esparso · em-falta/base/carga | 485 | 2.89% | 2.91% | 0.028 [-0.032; 0.114] | 0.010 [-0.028; 0.060] | -0.856 [-1.665; -0.077] | 0.082 [-0.065; 0.267] |
| tipico · em-falta/base/carga | 3271 | 1.94% | 1.85% | -0.083 [-0.110; -0.052] | -0.065 [-0.087; -0.042] | -0.730 [-1.015; -0.461] | -0.117 [-0.193; -0.040] |
| denso · em-falta/base/carga | 6748 | 1.64% | 1.56% | -0.079 [-0.111; -0.049] | -0.060 [-0.086; -0.036] | -0.106 [-0.258; 0.021] | -0.098 [-0.171; -0.035] |

Regras: R1 ✗ · R2 ✓ · R3 ✗ · R4 ✓ · R5 ✓ · R6 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Probabilidade de quebra do desafiante vs taxa de quebra da equipa até à véspera (R8; Δ = modelo − referência, IC 95 % bootstrap das sementes):

| Célula | Taxa de quebra | ΔBrier | ΔLog loss |
|---|---|---|---|
| arranque · em-falta/base/carga | 7% | -0.0136 [-0.0276; 0.0003] | -0.0696 [-0.1149; -0.0257] |
| esparso · em-falta/base/carga | 5% | 0.0058 [-0.0077; 0.0210] | -0.0086 [-0.0547; 0.0501] |
| tipico · em-falta/base/carga | 8% | -0.0157 [-0.0249; -0.0060] | -0.0492 [-0.0783; -0.0193] |
| denso · em-falta/base/carga | 7% | -0.0090 [-0.0177; -0.0008] | -0.0177 [-0.0452; 0.0098] |

R8 (quebra): Brier com IC < 0 em 2 de 4 células → ✗.

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 947.3 (gl 369), p < 0,001. Melhoram com IC 95 % < 0: 83 de 371 (22 %); pioram com IC > 0: 13 (4 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 294 | -0.043 | 69 | 10 |
| atípico | 77 | -0.029 | 14 | 3 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 513 | 1.35% | 1.49% | 0.135 [0.066; 0.211] | 0.081 [0.029; 0.143] |
| arranque · em-falta/base/carga | semana | 513 | 3.62% | 3.61% | -0.008 [-0.133; 0.139] | -0.018 [-0.105; 0.085] |
| arranque · em-falta/base/carga | mês | 513 | 5.36% | 5.39% | 0.026 [-0.088; 0.148] | 0.023 [-0.059; 0.109] |
| esparso · em-falta/base/carga | próxima rep | 485 | 1.29% | 1.47% | 0.181 [0.118; 0.251] | 0.113 [0.073; 0.155] |
| esparso · em-falta/base/carga | semana | 485 | 3.02% | 3.07% | 0.048 [-0.022; 0.136] | 0.025 [-0.021; 0.079] |
| esparso · em-falta/base/carga | mês | 485 | 4.19% | 4.37% | 0.180 [0.070; 0.306] | 0.119 [0.045; 0.206] |
| tipico · em-falta/base/carga | próxima rep | 3271 | 1.21% | 1.20% | -0.010 [-0.031; 0.011] | -0.022 [-0.039; -0.003] |
| tipico · em-falta/base/carga | semana | 3271 | 2.01% | 1.94% | -0.074 [-0.101; -0.044] | -0.060 [-0.082; -0.038] |
| tipico · em-falta/base/carga | mês | 3271 | 2.76% | 2.74% | -0.023 [-0.073; 0.032] | -0.024 [-0.059; 0.014] |
| denso · em-falta/base/carga | próxima rep | 6748 | 1.12% | 1.11% | -0.010 [-0.039; 0.018] | -0.015 [-0.040; 0.010] |
| denso · em-falta/base/carga | semana | 6748 | 1.71% | 1.63% | -0.079 [-0.110; -0.051] | -0.059 [-0.085; -0.036] |
| denso · em-falta/base/carga | mês | 6748 | 2.27% | 2.20% | -0.073 [-0.105; -0.040] | -0.050 [-0.079; -0.021] |
