# E8 · contexto individual com sinal e atraso + qualidade + conformal vs campeão da fase final + qualidade + conformal (sementes de desenvolvimento 3001–3015, gerador 3.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 519 | 2.98% | 2.99% | 0.003 [-0.008; 0.015] | -0.002 [-0.009; 0.004] | 0.071 [-0.178; 0.341] | 0.033 [-0.003; 0.087] |
| esparso · em-falta/base/carga | 476 | 2.80% | 2.80% | 0.002 [-0.002; 0.006] | -0.000 [-0.004; 0.003] | 0.015 [-0.162; 0.202] | 0.002 [-0.013; 0.016] |
| tipico · em-falta/base/carga | 3393 | 1.93% | 1.91% | -0.019 [-0.030; -0.009] | -0.013 [-0.021; -0.006] | 0.098 [-0.026; 0.242] | -0.041 [-0.076; -0.013] |
| denso · em-falta/base/carga | 6727 | 1.69% | 1.64% | -0.053 [-0.071; -0.038] | -0.036 [-0.050; -0.025] | 0.020 [-0.037; 0.075] | -0.058 [-0.094; -0.026] |

ΔMAPE agregado (média das células por semente): -0.017 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.010.

Regras: R1 ✗ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 19287 | 1.85% | 1.81% | -0.035 | -0.1 |
| Escalão (idade) | ≥ 17 anos | 45366 | 1.98% | 1.93% | -0.044 | 0.0 |
| Escalão (idade) | 13–14 anos | 49143 | 1.83% | 1.79% | -0.046 | -0.0 |
| Escalão (idade) | 15–16 anos | 52923 | 1.80% | 1.77% | -0.028 | 0.2 |
| Estilo principal | back | 24598 | 1.92% | 1.84% | -0.079 | -0.2 |
| Estilo principal | breast | 24459 | 1.84% | 1.80% | -0.048 | -0.0 |
| Estilo principal | fly | 32816 | 1.93% | 1.90% | -0.031 | 0.0 |
| Estilo principal | free | 65492 | 1.83% | 1.80% | -0.027 | 0.1 |
| Estilo principal | im | 19354 | 1.81% | 1.78% | -0.023 | 0.4 |
| Sexo | F | 80400 | 1.83% | 1.79% | -0.045 | -0.0 |
| Sexo | M | 86319 | 1.89% | 1.86% | -0.032 | 0.1 |

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 800.0 (gl 377), p < 0,001. Melhoram com IC 95 % < 0: 68 de 378 (18 %); pioram com IC > 0: 18 (5 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 301 | -0.006 | 54 | 10 |
| atípico | 77 | -0.006 | 14 | 8 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → não cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 519 | 1.38% | 1.37% | -0.002 [-0.003; -0.001] | -0.001 [-0.002; -0.000] |
| arranque · em-falta/base/carga | semana | 519 | 3.35% | 3.35% | -0.002 [-0.009; 0.005] | -0.003 [-0.008; 0.002] |
| arranque · em-falta/base/carga | mês | 519 | 5.37% | 5.38% | 0.012 [0.001; 0.025] | 0.008 [0.002; 0.014] |
| esparso · em-falta/base/carga | próxima rep | 476 | 1.34% | 1.34% | -0.001 [-0.002; 0.000] | -0.001 [-0.002; 0.000] |
| esparso · em-falta/base/carga | semana | 476 | 2.96% | 2.96% | 0.003 [-0.001; 0.007] | -0.001 [-0.004; 0.002] |
| esparso · em-falta/base/carga | mês | 476 | 4.17% | 4.17% | -0.003 [-0.006; -0.000] | -0.002 [-0.004; -0.000] |
| tipico · em-falta/base/carga | próxima rep | 3393 | 1.24% | 1.24% | -0.005 [-0.008; -0.003] | -0.004 [-0.005; -0.002] |
| tipico · em-falta/base/carga | semana | 3393 | 1.99% | 1.97% | -0.018 [-0.027; -0.010] | -0.012 [-0.018; -0.007] |
| tipico · em-falta/base/carga | mês | 3393 | 2.66% | 2.64% | -0.019 [-0.027; -0.012] | -0.013 [-0.018; -0.008] |
| denso · em-falta/base/carga | próxima rep | 6727 | 1.21% | 1.20% | -0.014 [-0.020; -0.010] | -0.010 [-0.014; -0.006] |
| denso · em-falta/base/carga | semana | 6727 | 1.76% | 1.72% | -0.047 [-0.066; -0.033] | -0.032 [-0.046; -0.022] |
| denso · em-falta/base/carga | mês | 6727 | 2.32% | 2.28% | -0.041 [-0.062; -0.024] | -0.030 [-0.045; -0.019] |
