# v1.0 + qualidade + conformal vs modelo atual (sementes de desenvolvimento 3001–3015, gerador 3.0)

Decide: células "decision", horizonte dia, métrica primária MAPE. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):

| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |
|---|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | 126 | 1.98% | 1.56% | -0.424 [-0.615; -0.251] | -0.597 [-0.961; -0.318] | -25.143 [-31.969; -18.636] | -0.391 [-0.664; -0.129] |
| esparso · em-falta/base/carga | 138 | 1.74% | 1.30% | -0.438 [-0.511; -0.367] | -0.499 [-0.622; -0.392] | -25.507 [-32.743; -18.744] | -0.413 [-0.629; -0.207] |
| tipico · em-falta/base/carga | 2128 | 2.11% | 1.42% | -0.692 [-0.796; -0.587] | -0.771 [-0.917; -0.632] | -9.849 [-12.589; -7.110] | -0.634 [-0.842; -0.442] |
| denso · em-falta/base/carga | 5166 | 2.04% | 1.42% | -0.618 [-0.692; -0.543] | -0.755 [-0.886; -0.631] | -4.967 [-6.705; -3.370] | -0.694 [-0.857; -0.561] |

ΔMAPE agregado (média das células por semente): -0.543 pp; limite unilateral a 99.67 % (R9, Bonferroni sobre 15): -0.447.

Regras: R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R9 ✓ · R10 ✓ (fuga: 0).

**Veredicto: MANTER**

Paridade (R10; subgrupos com ≥ 200 reps decidem):

| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |
|---|---|---|---|---|---|---|
| Escalão (idade) | ≤ 12 anos | 12487 | 1.90% | 1.39% | -0.512 | -7.4 |
| Escalão (idade) | ≥ 17 anos | 31254 | 2.08% | 1.50% | -0.578 | -8.1 |
| Escalão (idade) | 13–14 anos | 33514 | 2.09% | 1.39% | -0.699 | -7.4 |
| Escalão (idade) | 15–16 anos | 36129 | 2.03% | 1.37% | -0.662 | -6.3 |
| Estilo principal | back | 16045 | 2.23% | 1.47% | -0.759 | -9.0 |
| Estilo principal | breast | 16589 | 1.94% | 1.38% | -0.555 | -7.0 |
| Estilo principal | fly | 22098 | 2.08% | 1.42% | -0.658 | -4.8 |
| Estilo principal | free | 45496 | 2.07% | 1.41% | -0.658 | -6.9 |
| Estilo principal | im | 13156 | 1.85% | 1.40% | -0.452 | -10.9 |
| Sexo | F | 54800 | 2.00% | 1.41% | -0.596 | -6.7 |
| Sexo | M | 58584 | 2.09% | 1.42% | -0.668 | -8.1 |

Probabilidade de quebra do desafiante vs taxa de quebra da equipa até à véspera (R8; Δ = modelo − referência, IC 95 % bootstrap das sementes):

| Célula | Taxa de quebra | ΔBrier | ΔLog loss |
|---|---|---|---|
| arranque · em-falta/base/carga | 10% | -0.0371 [-0.0513; -0.0257] | -0.1347 [-0.1734; -0.1006] |
| esparso · em-falta/base/carga | 8% | -0.0179 [-0.0309; -0.0061] | -0.0808 [-0.1244; -0.0395] |
| tipico · em-falta/base/carga | 10% | -0.0296 [-0.0401; -0.0210] | -0.1046 [-0.1308; -0.0802] |
| denso · em-falta/base/carga | 10% | -0.0255 [-0.0351; -0.0166] | -0.0916 [-0.1176; -0.0659] |

R8 (quebra): Brier com IC < 0 em 4 de 4 células → ✓.

Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):

Q de Cochran = 1049.1 (gl 238), p < 0,001. Melhoram com IC 95 % < 0: 185 de 239 (77 %); pioram com IC > 0: 0 (0 %).

| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |
|---|---|---|---|---|
| típico | 193 | -0.547 | 149 | 0 |
| atípico | 46 | -0.666 | 36 | 0 |

Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → cumpre.

Outras células e horizontes (relatados, não decidem):

| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |
|---|---|---|---|---|---|---|
| arranque · em-falta/base/carga | próxima rep | 126 | 1.98% | 1.16% | -0.822 [-1.055; -0.617] | -0.892 [-1.275; -0.591] |
| arranque · em-falta/base/carga | semana | 105 | 2.03% | 1.59% | -0.441 [-0.644; -0.265] | -0.591 [-0.947; -0.314] |
| arranque · em-falta/base/carga | mês | 18 | 2.03% | 1.35% | -0.681 [-1.121; -0.246] | -0.634 [-1.040; -0.262] |
| esparso · em-falta/base/carga | próxima rep | 138 | 1.74% | 0.98% | -0.754 [-0.848; -0.660] | -0.719 [-0.852; -0.598] |
| esparso · em-falta/base/carga | semana | 118 | 1.73% | 1.32% | -0.407 [-0.498; -0.321] | -0.464 [-0.602; -0.344] |
| esparso · em-falta/base/carga | mês | 44 | 1.77% | 1.48% | -0.285 [-0.428; -0.143] | -0.340 [-0.505; -0.176] |
| tipico · em-falta/base/carga | próxima rep | 2128 | 2.11% | 1.12% | -0.992 [-1.098; -0.882] | -0.978 [-1.121; -0.837] |
| tipico · em-falta/base/carga | semana | 2050 | 2.12% | 1.43% | -0.691 [-0.799; -0.581] | -0.762 [-0.917; -0.613] |
| tipico · em-falta/base/carga | mês | 1579 | 2.20% | 1.57% | -0.628 [-0.742; -0.513] | -0.677 [-0.826; -0.532] |
| denso · em-falta/base/carga | próxima rep | 5166 | 2.04% | 1.11% | -0.926 [-1.001; -0.851] | -0.969 [-1.102; -0.845] |
| denso · em-falta/base/carga | semana | 5019 | 2.07% | 1.44% | -0.628 [-0.710; -0.546] | -0.750 [-0.886; -0.623] |
| denso · em-falta/base/carga | mês | 4110 | 2.18% | 1.63% | -0.545 [-0.613; -0.474] | -0.634 [-0.755; -0.524] |
