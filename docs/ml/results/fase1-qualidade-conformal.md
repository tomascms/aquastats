# modelo atual + qualidade + conformal vs modelo atual (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 108 | 1.66% | 1.60% | -0.069 [-0.182; -0.003] | -0.228 [-0.399; -0.107] | -24.208 [-28.990; -19.592] |
| esparso · em-falta/base/carga | 124 | 1.65% | 1.58% | -0.075 [-0.174; 0.001] | -0.198 [-0.298; -0.113] | -25.451 [-32.042; -19.229] |
| tipico · em-falta/base/carga | 2279 | 1.89% | 1.63% | -0.261 [-0.330; -0.192] | -0.511 [-0.658; -0.376] | -9.710 [-12.464; -6.897] |
| denso · em-falta/base/carga | 5367 | 1.80% | 1.59% | -0.211 [-0.272; -0.157] | -0.469 [-0.584; -0.364] | -6.161 [-8.092; -4.314] |

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 108 | 1.66% | 1.60% | -0.069 [-0.182; -0.003] | -0.228 [-0.399; -0.107] |
| arranque · em-falta/base/carga | semana | 90 | 1.71% | 1.66% | -0.054 [-0.161; 0.000] | -0.187 [-0.364; -0.081] |
| arranque · em-falta/base/carga | mês | 22 | 1.98% | 1.98% | 0.000 [0.000; 0.000] | -0.190 [-0.271; -0.104] |
| esparso · em-falta/base/carga | próxima rep | 124 | 1.65% | 1.58% | -0.068 [-0.166; 0.004] | -0.195 [-0.296; -0.109] |
| esparso · em-falta/base/carga | semana | 114 | 1.67% | 1.60% | -0.073 [-0.179; 0.005] | -0.195 [-0.308; -0.091] |
| esparso · em-falta/base/carga | mês | 46 | 1.89% | 1.87% | -0.019 [-0.048; 0.002] | -0.211 [-0.324; -0.117] |
| tipico · em-falta/base/carga | próxima rep | 2279 | 1.89% | 1.63% | -0.260 [-0.328; -0.192] | -0.511 [-0.656; -0.376] |
| tipico · em-falta/base/carga | semana | 2203 | 1.90% | 1.66% | -0.240 [-0.311; -0.170] | -0.482 [-0.622; -0.356] |
| tipico · em-falta/base/carga | mês | 1660 | 2.00% | 1.76% | -0.240 [-0.338; -0.150] | -0.471 [-0.630; -0.326] |
| denso · em-falta/base/carga | próxima rep | 5367 | 1.80% | 1.60% | -0.201 [-0.263; -0.148] | -0.461 [-0.577; -0.358] |
| denso · em-falta/base/carga | semana | 5223 | 1.81% | 1.60% | -0.207 [-0.258; -0.158] | -0.462 [-0.571; -0.360] |
| denso · em-falta/base/carga | mês | 4324 | 1.95% | 1.72% | -0.222 [-0.296; -0.155] | -0.441 [-0.577; -0.321] |
