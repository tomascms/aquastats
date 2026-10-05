# modelo de estado + qualidade + conformal vs modelo atual + qualidade + conformal (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 108 | 1.60% | 1.39% | -0.202 [-0.332; -0.084] | -0.128 [-0.216; -0.044] | 0.142 [-3.220; 3.593] |
| esparso · em-falta/base/carga | 124 | 1.58% | 1.31% | -0.263 [-0.364; -0.173] | -0.173 [-0.249; -0.109] | 0.346 [-2.358; 3.639] |
| tipico · em-falta/base/carga | 2279 | 1.63% | 1.27% | -0.362 [-0.403; -0.322] | -0.261 [-0.291; -0.232] | -0.030 [-0.235; 0.159] |
| denso · em-falta/base/carga | 5367 | 1.59% | 1.25% | -0.331 [-0.361; -0.301] | -0.240 [-0.261; -0.217] | 0.016 [-0.119; 0.135] |

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 108 | 1.60% | 0.98% | -0.611 [-0.786; -0.451] | -0.423 [-0.538; -0.317] |
| arranque · em-falta/base/carga | semana | 90 | 1.66% | 1.46% | -0.194 [-0.321; -0.084] | -0.128 [-0.217; -0.044] |
| arranque · em-falta/base/carga | mês | 22 | 1.98% | 1.37% | -0.610 [-1.104; -0.145] | -0.385 [-0.742; -0.078] |
| esparso · em-falta/base/carga | próxima rep | 124 | 1.58% | 0.98% | -0.601 [-0.687; -0.515] | -0.412 [-0.473; -0.352] |
| esparso · em-falta/base/carga | semana | 114 | 1.60% | 1.29% | -0.313 [-0.409; -0.235] | -0.195 [-0.272; -0.133] |
| esparso · em-falta/base/carga | mês | 46 | 1.87% | 1.50% | -0.370 [-0.604; -0.145] | -0.221 [-0.441; -0.016] |
| tipico · em-falta/base/carga | próxima rep | 2279 | 1.63% | 1.00% | -0.625 [-0.678; -0.577] | -0.444 [-0.482; -0.409] |
| tipico · em-falta/base/carga | semana | 2203 | 1.66% | 1.29% | -0.366 [-0.405; -0.326] | -0.262 [-0.289; -0.234] |
| tipico · em-falta/base/carga | mês | 1660 | 1.76% | 1.44% | -0.316 [-0.369; -0.261] | -0.209 [-0.252; -0.166] |
| denso · em-falta/base/carga | próxima rep | 5367 | 1.60% | 0.98% | -0.618 [-0.652; -0.581] | -0.438 [-0.464; -0.411] |
| denso · em-falta/base/carga | semana | 5223 | 1.60% | 1.28% | -0.322 [-0.352; -0.292] | -0.233 [-0.255; -0.211] |
| denso · em-falta/base/carga | mês | 4324 | 1.72% | 1.45% | -0.277 [-0.317; -0.237] | -0.177 [-0.214; -0.142] |
