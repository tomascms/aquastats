# modelo de estado + contexto + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 501 | 2.83% | 2.83% | 0.002 [-0.006; 0.009] | -0.000 [-0.005; 0.004] | 0.049 [-0.286; 0.317] |
| esparso · em-falta/base/carga | 504 | 2.60% | 2.61% | 0.003 [-0.003; 0.009] | 0.002 [-0.003; 0.007] | -0.184 [-0.381; -0.006] |
| tipico · em-falta/base/carga | 3588 | 1.59% | 1.58% | -0.012 [-0.019; -0.006] | -0.009 [-0.014; -0.005] | -0.028 [-0.151; 0.096] |
| denso · em-falta/base/carga | 6990 | 1.40% | 1.38% | -0.025 [-0.035; -0.015] | -0.018 [-0.024; -0.011] | -0.018 [-0.070; 0.040] |

Regras: R1 ✗ · R2 ✓ · R3 ✗ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 501 | 1.19% | 1.19% | -0.000 [-0.002; 0.001] | -0.001 [-0.002; -0.000] |
| arranque · em-falta/base/carga | semana | 501 | 3.23% | 3.23% | -0.004 [-0.011; 0.003] | -0.001 [-0.005; 0.004] |
| arranque · em-falta/base/carga | mês | 501 | 4.94% | 4.93% | -0.003 [-0.009; 0.003] | -0.000 [-0.003; 0.002] |
| esparso · em-falta/base/carga | próxima rep | 504 | 1.21% | 1.21% | -0.000 [-0.001; 0.001] | -0.000 [-0.001; 0.000] |
| esparso · em-falta/base/carga | semana | 504 | 2.74% | 2.74% | 0.002 [-0.003; 0.007] | 0.001 [-0.003; 0.005] |
| esparso · em-falta/base/carga | mês | 504 | 3.89% | 3.88% | -0.003 [-0.006; 0.000] | -0.001 [-0.004; 0.001] |
| tipico · em-falta/base/carga | próxima rep | 3588 | 1.07% | 1.06% | -0.004 [-0.005; -0.002] | -0.002 [-0.003; -0.001] |
| tipico · em-falta/base/carga | semana | 3588 | 1.68% | 1.67% | -0.011 [-0.016; -0.005] | -0.008 [-0.011; -0.004] |
| tipico · em-falta/base/carga | mês | 3588 | 2.36% | 2.35% | -0.008 [-0.017; 0.000] | -0.005 [-0.009; -0.000] |
| denso · em-falta/base/carga | próxima rep | 6990 | 1.01% | 1.00% | -0.006 [-0.008; -0.004] | -0.004 [-0.006; -0.003] |
| denso · em-falta/base/carga | semana | 6990 | 1.47% | 1.44% | -0.025 [-0.031; -0.018] | -0.018 [-0.023; -0.012] |
| denso · em-falta/base/carga | mês | 6990 | 1.97% | 1.94% | -0.027 [-0.037; -0.018] | -0.019 [-0.027; -0.013] |
