# ensemble η20 + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 501 | 2.83% | 2.84% | 0.011 [0.006; 0.017] | 0.027 [0.012; 0.048] | 0.659 [0.086; 1.188] |
| esparso · em-falta/base/carga | 504 | 2.60% | 2.61% | 0.010 [0.003; 0.016] | 0.016 [0.006; 0.027] | 0.549 [-0.007; 1.076] |
| tipico · em-falta/base/carga | 3588 | 1.59% | 1.60% | 0.013 [0.010; 0.015] | 0.036 [0.026; 0.047] | -0.464 [-0.610; -0.299] |
| denso · em-falta/base/carga | 6990 | 1.40% | 1.41% | 0.007 [0.005; 0.008] | 0.025 [0.017; 0.036] | 0.006 [-0.039; 0.048] |

Regras: R1 ✗ · R2 ✓ · R3 ✗ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 501 | 1.19% | 1.29% | 0.091 [0.056; 0.132] | 0.086 [0.046; 0.133] |
| arranque · em-falta/base/carga | semana | 501 | 3.23% | 3.24% | 0.011 [0.006; 0.016] | 0.028 [0.011; 0.054] |
| arranque · em-falta/base/carga | mês | 501 | 4.94% | 4.95% | 0.010 [-0.001; 0.023] | 0.009 [-0.000; 0.022] |
| esparso · em-falta/base/carga | próxima rep | 504 | 1.21% | 1.26% | 0.054 [0.036; 0.075] | 0.049 [0.032; 0.066] |
| esparso · em-falta/base/carga | semana | 504 | 2.74% | 2.75% | 0.015 [0.008; 0.022] | 0.020 [0.009; 0.030] |
| esparso · em-falta/base/carga | mês | 504 | 3.89% | 3.90% | 0.016 [0.007; 0.025] | 0.020 [0.008; 0.034] |
| tipico · em-falta/base/carga | próxima rep | 3588 | 1.07% | 1.08% | 0.009 [0.006; 0.012] | 0.013 [0.009; 0.017] |
| tipico · em-falta/base/carga | semana | 3588 | 1.68% | 1.69% | 0.015 [0.011; 0.018] | 0.039 [0.027; 0.051] |
| tipico · em-falta/base/carga | mês | 3588 | 2.36% | 2.39% | 0.035 [0.027; 0.043] | 0.080 [0.064; 0.097] |
| denso · em-falta/base/carga | próxima rep | 6990 | 1.01% | 1.01% | 0.004 [0.002; 0.006] | 0.006 [0.002; 0.014] |
| denso · em-falta/base/carga | semana | 6990 | 1.47% | 1.48% | 0.009 [0.006; 0.011] | 0.031 [0.022; 0.042] |
| denso · em-falta/base/carga | mês | 6990 | 1.97% | 2.00% | 0.036 [0.028; 0.044] | 0.105 [0.076; 0.138] |
