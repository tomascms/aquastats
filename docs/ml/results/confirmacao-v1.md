# v1.0 + qualidade + conformal vs modelo de estado + qualidade + conformal (sementes de CONFIRMAÇÃO 4001–4015, gerador 3.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 520 | 3.15% | 2.98% | -0.169 [-0.259; -0.087] | -0.164 [-0.223; -0.109] | -1.645 [-2.627; -0.636] | -0.125 [-0.270; 0.015] |
| esparso · em-falta/base/carga | 457 | 2.98% | 2.76% | -0.221 [-0.343; -0.116] | -0.168 [-0.241; -0.105] | -1.677 [-2.468; -0.942] | 0.114 [-0.097; 0.361] |
| tipico · em-falta/base/carga | 3223 | 2.00% | 1.85% | -0.146 [-0.193; -0.100] | -0.110 [-0.142; -0.078] | -0.898 [-1.215; -0.591] | -0.096 [-0.180; -0.002] |
| denso · em-falta/base/carga | 6669 | 1.67% | 1.56% | -0.106 [-0.134; -0.078] | -0.082 [-0.105; -0.060] | -0.259 [-0.392; -0.137] | -0.172 [-0.291; -0.078] |

ΔMAPE agregado (média das células por semente): -0.161 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.094.

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 25311 | 1.99% | 1.80% | -0.195 | -1.2 |
| Escalão (idade) | ≥ 17 anos | 43654 | 1.80% | 1.72% | -0.083 | -0.2 |
| Escalão (idade) | 13–14 anos | 42970 | 2.00% | 1.86% | -0.138 | -0.8 |
| Escalão (idade) | 15–16 anos | 51092 | 1.80% | 1.69% | -0.108 | -0.4 |
| Estilo principal | back | 37245 | 1.92% | 1.77% | -0.157 | -0.8 |
| Estilo principal | breast | 24822 | 1.81% | 1.68% | -0.128 | -0.2 |
| Estilo principal | fly | 17476 | 1.96% | 1.80% | -0.168 | -0.7 |
| Estilo principal | free | 59445 | 1.88% | 1.80% | -0.085 | -0.5 |
| Estilo principal | im | 24039 | 1.84% | 1.72% | -0.127 | -0.4 |
| Sexo | F | 82988 | 1.83% | 1.73% | -0.103 | -0.5 |
| Sexo | M | 80039 | 1.94% | 1.79% | -0.143 | -0.7 |

## Confirmação (pré-registada, uma única vez)

C1 — ΔMAPE agregado -0.161 [-0.213; -0.113] pp (IC 95 %) → ✓
C2 — ΔCRPS ≤ 0 em todas as células → ✓
C3 — cobertura a 80 % entre 77 % e 83 % (ou não pior que a do campeão): arranque 77% (campeão 75%), esparso 80% (campeão 78%), tipico 79% (campeão 78%), denso 80% (campeão 79%) → ✓
C4 — nenhuma célula pior que +0,05 pp → ✓
C5 — fugas: 0 → ✓
C6 — dados reais (só leitura): avaliado à parte.

**Confirmação: PASSA (C1–C5).**

Probabilidade de quebra do desafiante vs taxa de quebra da equipa até à véspera (R8; Δ = modelo − referência, IC 95 % bootstrap das sementes):

| Célula | Taxa de quebra | ΔBrier | ΔLog loss |
|---|---|---|---|
| arranque · em-falta/base/carga | 9% | -0.0269 [-0.0351; -0.0191] | -0.1028 [-0.1314; -0.0750] |
| esparso · em-falta/base/carga | 8% | -0.0208 [-0.0264; -0.0153] | -0.0923 [-0.1127; -0.0730] |
| tipico · em-falta/base/carga | 9% | -0.0215 [-0.0283; -0.0149] | -0.0837 [-0.1060; -0.0605] |
| denso · em-falta/base/carga | 9% | -0.0205 [-0.0280; -0.0138] | -0.0774 [-0.0995; -0.0562] |

