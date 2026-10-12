# Natação: referências quantitativas para o produto

Data de acesso de todas as fontes: **2026-10-12**. Convenções:
- **[V]**: valor lido diretamente na fonte nesta sessão.
- **[A]**: valor tirado do resumo/registo bibliográfico (o texto integral não foi lido).
- **[D]**: valor derivado por nós a partir de valores [V]. A fórmula está indicada.
- **estimativa**: proposta nossa. Tem intervalo e justificação e **não** é um dado publicado.
- ⚠ fonte pouco fiável ou não verificada.

Tempos em `m:ss.cc`. PL = piscina longa (LCM, 50 m). PC = piscina curta (SCM, 25 m).

---

## 1. Tempos de referência

### 1.1 Tempos-base World Aquatics (= recordes mundiais aprovados)

Fonte [V]: World Aquatics, *Points – Base Times SCM and LCM 2026*,
https://resources.fina.org/fina/document/2026/01/27/3886f5b2-5bcf-464e-a626-059be2ed4567/Points-Base-times-SCM-and-LCM-2026_01.2026.pdf
- PL 2026: válidos de 01.01.2026 a 31.12.2026.
- PC 2025: válidos de 01.09.2025 a 31.08.2026.
- O documento diz que os tempos-base são os recordes mundiais aprovados no início do período de validade. Por isso a tabela também serve de **tabela de recordes mundiais**.

