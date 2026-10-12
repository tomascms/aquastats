# v1.0 + qualidade + conformal vs último valor (sementes de CONFIRMAÇÃO (gerador 4.0, uso único) 6201–6215, gerador 4.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · completos/base/carga | 6389 | 1.51% | 1.32% | -0.188 [-0.212; -0.166] | — [—; —] | — [—; —] | -0.172 [-0.238; -0.100] |
| esparso · completos/base/carga | 10132 | 1.43% | 1.21% | -0.218 [-0.237; -0.200] | — [—; —] | — [—; —] | -0.225 [-0.267; -0.177] |
| tipico · completos/base/carga | 40312 | 1.52% | 1.30% | -0.216 [-0.230; -0.205] | — [—; —] | — [—; —] | -0.237 [-0.291; -0.182] |
| denso · completos/base/carga | 67386 | 1.53% | 1.31% | -0.215 [-0.231; -0.200] | — [—; —] | — [—; —] | -0.254 [-0.295; -0.211] |

ΔMAPE agregado (média das células por semente): -0.209 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.195.

Regras: R1 ✓ · R2 ✓ · R3 ✗ · R4 ✗ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: NÃO MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 176823 | 1.55% | 1.24% | -0.311 | — |
| Escalão (idade) | ≥ 17 anos | 1323240 | 1.52% | 1.32% | -0.199 | — |
| Escalão (idade) | 13–14 anos | 164074 | 1.56% | 1.30% | -0.258 | — |
| Escalão (idade) | 15–16 anos | 199143 | 1.43% | 1.23% | -0.198 | — |
| Estilo principal | back | 480436 | 1.54% | 1.33% | -0.208 | — |
| Estilo principal | breast | 378603 | 1.47% | 1.25% | -0.213 | — |
| Estilo principal | fly | 200027 | 1.53% | 1.30% | -0.235 | — |
| Estilo principal | free | 577555 | 1.51% | 1.30% | -0.213 | — |
| Estilo principal | im | 226659 | 1.53% | 1.32% | -0.217 | — |
| Sexo | F | 1075004 | 1.50% | 1.28% | -0.214 | — |
| Sexo | M | 788276 | 1.53% | 1.32% | -0.215 | — |

Probabilidade de quebra do desafiante vs taxa de quebra da equipa até à véspera (R8; Δ = modelo − referência, IC 95 % bootstrap das sementes):

| Célula | Taxa de quebra | ΔBrier | ΔLog loss |
|---|---|---|---|
| arranque · completos/base/carga | 4% | -0.0094 [-0.0122; -0.0069] | -0.0323 [-0.0438; -0.0205] |
| esparso · completos/base/carga | 3% | -0.0051 [-0.0066; -0.0038] | -0.0170 [-0.0247; -0.0096] |
| tipico · completos/base/carga | 4% | -0.0039 [-0.0052; -0.0027] | -0.0163 [-0.0228; -0.0097] |
| denso · completos/base/carga | 4% | -0.0032 [-0.0047; -0.0018] | -0.0129 [-0.0211; -0.0041] |

R8 (quebra): Brier com IC < 0 em 4 de 4 células → ✓.

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 1193.5 (gl 389), p < 0,001. Melhoram com IC 95 % < 0: 337 de 390 (86 %); pioram com IC > 0: 0 (0 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 318 | -0.222 | 277 | 0 |
| atípico | 72 | -0.238 | 60 | 0 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · completos/base/carga | próxima rep | 8446 | 1.19% | 0.97% | -0.217 [-0.243; -0.189] | — [—; —] |
| arranque · completos/base/carga | semana | 5447 | 1.57% | 1.33% | -0.240 [-0.279; -0.201] | — [—; —] |
| arranque · completos/base/carga | mês | 1156 | 2.09% | 1.45% | -0.634 [-0.712; -0.550] | — [—; —] |
| esparso · completos/base/carga | próxima rep | 12189 | 1.17% | 0.91% | -0.259 [-0.274; -0.243] | — [—; —] |
| esparso · completos/base/carga | semana | 9493 | 1.49% | 1.22% | -0.269 [-0.297; -0.242] | — [—; —] |
| esparso · completos/base/carga | mês | 5559 | 1.83% | 1.44% | -0.392 [-0.434; -0.351] | — [—; —] |
| tipico · completos/base/carga | próxima rep | 43611 | 1.20% | 0.93% | -0.271 [-0.295; -0.243] | — [—; —] |
| tipico · completos/base/carga | semana | 39244 | 1.55% | 1.29% | -0.265 [-0.279; -0.250] | — [—; —] |
| tipico · completos/base/carga | mês | 32107 | 1.82% | 1.62% | -0.199 [-0.221; -0.175] | — [—; —] |
| denso · completos/base/carga | próxima rep | 70837 | 1.20% | 0.92% | -0.278 [-0.300; -0.254] | — [—; —] |
| denso · completos/base/carga | semana | 66183 | 1.58% | 1.34% | -0.238 [-0.254; -0.222] | — [—; —] |
| denso · completos/base/carga | mês | 57707 | 1.82% | 1.72% | -0.102 [-0.131; -0.074] | — [—; —] |
