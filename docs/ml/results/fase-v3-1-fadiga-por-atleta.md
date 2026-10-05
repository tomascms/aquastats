# modelo de estado + fadiga individual por atleta + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 3.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 513 | 3.13% | 3.11% | -0.016 [-0.044; 0.007] | -0.014 [-0.034; 0.001] | -0.028 [-0.225; 0.180] | 0.011 [-0.007; 0.040] |
| esparso · em-falta/base/carga | 485 | 2.89% | 2.89% | 0.001 [-0.000; 0.003] | -0.000 [-0.002; 0.001] | 0.013 [-0.030; 0.061] | -0.000 [-0.001; 0.000] |
| tipico · em-falta/base/carga | 3271 | 1.94% | 1.90% | -0.036 [-0.055; -0.019] | -0.028 [-0.044; -0.015] | -0.274 [-0.435; -0.121] | -0.065 [-0.130; -0.008] |
| denso · em-falta/base/carga | 6748 | 1.64% | 1.59% | -0.045 [-0.067; -0.025] | -0.034 [-0.052; -0.018] | -0.091 [-0.219; 0.020] | -0.065 [-0.116; -0.022] |

Regras: R1 ✗ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ (fuga: 0).

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

Q de Cochran = 397.9 (gl 119), p < 0,001. Melhoram com IC 95 % < 0: 36 de 371 (10 %); pioram com IC > 0: 0 (0 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 294 | 0.000 | 26 | 0 |
| atípico | 77 | 0.000 | 10 | 0 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → não cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 513 | 1.35% | 1.35% | -0.005 [-0.020; 0.010] | -0.007 [-0.018; 0.004] |
| arranque · em-falta/base/carga | semana | 513 | 3.62% | 3.63% | 0.007 [-0.024; 0.053] | 0.001 [-0.019; 0.028] |
| arranque · em-falta/base/carga | mês | 513 | 5.36% | 5.36% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| esparso · em-falta/base/carga | próxima rep | 485 | 1.29% | 1.29% | -0.001 [-0.005; 0.002] | -0.001 [-0.004; 0.001] |
| esparso · em-falta/base/carga | semana | 485 | 3.02% | 3.03% | 0.003 [-0.004; 0.011] | 0.001 [-0.005; 0.007] |
| esparso · em-falta/base/carga | mês | 485 | 4.19% | 4.19% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| tipico · em-falta/base/carga | próxima rep | 3271 | 1.21% | 1.18% | -0.023 [-0.037; -0.011] | -0.022 [-0.036; -0.011] |
| tipico · em-falta/base/carga | semana | 3271 | 2.01% | 1.98% | -0.031 [-0.045; -0.017] | -0.024 [-0.036; -0.013] |
| tipico · em-falta/base/carga | mês | 3271 | 2.76% | 2.74% | -0.022 [-0.038; -0.009] | -0.017 [-0.028; -0.007] |
| denso · em-falta/base/carga | próxima rep | 6748 | 1.12% | 1.10% | -0.021 [-0.039; -0.005] | -0.019 [-0.035; -0.005] |
| denso · em-falta/base/carga | semana | 6748 | 1.71% | 1.67% | -0.043 [-0.064; -0.024] | -0.033 [-0.050; -0.018] |
| denso · em-falta/base/carga | mês | 6748 | 2.27% | 2.24% | -0.034 [-0.054; -0.017] | -0.020 [-0.035; -0.009] |