R8 (quebra): Brier com IC < 0 em 4 de 4 células → ✓.

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 1010.2 (gl 374), p < 0,001. Melhoram com IC 95 % < 0: 99 de 375 (26 %); pioram com IC > 0: 8 (2 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 280 | -0.118 | 79 | 4 |
| atípico | 95 | -0.057 | 20 | 4 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 520 | 1.38% | 1.45% | 0.073 [0.013; 0.130] | 0.027 [-0.020; 0.071] |
| arranque · em-falta/base/carga | semana | 520 | 3.58% | 3.40% | -0.180 [-0.280; -0.077] | -0.196 [-0.254; -0.134] |
| arranque · em-falta/base/carga | mês | 520 | 5.54% | 5.48% | -0.061 [-0.139; 0.013] | -0.140 [-0.195; -0.082] |
| esparso · em-falta/base/carga | próxima rep | 457 | 1.33% | 1.41% | 0.081 [0.049; 0.111] | 0.045 [0.023; 0.065] |
| esparso · em-falta/base/carga | semana | 457 | 3.15% | 2.93% | -0.225 [-0.324; -0.130] | -0.177 [-0.236; -0.119] |
| esparso · em-falta/base/carga | mês | 457 | 4.44% | 4.26% | -0.183 [-0.340; -0.035] | -0.168 [-0.272; -0.071] |
| tipico · em-falta/base/carga | próxima rep | 3223 | 1.23% | 1.20% | -0.028 [-0.051; -0.005] | -0.036 [-0.055; -0.018] |
| tipico · em-falta/base/carga | semana | 3223 | 2.10% | 1.95% | -0.155 [-0.211; -0.103] | -0.118 [-0.157; -0.082] |
| tipico · em-falta/base/carga | mês | 3223 | 2.84% | 2.74% | -0.094 [-0.164; -0.029] | -0.085 [-0.131; -0.043] |
| denso · em-falta/base/carga | próxima rep | 6669 | 1.15% | 1.11% | -0.042 [-0.071; -0.015] | -0.043 [-0.067; -0.020] |
| denso · em-falta/base/carga | semana | 6669 | 1.74% | 1.64% | -0.105 [-0.133; -0.077] | -0.082 [-0.104; -0.061] |
| denso · em-falta/base/carga | mês | 6669 | 2.32% | 2.20% | -0.124 [-0.174; -0.075] | -0.097 [-0.133; -0.062] |
| multiano · em-falta/base/carga | dia | 26021 | 1.53% | 1.43% | -0.096 [-0.119; -0.069] | -0.074 [-0.093; -0.054] |
| multiano · em-falta/base/carga | semana | 26021 | 1.55% | 1.46% | -0.091 [-0.114; -0.065] | -0.071 [-0.090; -0.050] |
| multiano · em-falta/base/carga | mês | 26021 | 1.85% | 1.78% | -0.072 [-0.093; -0.046] | -0.052 [-0.071; -0.031] |
| multiano · em-falta/base/carga | ano | 26021 | 3.71% | 3.65% | -0.061 [-0.103; -0.015] | -0.104 [-0.131; -0.074] |
| regresso-curta · em-falta/base/carga | dia | 7458 | 1.68% | 1.58% | -0.101 [-0.125; -0.074] | -0.082 [-0.102; -0.060] |
| regresso-curta · em-falta/base/carga | semana | 7458 | 1.73% | 1.62% | -0.102 [-0.128; -0.073] | -0.082 [-0.103; -0.060] |
| regresso-curta · em-falta/base/carga | mês | 7458 | 2.13% | 2.05% | -0.082 [-0.126; -0.045] | -0.068 [-0.101; -0.039] |
| regresso-longa · em-falta/base/carga | dia | 7376 | 1.72% | 1.60% | -0.118 [-0.151; -0.086] | -0.092 [-0.116; -0.067] |
| regresso-longa · em-falta/base/carga | semana | 7376 | 1.75% | 1.64% | -0.113 [-0.153; -0.078] | -0.090 [-0.119; -0.063] |
| regresso-longa · em-falta/base/carga | mês | 7376 | 2.19% | 2.10% | -0.090 [-0.145; -0.040] | -0.081 [-0.122; -0.045] |
| regresso-tardia · em-falta/base/carga | dia | 7378 | 1.71% | 1.59% | -0.120 [-0.150; -0.089] | -0.093 [-0.114; -0.070] |
| regresso-tardia · em-falta/base/carga | semana | 7378 | 1.77% | 1.65% | -0.121 [-0.159; -0.085] | -0.095 [-0.121; -0.068] |
| regresso-tardia · em-falta/base/carga | mês | 7378 | 2.28% | 2.18% | -0.098 [-0.138; -0.056] | -0.084 [-0.107; -0.057] |
