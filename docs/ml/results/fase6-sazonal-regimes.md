# modelo de estado sazonal com âncoras + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|

Regras: R1 ✗ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| multiano · em-falta/base/carga | dia | 27035 | 1.30% | 1.30% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| multiano · em-falta/base/carga | semana | 27035 | 1.34% | 1.34% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| multiano · em-falta/base/carga | mês | 27035 | 1.60% | 1.58% | -0.019 [-0.027; -0.011] | -0.016 [-0.022; -0.009] |
| multiano · em-falta/base/carga | ano | 27035 | 3.36% | 2.63% | -0.733 [-0.782; -0.687] | -0.557 [-0.593; -0.524] |
| regresso-curta · em-falta/base/carga | dia | 7513 | 1.42% | 1.42% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| regresso-curta · em-falta/base/carga | semana | 7513 | 1.48% | 1.48% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| regresso-curta · em-falta/base/carga | mês | 7513 | 1.82% | 1.82% | -0.003 [-0.012; 0.008] | -0.002 [-0.010; 0.006] |
| regresso-longa · em-falta/base/carga | dia | 7741 | 1.41% | 1.41% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| regresso-longa · em-falta/base/carga | semana | 7741 | 1.47% | 1.47% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| regresso-longa · em-falta/base/carga | mês | 7741 | 1.89% | 1.87% | -0.015 [-0.024; -0.006] | -0.015 [-0.023; -0.007] |
| regresso-tardia · em-falta/base/carga | dia | 7649 | 1.42% | 1.42% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| regresso-tardia · em-falta/base/carga | semana | 7649 | 1.48% | 1.48% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| regresso-tardia · em-falta/base/carga | mês | 7649 | 1.94% | 1.93% | -0.004 [-0.014; 0.004] | -0.009 [-0.018; -0.001] |
