# modelo de estado + Banister + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 501 | 2.83% | 2.88% | 0.056 [0.029; 0.081] | 0.039 [0.020; 0.057] | 0.179 [-0.327; 0.592] |
| esparso · em-falta/base/carga | 504 | 2.60% | 2.65% | 0.045 [0.021; 0.075] | 0.026 [0.012; 0.044] | -0.479 [-0.798; -0.157] |
| tipico · em-falta/base/carga | 3588 | 1.59% | 1.59% | 0.001 [-0.008; 0.008] | -0.001 [-0.006; 0.004] | 0.108 [0.039; 0.181] |
| denso · em-falta/base/carga | 6990 | 1.40% | 1.40% | -0.002 [-0.005; 0.002] | 0.000 [-0.002; 0.003] | 0.002 [-0.042; 0.049] |

Regras: R1 ✗ · R2 ✗ · R3 ✗ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 501 | 1.19% | 1.20% | 0.008 [0.004; 0.012] | 0.006 [0.003; 0.008] |
| arranque · em-falta/base/carga | semana | 501 | 3.23% | 3.32% | 0.090 [0.064; 0.115] | 0.062 [0.042; 0.081] |
| arranque · em-falta/base/carga | mês | 501 | 4.94% | 4.94% | -0.000 [-0.000; 0.000] | -0.000 [-0.000; 0.000] |
| esparso · em-falta/base/carga | próxima rep | 504 | 1.21% | 1.21% | 0.006 [0.003; 0.008] | 0.004 [0.002; 0.005] |
| esparso · em-falta/base/carga | semana | 504 | 2.74% | 2.79% | 0.048 [0.014; 0.089] | 0.028 [0.008; 0.051] |
| esparso · em-falta/base/carga | mês | 504 | 3.89% | 3.86% | -0.022 [-0.049; 0.003] | -0.012 [-0.030; 0.004] |
| tipico · em-falta/base/carga | próxima rep | 3588 | 1.07% | 1.07% | -0.001 [-0.002; 0.001] | -0.001 [-0.002; 0.000] |
| tipico · em-falta/base/carga | semana | 3588 | 1.68% | 1.68% | 0.004 [-0.006; 0.013] | 0.000 [-0.006; 0.006] |
| tipico · em-falta/base/carga | mês | 3588 | 2.36% | 2.35% | -0.004 [-0.016; 0.007] | -0.005 [-0.017; 0.006] |
| denso · em-falta/base/carga | próxima rep | 6990 | 1.01% | 1.01% | -0.002 [-0.002; -0.001] | -0.001 [-0.002; -0.000] |
| denso · em-falta/base/carga | semana | 6990 | 1.47% | 1.46% | -0.010 [-0.014; -0.005] | -0.005 [-0.010; -0.000] |
| denso · em-falta/base/carga | mês | 6990 | 1.97% | 1.94% | -0.021 [-0.033; -0.010] | -0.013 [-0.026; -0.002] |
