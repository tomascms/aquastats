# E2 · estilo principal + qualidade + conformal vs campeão da fase final + qualidade + conformal (sementes de desenvolvimento 3001–3015, gerador 3.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 519 | 3.10% | 3.07% | -0.028 [-0.054; -0.005] | -0.022 [-0.039; -0.007] | -0.315 [-0.563; 0.001] | -0.022 [-0.075; 0.027] |
| esparso · em-falta/base/carga | 476 | 2.94% | 2.90% | -0.044 [-0.068; -0.022] | -0.028 [-0.044; -0.014] | 0.223 [-0.031; 0.529] | -0.050 [-0.113; 0.003] |
| tipico · em-falta/base/carga | 3393 | 1.96% | 1.95% | -0.009 [-0.014; -0.005] | -0.006 [-0.008; -0.003] | 0.053 [-0.012; 0.134] | -0.008 [-0.024; 0.003] |
| denso · em-falta/base/carga | 6727 | 1.71% | 1.70% | -0.005 [-0.008; -0.002] | -0.003 [-0.005; -0.001] | 0.011 [-0.010; 0.033] | -0.005 [-0.009; -0.002] |

ΔMAPE agregado (média das células por semente): -0.021 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.010.

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 19287 | 1.90% | 1.88% | -0.014 | -0.0 |
| Escalão (idade) | ≥ 17 anos | 45366 | 2.01% | 2.00% | -0.007 | -0.0 |
| Escalão (idade) | 13–14 anos | 49143 | 1.86% | 1.85% | -0.009 | 0.0 |
| Escalão (idade) | 15–16 anos | 52923 | 1.83% | 1.82% | -0.008 | 0.0 |
| Estilo principal | back | 24598 | 1.97% | 1.95% | -0.019 | -0.1 |
| Estilo principal | breast | 24459 | 1.88% | 1.87% | -0.008 | 0.0 |
| Estilo principal | fly | 32816 | 1.97% | 1.96% | -0.012 | -0.0 |
| Estilo principal | free | 65492 | 1.85% | 1.85% | -0.000 | 0.1 |
| Estilo principal | im | 19354 | 1.84% | 1.82% | -0.022 | -0.1 |
| Sexo | F | 80400 | 1.87% | 1.86% | -0.008 | 0.0 |
| Sexo | M | 86319 | 1.91% | 1.90% | -0.010 | -0.0 |

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 421.7 (gl 338), p = 0.001. Melhoram com IC 95 % < 0: 40 de 378 (11 %); pioram com IC > 0: 9 (2 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 301 | -0.000 | 34 | 8 |
| atípico | 77 | -0.000 | 6 | 1 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → não cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 519 | 1.40% | 1.40% | -0.003 [-0.007; 0.001] | -0.002 [-0.005; -0.000] |
| arranque · em-falta/base/carga | semana | 519 | 3.46% | 3.44% | -0.023 [-0.049; 0.000] | -0.019 [-0.036; -0.004] |
| arranque · em-falta/base/carga | mês | 519 | 5.46% | 5.43% | -0.032 [-0.072; 0.003] | -0.017 [-0.029; -0.006] |
| esparso · em-falta/base/carga | próxima rep | 476 | 1.37% | 1.37% | -0.005 [-0.008; -0.002] | -0.003 [-0.005; -0.002] |
| esparso · em-falta/base/carga | semana | 476 | 3.14% | 3.10% | -0.046 [-0.069; -0.025] | -0.028 [-0.044; -0.013] |
| esparso · em-falta/base/carga | mês | 476 | 4.41% | 4.35% | -0.064 [-0.103; -0.032] | -0.041 [-0.079; -0.015] |
| tipico · em-falta/base/carga | próxima rep | 3393 | 1.25% | 1.25% | -0.002 [-0.002; -0.001] | -0.001 [-0.002; -0.001] |
| tipico · em-falta/base/carga | semana | 3393 | 2.03% | 2.02% | -0.010 [-0.015; -0.005] | -0.007 [-0.010; -0.004] |
| tipico · em-falta/base/carga | mês | 3393 | 2.72% | 2.70% | -0.022 [-0.029; -0.016] | -0.015 [-0.020; -0.010] |
| denso · em-falta/base/carga | próxima rep | 6727 | 1.21% | 1.21% | -0.001 [-0.001; -0.000] | -0.000 [-0.001; -0.000] |
| denso · em-falta/base/carga | semana | 6727 | 1.78% | 1.77% | -0.006 [-0.009; -0.002] | -0.003 [-0.005; -0.001] |
| denso · em-falta/base/carga | mês | 6727 | 2.34% | 2.33% | -0.012 [-0.018; -0.007] | -0.008 [-0.012; -0.004] |