Fórmula: `pontos = 1000 × (B / T)^3`. Inversa: `T = B × (1000 / pontos)^(1/3)` (https://www.worldaquatics.com/swimming/points).

| Prova | PL H | PL M | PC H | PC M |
|---|---|---|---|---|
| 50 livres | 20.91 | 23.61 | 19.90 | 22.83 |
| 100 livres | 46.40 | 51.71 | 44.84 | 50.25 |
| 200 livres | 1:42.00 | 1:52.23 | 1:38.61 | 1:50.31 |
| 400 livres | 3:39.96 | 3:54.18 | 3:32.25 | 3:50.25 |
| 800 livres | 7:32.12 | 8:04.12 | 7:20.46 | 7:57.42 |
| 1500 livres | 14:30.67 | 15:20.48 | 14:06.88 | 15:08.24 |
| 50 costas | 23.55 | 26.86 | 22.11 | 25.23 |
| 100 costas | 51.60 | 57.13 | 48.33 | 54.02 |
| 200 costas | 1:51.92 | 2:03.14 | 1:45.63 | 1:58.04 |
| 50 bruços | 25.95 | 29.16 | 24.95 | 28.37 |
| 100 bruços | 56.88 | 1:04.13 | 55.28 | 1:02.36 |
| 200 bruços | 2:05.48 | 2:17.55 | 2:00.16 | 2:12.50 |
| 50 mariposa | 22.27 | 24.43 | 21.32 | 23.94 |
| 100 mariposa | 49.45 | 54.60 | 47.71 | 52.71 |
| 200 mariposa | 1:50.34 | 2:01.81 | 1:46.85 | 1:59.32 |
| 100 estilos | — | — | 49.28 | 55.11 |
| 200 estilos | 1:52.69 | 2:05.70 | 1:48.88 | 2:01.63 |
| 400 estilos | 4:02.50 | 4:23.65 | 3:54.81 | 4:15.48 |

Notas:
- Os tempos-base de 2026 mudam quando há novos recordes. O gerador deve guardar os tempos-base **versionados por ano**.
- ⚠ Discrepância: o relatório de Paris 2024 (abaixo) indica o recorde mundial feminino de 800 L como 8:04.79 e o de 400 L como 3:55.38. São os valores de agosto de 2024, já batidos.

### 1.2 Recordes europeus

Não foram obtidos nesta sessão a partir de uma fonte primária (European Aquatics). **Lacuna.** Para a escala de níveis não são precisos: os recordes mundiais e os tempos das finais chegam.

### 1.3 Finais olímpicas: tempo do 8.º lugar (Paris 2024, PL)

Fonte [V]: World Aquatics, *Paris 2024 Swimming Results Report*, cap. C.2, linha "Final", coluna "Slowest",
https://resources.fina.org/fina/document/2024/10/03/fbd120cc-9c34-4a55-ac29-ad778d159b0e/Paris-2024-Swimming-Results-Report.pdf
Os pontos são [D] com os tempos-base de 2026.

| Prova | H 8.º | pts | M 8.º | pts |
|---|---|---|---|---|
| 50 L | 21.64 | 902 | 24.39 | 907 |
| 100 L | 47.98 | 904 | 53.04 | 927 |
| 200 L | 1:46.26 | 884 | 1:56.60 | 892 |
| 400 L | 3:47.00 | 910 | 4:04.96 | 874 |
| 800 L | 7:48.36 | — | 8:23.27 | — |
| 1500 L | 14:52.61 | 928 | 16:12.57 ⚠ | 848 |
| 100 C | 52.84 | 931 | 59.80 | 872 |
| 100 B | 59.98 | 853 | 1:06.54 | 895 |
| 100 M | 51.11 | 906 | 57.34 | 863 |
| 200 E | 1:57.26 | 888 | 2:09.74 | 909 |

- ⚠ O tempo "mais lento da final" pode refletir um nado anómalo (por exemplo, a final feminina de 1500 L). Para um limiar robusto use a **mediana da final** do mesmo relatório (cap. C.1). Exemplos [V]: 100 L H 47.61 / M 52.53; 200 L H 1:45.16 / M 1:55.33.
- **Conclusão [D]:** o 8.º lugar olímpico corresponde a cerca de **850–930 pontos**, com mediana próxima de 900.
- Finais dos Mundiais: não foram obtidas (**lacuna**). Costumam ser ligeiramente mais lentas do que as olímpicas, mas isto é não verificado.

### 1.4 Critérios de admissão FPN (Campeonatos Nacionais de Juvenis, Juniores e Absolutos, Open de Portugal, PL)

Fonte [V]: FPN, *Regulamento de Competições Nacionais – Natação Pura 2024/2025*, pp. 43–44 (tabela "Tempos com critérios de admissão"), https://mail.fpnatacao.pt/uploads/eventos/Regulamento_-_Open_Portugal1.pdf
- ⚠ É a época **2024/25**. O regulamento de Natação Pura 2025/26 não foi encontrado. Os PDF "NA 25/26" em fpnatacao.pt são de Natação **Adaptada**, e o endereço `fpnatacao.pt/uploads/...` devolveu 403.
- ⚠ Não foram encontrados tempos de **Infantis** (há Zonais e Nacional de Infantis, segundo https://fpnatacao.pt/uploads/Apresentacao_FPN-ENS-2025.pdf, mas sem tabela). **Lacuna.**

Masculinos (PL). Pontos [D] na coluna Sénior / Juvenil B.

| Prova | Sénior | Sén. 1.º ano | Júnior 18 | Júnior 17 | Juvenil A | Juvenil B | pts Sén/JuvB |
|---|---|---|---|---|---|---|---|
| 50 L | 24.50 | 24.75 | 25.25 | 25.50 | 26.25 | 27.00 | 622/464 |
| 100 L | 53.50 | 54.00 | 55.25 | 55.75 | 57.00 | 58.50 | 652/499 |
| 200 L | 1:58.25 | 1:59.25 | 2:01.50 | 2:03.00 | 2:06.25 | 2:09.00 | 642/494 |
| 400 L | 4:15.00 | 4:16.75 | 4:21.50 | 4:24.00 | 4:31.00 | 4:38.00 | 642/495 |
| 800 L | 8:49.00 | 8:54.00 | 8:59.00 | 9:06.50 | 9:19.00 | 9:34.50 | — |
| 1500 L | 16:47.50 | 16:57.50 | 17:07.50 | 17:23.00 | 17:43.00 | 18:13.00 | 645/505 |
| 100 C | 1:01.50 | 1:01.75 | 1:03.00 | 1:03.50 | 1:05.25 | 1:07.00 | 591/457 |
| 100 B | 1:08.25 | 1:08.75 | 1:10.25 | 1:10.75 | 1:12.75 | 1:14.25 | 579/450 |
| 100 M | 58.00 | 58.25 | 59.50 | 1:00.25 | 1:02.00 | 1:03.50 | 620/472 |
| 200 E | 2:14.25 | 2:15.25 | 2:18.25 | 2:19.00 | 2:23.00 | 2:25.50 | 591/465 |

Femininos (PL). Nas femininas as colunas Júnior são "Júnior 17-18" e "Júnior 16".

| Prova | Sénior | Sén. 1.º ano | Jún. 17-18 | Jún. 16 | Juvenil A | Juvenil B | pts Sén/JuvB |
|---|---|---|---|---|---|---|---|
| 50 L | 27.75 | 28.25 | 28.75 | 29.00 | 29.75 | 30.25 | 616/475 |
| 100 L | 1:00.50 | 1:01.00 | 1:02.25 | 1:02.50 | 1:04.00 | 1:05.50 | 624/492 |
| 200 L | 2:11.50 | 2:12.50 | 2:14.25 | 2:15.75 | 2:19.00 | 2:21.75 | 622/496 |
| 400 L | 4:37.25 | 4:39.00 | 4:44.50 | 4:47.00 | 4:54.00 | 5:00.00 | 603/476 |
| 800 L | 9:19.00 | 9:24.00 | 9:33.25 | 9:42.25 | 9:54.50 | 10:00.00 | — |
| 1500 L | 18:03.00 | 18:18.00 | 18:30.25 | 18:43.25 | 19:03.51 | 19:23.50 | 614/495 |
| 100 C | 1:09.25 | 1:09.75 | 1:10.75 | 1:11.50 | 1:13.25 | 1:15.00 | 561/442 |
| 100 B | 1:17.75 | 1:18.25 | 1:20.00 | 1:20.50 | 1:22.25 | 1:24.00 | 561/445 |
| 100 M | 1:06.25 | 1:06.75 | 1:08.00 | 1:08.50 | 1:10.25 | 1:11.50 | 560/445 |
| 200 E | 2:29.75 | 2:30.75 | 2:33.50 | 2:34.75 | 2:38.25 | 2:41.75 | 591/469 |

O mesmo regulamento tem uma tabela de PC (p. 44) que não foi transcrita aqui. **Conclusão [D]:** o mínimo para o Nacional Absoluto está em cerca de 560–650 pontos e o mínimo de Juvenil B em cerca de 440–505.

### 1.5 Progressão por idade

- Allen, Vandenbogaerde & Hopkins (2014), *Eur J Sport Sci*, doi 10.1080/17461391.2014.893020 [A], via https://vuir.vu.edu.au/37056/ e https://srknowledge.org.nz/research-completed/career-performance-trajectories-of-olympic-swimmers-benchmarks-for-talent-development
  - Pico de desempenho aos **24.2 ± 2.1 anos (H)** e **22.5 ± 2.4 anos (M)**.
  - Nas distâncias curtas o pico é cerca de 1.5–2.0 anos mais tarde.
  - Melhoria até ao pico: **2.4 ± 1.2 % em 4 anos** e **9.5 ± 4.8 % em 8 anos**.
  - Os ganhos concentram-se no início (curva quadrática).
- Pyne, Trewin & Hopkins (2004), *J Sports Sci* 22:613–620 [A], https://vuir.vu.edu.au/36506/
  - Olímpicos: melhoria de **~0.9 %** no ano pré-olímpico e de **~1.2 %** das eliminatórias à final.
- **estimativa** da melhoria anual por idade, com o raciocínio:
  - 4 anos → 2.4 % dá ~0.6 %/ano perto do pico.
  - 8 anos → 9.5 % implica ~2.5–3.5 %/ano nos primeiros anos.
  - Faixas propostas:
    - 11–13 anos: 3–8 %/ano.
    - 14–16 anos: 2–4 %/ano.
    - 17–19 anos: 1–2 %/ano.
    - Mais de 20 anos: 0–1 %/ano.
  - Os extremos mais novos não têm estudo direto nesta revisão (⚠ lacuna). Costa et al. não foram verificados.

### 1.6 Seis níveis (escala em pontos World Aquatics)

**estimativa** ancorada em dados [V]/[D]:

| Nível | Pontos WA | Âncora |
|---|---|---|
| Iniciação | < 300 | Abaixo de tudo o que é federado nacional (sem fonte direta) |
| Regional | 300–450 | Abaixo do mínimo de Juvenil B FPN (≈440–505) |
| Nacional jovem | 450–600 | Entre o mínimo de Juvenil B e o mínimo Sénior FPN |
| Nacional absoluto | 600–750 | Do mínimo Sénior FPN (≈560–650) para cima |
| Internacional | 750–870 | Entre o nacional e uma final olímpica |
| Elite mundial | ≥ 870 | 8.º lugar olímpico ≈ 850–930 |

Limites de faixa [D] em PL, calculados com `T = B·(1000/P)^(1/3)` e tempos-base PL 2026. Cada coluna é o tempo **no limite inferior** de pontos de um nível (tempo máximo para entrar nesse nível).

**Homens (PL)**

| Prova | Elite ≥870 | Intern. ≥750 | Nac. abs. ≥600 | Nac. jovem ≥450 | Regional ≥300 | Iniciação |
|---|---|---|---|---|---|---|
| 50 L | ≤21.90 | ≤23.01 | ≤24.79 | ≤27.29 | ≤31.24 | >31.24 |
| 100 L | ≤48.60 | ≤51.07 | ≤55.01 | ≤1:00.55 | ≤1:09.31 | >1:09.31 |
| 200 L | ≤1:46.85 | ≤1:52.27 | ≤2:00.93 | ≤2:13.11 | ≤2:32.37 | >2:32.37 |
| 400 L | ≤3:50.41 | ≤4:02.10 | ≤4:20.79 | ≤4:47.04 | ≤5:28.58 | >5:28.58 |
| 800 L | ≤7:53.60 | ≤8:17.62 | ≤8:56.05 | ≤9:50.00 | ≤11:15.38 | >11:15.38 |
| 1500 L | ≤15:12.04 | ≤15:58.30 | ≤17:12.29 | ≤18:56.19 | ≤21:40.61 | >21:40.61 |
| 100 C | ≤54.05 | ≤56.79 | ≤1:01.18 | ≤1:07.34 | ≤1:17.08 | >1:17.08 |
| 100 B | ≤59.58 | ≤1:02.60 | ≤1:07.44 | ≤1:14.23 | ≤1:24.97 | >1:24.97 |
| 100 M | ≤51.80 | ≤54.43 | ≤58.63 | ≤1:04.53 | ≤1:13.87 | >1:13.87 |
| 200 E | ≤1:58.04 | ≤2:04.03 | ≤2:13.61 | ≤2:27.06 | ≤2:48.34 | >2:48.34 |

**Mulheres (PL)**

| Prova | Elite ≥870 | Intern. ≥750 | Nac. abs. ≥600 | Nac. jovem ≥450 | Regional ≥300 | Iniciação |
|---|---|---|---|---|---|---|
| 50 L | ≤24.73 | ≤25.99 | ≤27.99 | ≤30.81 | ≤35.27 | >35.27 |
| 100 L | ≤54.17 | ≤56.91 | ≤1:01.31 | ≤1:07.48 | ≤1:17.24 | >1:17.24 |
| 200 L | ≤1:57.56 | ≤2:03.53 | ≤2:13.06 | ≤2:26.46 | ≤2:47.65 | >2:47.65 |
| 400 L | ≤4:05.31 | ≤4:17.75 | ≤4:37.65 | ≤5:05.59 | ≤5:49.82 | >5:49.82 |
| 800 L | ≤8:27.12 | ≤8:52.84 | ≤9:33.99 | ≤10:31.76 | ≤12:03.18 | >12:03.18 |
| 1500 L | ≤16:04.22 | ≤16:53.12 | ≤18:11.35 | ≤20:01.19 | ≤22:55.01 | >22:55.01 |
| 100 C | ≤59.84 | ≤1:02.88 | ≤1:07.74 | ≤1:14.55 | ≤1:25.34 | >1:25.34 |
| 100 B | ≤1:07.18 | ≤1:10.58 | ≤1:16.03 | ≤1:23.69 | ≤1:35.80 | >1:35.80 |
| 100 M | ≤57.19 | ≤1:00.10 | ≤1:04.74 | ≤1:11.25 | ≤1:21.56 | >1:21.56 |
| 200 E | ≤2:11.67 | ≤2:18.35 | ≤2:29.03 | ≤2:44.03 | ≤3:07.77 | >3:07.77 |

Verificação [D]: o mínimo FPN Sénior H 100 L (53.50 ≈ 652 pts) cai em "Nac. absoluto". O mínimo de Juvenil B H 100 L (58.50 ≈ 499 pts) cai em "Nac. jovem". Coerente.

---

## 2. Relações entre provas

### 2.1 Conversão PC ↔ PL

- ⚠ A USA Swimming **não** publica fatores oficiais e desaconselha converter. Há uma série de PDF de clubes que repetem esta orientação, por exemplo https://www.gomotionapp.com/mwsace/UserFiles/File/long%20short%20course.pdf.
- Calculadoras usam +2 % a +3 % de PC para PL. ⚠ São fontes de terceiros sem validação: https://myswimsplits.com/?p=1347 e https://help.swimtopia.com/hc/en-us/community/posts/360060832272-Converting-Swim-Times-Everything-You-Ever-Wanted-To-Know.
- A NCAA publica uma tabela de conversão por prova (jardas para PL; ver https://swimswam.com/?p=771120). Os valores não foram obtidos.
- Razão [D] **PL/PC** entre recordes mundiais (tempos-base §1.1). Só vale para a elite: os recordes de PC e PL foram feitos por atletas diferentes.

| Prova | H | M |
|---|---|---|
| 50 L | 1.051 | 1.034 |
| 100 L | 1.035 | 1.029 |
| 200 L | 1.034 | 1.017 |
| 400 L | 1.036 | 1.017 |
| 800 L | 1.026 | 1.014 |
| 1500 L | 1.028 | 1.013 |
| 100 C | 1.068 | 1.058 |
| 100 B | 1.029 | 1.028 |
| 100 M | 1.036 | 1.036 |
| 200 E | 1.035 | 1.033 |

- **estimativa** para o gerador: PL = PC × fator.
  - Livres/mariposa/estilos: 1.02–1.04.
  - Costas: 1.04–1.07. As viragens e os 15 m submersos valem mais em PC.
  - Bruços: 1.02–1.03. A viragem de bruços dá menos ganho.
  - Nadadores jovens ou mais lentos: fatores mais altos (+0.5 a +1 pp), porque tiram menos partido das viragens. É raciocínio, não está medido.
- O padrão por estilo é coerente com o argumento do fórum USMS sobre viragens abertas e fechadas (https://community.usms.org/swimming/f/general/5123/are-conversion-charts-accurate). ⚠ É fórum, não fonte científica.

### 2.2 Razões entre distâncias (livres, PL, recordes mundiais) [D]

| Razão | H | M |
|---|---|---|
| 50/100 | 0.451 | 0.457 |
| 200/100 | 2.198 | 2.170 |
| 400/200 | 2.156 | 2.087 |
| 800/400 | 2.055 | 2.067 |
| 1500/400 | 3.958 | 3.931 |

Expoente de Riegel `T2 = T1 × (D2/D1)^k` [D] a partir dos recordes mundiais:
- k(100→1500) = 1.083 (H) e 1.063 (M).
- k(200→400) = 1.109 (H) e 1.061 (M).
- k(400→1500) = 1.041 (H) e 1.036 (M).

**estimativa**: k ≈ 1.04–1.11 para a elite. Os nadadores de base têm tipicamente k mais alto: são relativamente mais lentos nas distâncias longas por falta de resistência específica, ou mais baixo se forem fundistas. Não há fonte verificada para esta parte. O produto deve **ajustar k por atleta** e não fixá-lo.

### 2.3 Velocidade crítica (CS / CSS)

- Wakayoshi et al. (1992), *Int J Sports Med* 13:367–371 [A] (https://pubmed.ncbi.nlm.nih.gov/1521952/; https://coachsci.sdsu.edu/csa/vol42/wakayosh.htm):
  - CS em piscina vs velocidade dos 400 m: r = 0.998.
  - V-OBLA (4 mmol/L) vs CS: r = 0.898.
  - n pequeno: 8 nadadores, ou 9 noutras fontes ⚠.
- Wakayoshi et al. (1993), *Eur J Appl Physiol* [A]: CS pelo declive 200/400 m.
- Dekerle et al. [A] (https://coachsci.sdsu.edu:443/swim/training/dekerle.htm): CS de 200/400 com correção de **−1.4 %** aproxima a velocidade a 4 mmol/L.
- Zacca & Castro (2010) [A] (https://coachsci.sdsu.edu/swim/physiol/zacca.htm): o modelo 200–400 **sobrestima a velocidade dos 1500 m em 3.5 %**, e a CS depende das distâncias escolhidas.
- Scott, Burden & Dekerle (2023) [A] (https://pmc.ncbi.nlm.nih.gov/articles/PMC10875687/): o teste 200/400 é fiável nos 4 estilos. CV < 2 % e erro típico da CS ≤ 0.04 m/s.

Fórmula: `CSS (m/s) = (400 − 200) / (T400 − T200)`. Ritmo: `CSS (s/100 m) = (T400 − T200) / 2`.

### 2.4 Diferencial de parciais (1.º vs 2.º 50)

**100 livres**
- Robertson (2009), ⚠ citado num blogue (https://www.yourswimlog.com/how-to-pace-the-100-freestyle/), não lido no original.
  - Mais de 3000 provas internacionais.
  - O 2.º 50 é mais lento em **2.06 s (H)** e **1.95 s (M)**.
- O mesmo blogue dá Paris 2024 (finalistas): 2.07 s (H) e 1.99 s (M). Exemplo: Pan 22.28/24.12.
- [D]: 2.06/47.6 ≈ **+9 % do 2.º 50 face ao 1.º** na elite.

**200 livres**
- Oliveira et al. (2023), *Motricidade* 19(1):93–98 [A] (https://revistas.rcaap.pt/motricidade/article/view/27905). Finalistas de 6 Mundiais e 3 Jogos Olímpicos em PL.
  - O 1.º 50 é o mais diferente, por causa da partida.
  - A diferença entre os 50 seguintes é pequena.
  - Os vencedores são mais rápidos do que a mediana na 2.ª metade.
- Revisão sistemática de pacing (*Sports Med* 2018, 48(7)) [A] (https://researchprofiles.canberra.edu.au/en/publications/pacing-in-swimming-a-systematic-review/):
  - Nas distâncias curtas e médias o crítico é **manter a velocidade**.
  - Os perfis dos seniores são estáveis entre provas.
  - Recomenda individualizar.
- McGibbon et al. (2020, estafetas) [A]: um 1.º 50 demasiado rápido custa 0.5–0.9 s nos 200.

**Outros estilos: estimativa** (não há fonte verificada com números por estilo). Diferença de tempo do 2.º 50 face ao 1.º no 100:
- Livres: +6 a +10 %.
- Costas: +4 a +8 %. A partida dentro de água ganha menos ao 1.º 50.
- Mariposa: +8 a +12 %. É o estilo com maior quebra de velocidade final (Marinho 2020: o final dos 5 m é o que mais difere entre 100 e 200).
- Bruços: +6 a +10 %.

200 em 4×50, em % do tempo total (**estimativa**):
- 1.º 50: 23.5–24.5 %.
- 2.º e 3.º 50: 25.0–25.8 % cada.
- 4.º 50: 25.0–26.0 %.
- Nadadores jovens tendem a perfis mais "positivos" (não verificado).

---

## 3. Estrutura de prova

- **Partida e viragem, 100 m de elite** (Europeus 2016, 64 finalistas) [A]: Morais et al. (2019), https://bibliotecadigital.ipb.pt/entities/publication/036dab18-262b-4ba8-beb4-d0b1c2d3822c/full
  - Partida mais rápida: mariposa H 5.71 ± 0.14 s e livres M 6.68 ± 0.28 s.
  - Viragem mais rápida em livres: H 9.55 ± 0.13 s e M 10.78 ± 0.28 s.
  - Partida + viragem em livres: H 15.40 s e M 17.45 s, **cerca de 1/3 do tempo total**.
  - ⚠ As definições exatas dos segmentos (por exemplo, 15 m de saída, 5 m de entrada + 10 m de saída) não foram confirmadas no texto integral.
- Marinho et al. (2020), *JSSM* 19:397 [A] (https://www.jssm.org/jssm-19-397.xml-Fulltext): o tempo aos 15 m depende sobretudo da estratégia subaquática.
- Europeus juniores 2021 [A]: o tempo aos 15 m e a velocidade final são preditores nos 50 e nos 100 livres.
- **Referência principal [V]**: Born et al. (2022), *Front Sports Act Living*, doi 10.3389/fspor.2022.894066 (https://pmc.ncbi.nlm.nih.gov/articles/PMC9231649/).
  - Finalistas dos Europeus 2021 em PL.
  - Partida = sinal → cabeça aos 15 m. Viragem = 5 m de entrada + 10 m de saída (definição do artigo).
  - SR em ciclos/min. DPS em m/ciclo.

| Prova | Partida 15 m (s) H / M | Viragem (s) H / M | SR (ciclos/min) H / M | DPS (m/ciclo) H / M | Tempo médio H / M |
|---|---|---|---|---|---|
| 50 L | 5.31 / 6.01 | — | 61.9 / 60.2 | 2.05 / 1.91 | 21.85 / 24.34 |
| 100 L | 5.55 / 6.25 | 9.51 / 10.62 | 50.9 / 49.1 | 2.34 / 2.17 | 47.89 / 53.55 |
| 100 C | 6.20 / 7.09 | 10.15 / 11.48 | 49.7 / 48.1 | 2.15 / 1.97 | 53.07 / 59.59 |
| 100 B | 6.43 / 7.55 | 11.77 / 13.37 | 55.2 / 48.6 | 1.75 / 1.79 | 58.80 / 66.32 |
| 100 M | 5.53 / 6.33 | 10.39 / 11.63 | 56.1 / 56.4 | 1.98 / 1.74 | 51.17 / 57.84 |

- Morais et al. (2018), citado em Marinho 2020 [A]: distância de *water break* na partida dos 100 m.
  - Livres: H 7.76 m / M 6.61 m.
  - Costas: H 11.02 m / M 10.61 m.
- Marinho et al. (2020) [V], definições:
  - Tempo de bloco = sinal → pés saem do bloco.
  - Viragem total = dos 45 m aos 15 m seguintes. É **outra definição**: não comparar com Born sem converter.
  - Os 15 m de partida valem cerca de **11–12 % do tempo** nos 100.
  - Nos 200 a viragem é 4.5–12.3 % mais lenta do que nos 100. A mariposa é a que mais perde.
- **Tempo de reação/bloco**:
  - Nenhum valor verificado em artigo nesta sessão.
  - Blogue ⚠: 0.60–0.75 s na elite (https://www.yourswimlog.com/?p=45015). O valor do placard é tempo de **bloco**, não reação neuromuscular.
  - **estimativa**: elite 0.60–0.70 s; nacional 0.65–0.80 s; jovens 0.70–0.90 s.
- **SR/DPS ao nível nacional: estimativa**. Não há fonte com números verificados.
  - Kjendlie et al. (2006) [A] (https://bms.sport-iat.de/bms/Record/4037380) compara nacionais juniores com internacionais, mas não temos os valores.
  - Chollet (sumário SDSU, ⚠) (https://coachsci.sdsu.edu/swim/biomechs/chollet.htm): o **DPS é o melhor preditor da velocidade** e os melhores mantêm-no.
  - Proposta para nível nacional absoluto: SR semelhante à elite (±10 %) e DPS cerca de 8–15 % menor.
  - 100 L H: SR 46–52, DPS 1.95–2.15. 100 L M: SR 45–50, DPS 1.80–2.00.
  - Raciocínio: v = SR·DPS/60, e a velocidade nacional é ~8–12 % menor (por exemplo, 53.5 s vs 47.9 s no 100 L H).
- **SWOLF** = tempo (s) de um comprimento + número de braçadas nesse comprimento.
  - É uma métrica de relógios (Garmin/Apple). Não tem validação científica forte.
  - Depende da envergadura e do comprimento da piscina. ⚠ Usar só para comparações intra-atleta.
- **Velocidade média** [D]: `v = distância / tempo`. Exemplos:
  - Recorde mundial dos 100 L H: 100/46.40 = 2.16 m/s.
  - Recorde mundial dos 1500 L H: 1500/870.67 = 1.72 m/s.

---

## 4. Treino

### 4.1 Zonas de intensidade relativas a CSS

- ⚠ Não existe uma norma científica única. As zonas abaixo são uma **estimativa** que reconcilia a nomenclatura de clubes (A1/A2/A3, limiar, VO2/PA, tolerância láctica, velocidade) com a evidência de §2.3.
- A ancoragem é esta: a CS de 200/400 está ~1.4 % acima da velocidade a 4 mmol/L e ~3.5 % acima do ritmo dos 1500 m (Dekerle; Zacca & Castro).
- Δ = segundos por 100 m somados ao ritmo CSS. Os valores em % são de velocidade relativa à CS.

| Zona | Objetivo | Ritmo vs CSS (estimativa) | % vel. CS |
|---|---|---|---|
| A1 (recuperação/aeróbia ligeira) | volume e recuperação | CSS + 8 a +15 s | ≤ 88–92 % |
| A2 (aeróbia média) | base aeróbia | CSS + 4 a +8 s | 92–95 % |
| A3 / EN (limiar) | limiar láctico | CSS + 1 a +3 s | 96–99 % |
| CSS / MLSS | ≈ estado estável máximo | CSS ± 1 s | 99–101 % |
| VO2 / PA (potência aeróbia) | VO2max | CSS − 2 a −5 s (≈ ritmo 200–400) | 102–106 % |
| Tolerância láctica | glicolítica | ≈ ritmo 100–200 de prova | 106–112 % |
| Velocidade / MAX | alática | ≤ 25 m, máximo | > 112 % |

Raciocínio: num CSS de 70 s/100 m, +5 s equivale a ~93 % de velocidade. Os intervalos sobrepõem-se de propósito.

**CONVENÇÃO DO PRODUTO (decisão registada)**
- As zonas ancoram na **CSS 200/400**: `CSS_s100 = (T400 − T200)/2`, sem correção.
- Todos os offsets são **somados** ao ritmo CSS, em s/100 m (valores positivos = mais lento).
- Justificação:
  - É o teste mais fiável (Scott 2023: CV < 2 %).
  - É o mesmo protocolo usado por TrainingPeaks e Swim Smooth.
  - A correção para a velocidade a 4 mmol/L (−1.4 %, Dekerle) fica **embutida nos offsets** e não muda a âncora.

Offsets oficiais do gerador (**estimativa**), a partir da tabela acima:

| Zona | Offset s/100 m vs CSS |
|---|---|
| A1 | +8 a +15 |
| A2 | +4 a +8 |
| A3/EN (limiar ~4 mmol) | +1 a +3 |
| CSS | −1 a +1 |
| VO2/PA | −2 a −5 |
| Tolerância láctica | −5 a −10 (≈ ritmo de prova 100–200) |
| Sprint | máximo, sem offset |

- Os offsets fixos em segundos ficam distorcidos para CSS muito lentas, como em iniciação. Por isso o gerador deve converter em % para CSS acima de 90 s/100: offset_s = %·CSS.

**Protocolos de teste**
- **CSS 400/200**: aquecimento; 400 m máximos; 5–10 min de recuperação; 200 m máximos.
  - Fórmula em §2.3.
  - Fiável nos 4 estilos (Scott, Burden & Dekerle 2023 [A]).
  - Sobrestima a velocidade dos 1500 em ~3.5 % (Zacca 2010 [A]).
- **T-30**: 30 min contínuos ao máximo; ritmo médio ≈ limiar funcional.
  - TrainingPeaks [A] (https://www.trainingpeaks.com/learn/articles/calculating-swimming-tss-score/) prefere 60 min. Em alternativa, estima o ritmo de 60 min = ritmo de 30 min **+2.5 %**.
  - ⚠ A origem académica (Olbrecht) não foi verificada.
  - **estimativa**: ritmo T-30 ≈ CSS +1 a +3 s/100.
- **7×200 progressivo** (protocolo AIS; Pyne et al.):
  - 7×200 com saída a cada 5 min, de fácil a máximo, com lactato e FC no fim de cada 200.
  - Dá a curva lactato–velocidade (limiares a 2 e 4 mmol/L).
  - ⚠ A referência primária não foi lida nesta sessão. Exige lactímetro, o que é pouco prático para a maioria dos clubes. O produto deve aceitar o input mas não o exigir.

### 4.2 Volumes e periodização

**Fontes [A]**
- Modelo LTAD da ASA (Inglaterra), via Leeds Beckett (https://eprints.leedsbeckett.ac.uk/id/eprint/913/1/Interpreting_and_Implementing_the_Long_Term_Athlete_Development_Model1.pdf):
  - Fase de aprendizagem: 8–16 km/semana.
  - *Training to train* (~11–14 anos M, ~12–15 anos H): **24–32 km/semana**.
  - Fases seguintes: **≥ 44 km/semana**, conforme a especialidade.
  - ⚠ É um documento antigo, interpretado; confirmar no pathway atual da Swim England.
- Vorontsov (sumário SDSU) [A] (https://coachsci.sdsu.edu/swim/bullets/voront16.htm): no último ano da fase de treino de base, **1000–1200 km/ano (rapazes)** e **1200–1400 km/ano (raparigas)**. [D]: cerca de 22–30 km/semana em ~46 semanas.

**estimativa** para os escalões portugueses, ancorada nas fontes acima:
- Infantis: 10–25 km/semana.
- Juvenis: 25–45 km/semana.
- Juniores: 35–60 km/semana.
- Seniores nacionais: 40–70 km/semana.
- Elite: 50–90 km/semana, com fundistas no topo da faixa.
- Pico no período geral/específico; redução no polimento.
- Periodização típica: 2–3 macrociclos por época, orientados para Inverno (PC) e Verão (PL). É coerente com o calendário FPN: Nacionais de Absolutos em PL em março/abril e Infantis em julho (§1.4).

### 4.3 Polimento (taper)

- Bosquet, Montpetit, Arvisais & Mujika (2007), *Med Sci Sports Exerc* 39:1358–65, PMID 17762369 [A] (https://pubmed.ncbi.nlm.nih.gov/17762369/). Meta-análise de 27 estudos.
  - Ótimo: **cerca de 2 semanas**.
  - Redução de volume de **41–60 %**, progressiva ou exponencial.
  - Intensidade e frequência **mantidas**.
- Revisão de natação [A]: polimento de 14–28 dias, com volume −40 a −70 % e intensidade/frequência mantidas. Fonte: https://researchprofiles.canberra.edu.au/en/publications/swimming-performance-changes-during-the-final-3-weeks-of-training/ e textos associados.
- Melhoria esperada:
  - Pyne et al. (2004) [A]: ~1.2 % das eliminatórias à final dentro da competição.
  - Mujika, Padilla & Pyne (2002), *Int J Sports Med* 23:582–587 [A] (https://thieme-connect.de/products/all/doi/10.1055/s-2002-35526):
    - 99 provas olímpicas.
    - Melhoria de **2.18 ± 1.50 %** (amplitude −1.14 a +6.02 %): **H 2.57 %, M 1.78 %**.
    - 91 em 99 melhoraram.
    - ⚠ Crítica posterior [A] (https://sponet.de/sponet/Record/3038992): a prova pré-polimento (Melbourne) não era de máximo esforço, pelo que o ganho pode estar inflacionado.
  - Pyne & Mujika (revisão) [A]: o efeito típico de um polimento eficaz vai de 0.3 a 5 %.
  - **estimativa** para o gerador: 1–3 %, com mediana ~2 %.
  - Mujika & Padilla (2003) não foi verificado diretamente; só aparece como referência de enquadramento.

### 4.4 Variabilidade (o "ruído" a não sobreinterpretar)

- Pyne, Trewin & Hopkins (2004) [A]: CV intra-nadador de **0.60 % (IC95 0.56–0.65) dentro da competição** e **0.80 % (0.73–0.86) entre competições** (olímpicos; 676 provas, 51 nadadores).
  - O artigo conclui que um ganho extra de ~0.4 % (≈ metade do CV) melhora substancialmente as hipóteses de medalha. O "menor efeito relevante" no sentido de Hopkins é 0.3 × CV ≈ **0.25 %** (Hopkins, Hawley & Burke 1999, *Med Sci Sports Exerc* 31:472 [A]). Não confundir os dois.
- Trewin, Hopkins & Pyne (2004) [A]: CV de 0.8 % (rankings, 407 nadadores).
- Nadadores paralímpicos: CV de 1.2–3.7 % [A].
- **estimativa** para jovens e nível regional: 1.0–2.0 %. Faltam dados verificados, mas é coerente com a maior variabilidade em populações menos homogéneas.

---

## 5. Monitorização

- **Banister (impulse-response, fitness–fatigue)**:
  - `p(t) = p0 + k1·Σ w(s)e^{-(t-s)/τ1} − k2·Σ w(s)e^{-(t-s)/τ2}`.
  - Aplicado a nadadores por Mujika et al. (1996), *Modeled responses to training and taper in competitive swimmers* [A] (https://ekoizpen-zientifikoa.ehu.eus/documentos/6145ad5365b6b477913b5cd2?lang=en).
  - ⚠ Os τ1/τ2 típicos (~40 d / ~10 d), muitas vezes citados, não foram verificados aqui.
  - Os parâmetros são individuais e instáveis, e são precisos muitos testes de desempenho para os ajustar. O CTL/ATL do TrainingPeaks é uma versão simplificada (k1 = k2, τ fixos).
- **Foster session-RPE**:
  - Carga = RPE (CR-10) × duração (min) (Foster et al. 2001).
  - Validade e fiabilidade confirmadas em vários desportos (revisão de Haddad et al. 2017, *Front Neurosci*) [A] (https://www.frontiersin.org/articles/10.3389/fnins.2017.00612/full).
  - Monotonia = **média** diária semanal / **DP** diário. Strain = carga semanal × monotonia (Foster 1998, *Med Sci Sports Exerc* 30:1164–1168) [A].
  - ⚠ Há fontes secundárias que definem mal a monotonia (como DP).
  - ⚠ O limiar "monotonia > 2.0" é muito citado mas **não foi verificado** no original.
- **Bem-estar subjetivo**: Saw, Main & Gastin (2016), *BJSM* 50:281–291 [A] (https://bjsm.bmj.com/content/50/5/281.short).
  - 56 estudos.
  - As medidas subjetivas refletem a carga aguda e crónica com **maior sensibilidade e consistência** do que as objetivas (marcadores sanguíneos, FC, etc.).
  - Subjetivas e objetivas correlacionam-se pouco entre si.
  - Pesquisa até 2014; não avalia a previsão de lesão.
- **Wearables (HRV/"recovery")**: estudo da Penn State com nadadores NCAA D1 (2024), ⚠ via imprensa (https://trainright.com/new-study-reveals-holes-in-wearable-device-scores/).
  - A HRV do Whoop acompanhou o stress.
  - Os scores proprietários Strain/Recovery **não se relacionaram** com as medidas de laboratório nem com o questionário.
- **Sono**: não foi verificada nesta sessão nenhuma fonte específica de natação. **Lacuna.** Registar horas e qualidade subjetiva como item do questionário de bem-estar é coerente com Saw 2016.
- **ACWR**:
  - Lolli et al. (2019, *BJSM* 53:921) [A]: o acoplamento matemático gera correlação espúria (https://bjsm.bmj.com/content/53/15/921). Proposta: ACWR desacoplado.
  - Windt & Gabbett [A]: correlação espúria ~0.50 em simulação.
  - Impellizzeri et al. (2020, *J Athl Train*, parte 2) [A]: falta de enquadramento causal; a evidência não suporta usar o ACWR para decidir prevenção de lesões (https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/).
  - Réplica [A]: o efeito do acoplamento é trivial em dados reais, mas o ACWR não deve ser usado isolado.
- **Questionários de bem-estar e sono**: fontes não verificadas nesta sessão. **Lacuna.** Saw et al. (2016, *BJSM*) é a revisão a obter (medidas subjetivas vs objetivas).

| O que a evidência suporta | Folclore / evidência fraca |
|---|---|
| Polimento de ~2 semanas com −41–60 % de volume e intensidade mantida (Bosquet 2007) | Picos de forma "garantidos" com receitas fixas iguais para todos |
| Ruído de competição ~0.6–0.8 % em elite (Pyne 2004): diferenças menores são ruído | Interpretar diferenças de 0.2–0.5 % entre provas como progresso real |
| CS 200/400 fiável e correlacionada com o limiar (Wakayoshi; Dekerle; Scott 2023) | CS = MLSS exato; a CS 200/400 sobrestima o ritmo dos 1500 em ~3.5 % (Zacca) |
| session-RPE como medida simples de carga interna (uso alargado; ⚠ não verificado aqui) | ACWR como preditor de lesões ou "zona segura 0.8–1.3" (Impellizzeri 2020; Lolli 2019) |
| Progressão de elite ~1 %/ano no fim da carreira (Pyne 2004; Allen 2014) | Extrapolar progressões lineares de juvenis para adultos |
| Pico aos ~22–24 anos (Allen 2014) | Prever o nível sénior a partir do ranking aos 12–13 anos (⚠ ver literatura de talento) |
| — | SWOLF como métrica de técnica entre atletas diferentes |
| — | Banister com parâmetros por defeito, sem calibração individual |

---

## 6. Produtos concorrentes

Verificação 2026-10-12:
- **TeamUnify** redireciona para **SportsEngine Motion**, agora parte da PlayMetrics (https://www.sportsengine.com/motion/teamunify-is-now-sportsengine-motion). A página só diz "dashboard + app" para negócios de natação.
- **TrainingPeaks** [A] (https://www.trainingpeaks.com/learn/articles/calculating-swimming-tss-score/):
  - sTSS baseado no ritmo-limiar (T-30/T-60 ou CSS).
  - Conta só o tempo em movimento.
  - Usa hrTSS como alternativa.
  - Admite que não há "medidor de potência" para natação.
- **SwimTopia** (https://swimswam.com/swimtopia-the-1-platform-for-managing-summer-swim-leagues-teams-and-meets/, ⚠ conteúdo patrocinado):
  - Inscrições, voluntários, pagamentos e meets, com "top times" de liga.
  - Nas avaliações (Capterra/GetApp) os relatórios são fracos.
- **FORM** (https://www.formswim.com/):
  - Voltas, séries e intervalos automáticos, distância e tempo, FC (modelos 2/PRO), feedback em tempo real e HeadCoach (premium).
  - A página não refere SWOLF/SR/DPS.
- **SwimCloud**: página 403. **Whoop**: ver §5.
- O resto da tabela abaixo vem de conhecimento geral ⚠.

| Produto | O que mostra | Uso típico | Lacunas (para nós) |
|---|---|---|---|
| TeamUnify / SwimManager (SportsEngine) | gestão de clube, presenças, inscrições, resultados | administração | quase nada de carga/fisiologia |
| SwimCloud | resultados, rankings, recrutamento (EUA) | comparar tempos, recrutamento | centrado nos EUA; sem treino |
| SwimTopia | gestão de equipas de verão, meets | logística | sem análise de desempenho |
| TrainingPeaks | TSS/CTL/ATL (tipo Banister), planos | triatlo e natação de adultos | sTSS assenta em CSS/FTP; pouco adaptado a clubes jovens |
| Strava (natação) | volume, ritmo de relógio | social | dados de piscina pobres |
| Whoop | HRV, sono, "recovery" | atletas individuais | algoritmo proprietário; validação limitada ⚠ |
| Swim.com / FORM (óculos) | voltas, SWOLF, ritmo, FC | nadador individual | métricas sem contexto competitivo |
| Análise de prova federativa (World/European Aquatics, FPN) | partidas, viragens, parciais | seleções nacionais | não chega aos clubes; formato PDF |

Lacuna de mercado (inferência nossa): ninguém liga **mínimos federativos + pontos WA + progressão esperada por idade + carga de treino** numa vista para o treinador de clube português.

---

## Tabela para o gerador

Fontes:
- Pontos/tempos: base WA 2026 (§1.1).
- Âncoras: FPN 2024/25 (§1.4) e Paris 2024 (§1.3).
- CSS [D]: `(T400−T200)/2` com T400 e T200 no mesmo nível de pontos. Para uso prático aplicar a **estimativa** −1.4 % de correção (Dekerle) = ritmo +~1 s.

Bandas de 100 L e CSS em PL. Formato: tempo mais rápido–mais lento dentro do nível.

```yaml
pontos: {iniciacao: [0,300], regional: [300,450], nacional_jovem: [450,600],
         nacional_absoluto: [600,750], internacional: [750,870], elite: [870,1100]}
H:
  100L_s:   {iniciacao: [69.31, null], regional: [60.55, 69.31], nacional_jovem: [55.01, 60.55],
             nacional_absoluto: [51.07, 55.01], internacional: [48.60, 51.07], elite: [46.40, 48.60]}
  css_s100: {iniciacao: [88.1, null], regional: [77.0, 88.1], nacional_jovem: [69.9, 77.0],
             nacional_absoluto: [64.9, 69.9], internacional: [61.8, 64.9], elite: [59.0, 61.8]}
M:
  100L_s:   {iniciacao: [77.24, null], regional: [67.48, 77.24], nacional_jovem: [61.31, 67.48],
             nacional_absoluto: [56.91, 61.31], internacional: [54.17, 56.91], elite: [51.71, 54.17]}
  css_s100: {iniciacao: [91.1, null], regional: [79.6, 91.1], nacional_jovem: [72.3, 79.6],
             nacional_absoluto: [67.1, 72.3], internacional: [63.9, 67.1], elite: [61.0, 63.9]}
# razões de estilo vs livres (T_estilo / T_livres, mesma distância), recordes mundiais PL [D]
razao_estilo_100: {H: {costas: 1.112, brucos: 1.226, mariposa: 1.066}, M: {costas: 1.105, brucos: 1.240, mariposa: 1.056}}
razao_200E_200L: {H: 1.105, M: 1.120}
# razões de distância (livres, PL, recordes mundiais) [D]
razao_dist: {H: {"50/100": 0.451, "200/100": 2.198, "400/200": 2.156, "800/400": 2.055, "1500/400": 3.958},
             M: {"50/100": 0.457, "200/100": 2.170, "400/200": 2.087, "800/400": 2.067, "1500/400": 3.931}}
riegel_k: {estimativa: [1.04, 1.11], ajustar_por_atleta: true}
pc_para_pl: {estimativa: {livres_mariposa_estilos: [1.02, 1.04], costas: [1.04, 1.07], brucos: [1.02, 1.03]}}
ruido_cv_pct: {elite_intra_comp: 0.6, elite_entre_comp: 0.8, jovens_estimativa: [1.0, 2.0]}
taper: {dias: [10, 21], reducao_volume_pct: [41, 60], ganho_pct_estimativa: [1, 3]}
```

Notas da tabela:
- O limite "elite" mais rápido é o recorde mundial (1000 pts).
- O CSS de elite, 59.0/61.0, é **estimativa**: (T400−T200)/2 dos recordes mundiais dá 59.0 (H) e 61.0 (M) [D].
- As razões de estilo de elite **não** se aplicam a jovens. A razão de bruços varia muito entre indivíduos (**estimativa** de ±5 %).
