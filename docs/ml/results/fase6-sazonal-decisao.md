# modelo de estado sazonal com âncoras + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de teste, gerador 2.0)

Células de decisão, horizonte dia, nas mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 501 | 2.83% | 2.83% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| esparso · em-falta/base/carga | 504 | 2.60% | 2.60% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| tipico · em-falta/base/carga | 3588 | 1.59% | 1.59% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| denso · em-falta/base/carga | 6990 | 1.40% | 1.40% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |

Regras: R1 ✗ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 501 | 1.19% | 1.19% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| arranque · em-falta/base/carga | semana | 501 | 3.23% | 3.23% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| arranque · em-falta/base/carga | mês | 501 | 4.94% | 4.94% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| esparso · em-falta/base/carga | próxima rep | 504 | 1.21% | 1.21% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| esparso · em-falta/base/carga | semana | 504 | 2.74% | 2.74% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| esparso · em-falta/base/carga | mês | 504 | 3.89% | 3.89% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| tipico · em-falta/base/carga | próxima rep | 3588 | 1.07% | 1.07% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| tipico · em-falta/base/carga | semana | 3588 | 1.68% | 1.68% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| tipico · em-falta/base/carga | mês | 3588 | 2.36% | 2.36% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| denso · em-falta/base/carga | próxima rep | 6990 | 1.01% | 1.01% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| denso · em-falta/base/carga | semana | 6990 | 1.47% | 1.47% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
| denso · em-falta/base/carga | mês | 6990 | 1.97% | 1.97% | 0.000 [0.000; 0.000] | 0.000 [0.000; 0.000] |
