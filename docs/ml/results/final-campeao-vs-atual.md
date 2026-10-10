# modelo de estado + qualidade + conformal vs modelo atual (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 108 | 1.66% | 1.39% | -0.270 [-0.491; -0.100] | -0.355 [-0.591; -0.174] | -24.066 [-29.768; -18.448] |
| esparso · em-falta/base/carga | 124 | 1.65% | 1.31% | -0.337 [-0.473; -0.212] | -0.371 [-0.512; -0.247] | -25.105 [-32.055; -18.031] |
| tipico · em-falta/base/carga | 2279 | 1.89% | 1.27% | -0.622 [-0.699; -0.541] | -0.772 [-0.915; -0.633] | -9.740 [-12.642; -6.782] |
| denso · em-falta/base/carga | 5367 | 1.80% | 1.25% | -0.543 [-0.607; -0.479] | -0.709 [-0.823; -0.604] | -6.145 [-8.011; -4.362] |

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 108 | 1.66% | 0.98% | -0.680 [-0.920; -0.477] | -0.651 [-0.888; -0.462] |
| arranque · em-falta/base/carga | semana | 90 | 1.71% | 1.46% | -0.248 [-0.462; -0.087] | -0.315 [-0.554; -0.142] |
| arranque · em-falta/base/carga | mês | 22 | 1.98% | 1.37% | -0.610 [-1.104; -0.145] | -0.575 [-1.000; -0.192] |
| esparso · em-falta/base/carga | próxima rep | 124 | 1.65% | 0.98% | -0.669 [-0.786; -0.555] | -0.606 [-0.727; -0.493] |
| esparso · em-falta/base/carga | semana | 114 | 1.67% | 1.29% | -0.386 [-0.522; -0.264] | -0.391 [-0.540; -0.250] |
| esparso · em-falta/base/carga | mês | 46 | 1.89% | 1.50% | -0.389 [-0.622; -0.160] | -0.432 [-0.755; -0.150] |
| tipico · em-falta/base/carga | próxima rep | 2279 | 1.89% | 1.00% | -0.886 [-0.971; -0.798] | -0.955 [-1.099; -0.815] |
| tipico · em-falta/base/carga | semana | 2203 | 1.90% | 1.29% | -0.606 [-0.691; -0.522] | -0.744 [-0.887; -0.610] |
| tipico · em-falta/base/carga | mês | 1660 | 2.00% | 1.44% | -0.556 [-0.682; -0.433] | -0.680 [-0.848; -0.517] |
| denso · em-falta/base/carga | próxima rep | 5367 | 1.80% | 0.98% | -0.819 [-0.883; -0.757] | -0.899 [-1.013; -0.798] |
| denso · em-falta/base/carga | semana | 5223 | 1.81% | 1.28% | -0.529 [-0.589; -0.469] | -0.694 [-0.805; -0.592] |
| denso · em-falta/base/carga | mês | 4324 | 1.95% | 1.45% | -0.499 [-0.569; -0.432] | -0.618 [-0.741; -0.506] |
