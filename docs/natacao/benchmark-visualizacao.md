# Ver os dados e tirar conclusões — o que os melhores fazem e o que o Aquastats passa a fazer

Pesquisa de 2026-10-12. Fontes completas, com URL por afirmação, em [`pesquisa/`](pesquisa/):
[`produtos-prova.md`](pesquisa/produtos-prova.md), [`produtos-treino.md`](pesquisa/produtos-treino.md),
[`ciencia-comunicacao.md`](pesquisa/ciencia-comunicacao.md) e [`notas-visuais.md`](pesquisa/notas-visuais.md).

**Não acessível:** schoolfish.ai (o domínio não existe no DNS) e swimanalytics.com (erro 522). Também ficaram
de fora o relatório de exemplo da SwimInsights (pede conta), o Reddit, o SwimSwam (paywall) e os perfis do
Swimcloud e da SwimRankings (verificação anti-robô).

## 1. Quem foi estudado

| Tipo | Produtos |
|---|---|
| Análise de prova | Federação Francesa (livro de análises das finais), AIS / Swimming Australia, World Aquatics / Swiss Timing, British Swimming, PRSVision, MakoSwim, Swimmetrix + OmniCoach, SwimInsights, MyRaceData, Swimcloud, Gophin |
| Treino e equipa | TritonWear, FORM, MySwimPro, Commit Swimming, Garmin, Apple, Polar, COROS, TrainingPeaks, intervals.icu, WHOOP, Oura, Swim Smooth, Phlex, Swimio, Hy-Tek / TeamUnify / SwimTopia |
| Ciência | Buchheit 2017 ("Want to see my report, coach?"), Robertson 2017 (semáforos), Hopkins (SWC, erro típico), Pyne 2004, Stewart & Hopkins 2000, Anderson 2006/2008, Hellard 2005, Saw 2015/2016, Gkatzia 2016 (texto + gráfico), van der Bles 2019/2020 (incerteza em palavras), Few 2013 e WCAG 2.2 (cor) |

## 2. O que os melhores fazem (padrões repetidos)

1. **Veredito primeiro, número depois, contexto a seguir.** Exemplos: Garmin ("Time to slow down"), Oura, o
   cartão de prova do Swimcloud e o "Find your focus" da TritonWear. Texto e gráfico juntos dão melhores
   decisões do que o gráfico sozinho (Gkatzia 2016, +44 %).
2. **Secções fixas e poucas:** "Correu bem" → "A melhorar (e porquê)" → "Para a próxima" → linha final.
   Usam-nas a OmniCoach, a SwimInsights (1–2 correções) e a MyRaceData. O Swimcloud aconselha poucas ideias
   por prova.
3. **Cada atleta comparado com o seu próprio habitual, e a referência tem nome.** Por exemplo: "face às
   últimas 4 vezes desta série" ou "face ao MP de 28/02". Fazem isto o PRSVision, o Swimcloud e a TritonWear.
   A variação normal difere entre atletas (Stewart & Hopkins 2000; Robertson 2017).
4. **Uma faixa do normal do atleta, com o valor novo como ponto** (Buchheit 2017). Mostrar cada rep, não só
   a média (Weissgerber 2015).
5. **Palavras de certeza em vez de percentagens.** "quase de certeza", "provavelmente", "igual ao habitual"
   e "ainda não dá para dizer", sempre com a razão (Hopkins 2009; van der Bles 2019/2020).
6. **Estado honesto quando faltam dados:** "Data Gathering" na TritonWear, "No Status" no Garmin, `*` na
   Polar. Nunca um número inventado.
7. **Causas como fatores que coincidem, não como diagnóstico.** O Oura assinala só o fator fora do normal e
   diz que um dia não é tendência. "Coincide com a semana de mais carga", nunca "por causa de" (Hellard 2005:
   o treino explica ~30 % do rendimento).
8. **Regularidade e queda em dois números simples:** a diferença em segundos entre a 2.ª e a 1.ª metade, e a
   amplitude entre a melhor e a pior rep (Swim Smooth, MySwimPro).
9. **Séries de controlo como objeto próprio:** a mesma série repetida, "melhor média" e novos melhores
   registos (TritonWear, Hy-Tek).
10. **Prova:** segmentos fixos e definidos (partida 0–15 m, nado, viragens, chegada; FFN/AIS), Δ ao lado de
    cada valor face a uma referência com nome, e um número de ritmo de prova (1.ª metade contra 2.ª; Mako).
11. **Três públicos, os mesmos dados:**
    - o treinador vê o detalhe técnico e a triagem da equipa;
    - o atleta vê o progresso, um ponto forte e um só foco;
    - os pais veem o progresso sem crítica técnica.

    Fazem isto a SwimInsights, a Mako, a TritonWear e o Gophin. Para jovens: progresso e MP primeiro,
    sem rankings entre colegas (Smith 2007; Moulds 2023).
12. **Cor acessível e nunca sozinha:** no máximo 3 estados, sempre com ícone e palavra (WCAG 1.4.1). Não usar
    vermelho/verde como único par (~8 % dos homens). O vermelho fica para alertas, não para "mais lento".
13. **Telemóvel:** um cartão de resumo por atleta com até 4 números, e o detalhe expandível (TritonWear,
    MySwimPro).

**Erros a evitar** (vistos nos produtos): médias que misturam o que não se compara, compostos opacos
("score 72"), percentagens de modelo à vista, rótulos sem o valor de base, Δ sem referência com nome,
números contraditórios no texto gerado, demasiada informação para o atleta, alarmes falsos depois de
paragens, e só a cor a dizer o resultado.

## 3. O que estava mal no Aquastats (antes desta revisão)

- **A análise estava espalhada por 5 sítios com estilos diferentes:** Treino ("Como correu o treino?"),
  Análise › Treino › Sessão, Análise › Treino › Modelo, Atleta (perfil e Carga) e Análise › Prova.
- **Dois formatos de tempo** (`01'06"42` e `1:06,4`) e decimais com ponto em alguns sítios.
- **"Análise › Treino › Modelo" era um painel de cientista de dados:**
  - médias que misturam reps MAX com A1 ("tempo médio 1:06,42", "consistência ±11 s");
  - histograma "reps por 0,1 s";
  - efeitos do modelo em % ("Terças +0,1 %").
- **Sem "o que correu bem":** só desvios, e com cores verde/âmbar/vermelho sem ícone nem palavra.
- **Frases sem grau de certeza:** uma série "mais lenta" por 0,4 s soava tão firme como uma queda de 3 s.
- **O atleta via o mesmo que o treinador, ou menos:** "melhor tempo" de reps misturadas, e nenhuma leitura do
  seu treino.

## 4. Decisões para o Aquastats

| # | Regra | Fonte |
|---|---|---|
| D1 | Cada vista abre com **uma frase-veredito**; depois "Correu bem" e "A melhorar", **no máximo 3 pontos**; depois a evidência (tabela ou pontos). | Buchheit 2017; OmniCoach; SwimInsights; Garmin |
| D2 | **Escala de certeza única** (§5): ▲ mais rápido / ✓ no tempo / ▼ mais lento, com "provavelmente" ou "quase de certeza"; "ainda não dá para dizer" com a razão. | Hopkins 2009; van der Bles 2019 |
| D3 | **Referência sempre com nome e janela:** "devia fazer: mediana das tuas reps destas séries nas últimas 6 semanas", "MP de 28/02/2026". | PRSVision; Swimcloud; Apple (crítica) |
| D4 | **Causas como "coincide com"**, só fatores fora do normal do atleta, e "uma sessão não é tendência". | Oura; Hellard 2005 |
| D5 | **Cada série em dois números:** "regularidade x s" (melhor–pior) e "no fim y s mais lento" (último terço vs primeiro, sem a rep 1, para que uma quebra no fim de uma série longa não se dilua), mais uma fila de pontos com a faixa do normal. | Swim Smooth; Buchheit 2017 |
| D6 | **Cores com significado fixo:** azul ▲ mais rápido, verde ✓ no tempo, laranja-escuro ▼ mais lento, cinzento ● igual ao habitual, contorno ○ incerto. Sempre ícone + palavra. Vermelho só para alertas. | Few 2013; WCAG 1.4.1; Okabe–Ito |
| D7 | **Um só formato de tempo:** `1:06,42` em provas (centésimas) e `1:06,4` em treino (décimas), com vírgula. | Buchheit 2017 (sem decimais a mais) |
| D8 | **Vista do atleta:** um ponto forte, um foco, comparação só consigo, linguagem de progresso ("2.º melhor de sempre"). | SwimInsights; Smith 2007; Moulds 2023 |
| D9 | **Prova:** cabeçalho com tempo, MP ou não, Δ ao MP com nome; Δ por parcial ao lado de cada valor; número de ritmo (1.ª contra 2.ª metade); depois o polimento e o contexto. | PRSVision; Mako; FFN |
| D10 | **Sem dados suficientes, diz-se:** "precisamos de 3 vezes desta série para comparar". | TritonWear; Garmin; Polar |
| D11 | **Evolução por tipo de série,** não médias misturadas: "Está a melhorar nos 100 A2?". As últimas 2 semanas contra as 6 anteriores; cada sessão um ponto sobre a faixa do habitual; só se mostra o que entra na comparação. | TritonWear; Hy-Tek |

## 5. Regras estatísticas (um atleta)

- **Erro típico (TE):** o desvio-padrão das reps do atleta na mesma série (piscina, estilo, distância, zona,
  material, descanso) nas últimas 6 semanas. O mínimo é 0,8 % do tempo, como prior de treino (Pyne 2004;
  Anderson 2006). Com menos de 5 reps de histórico usa-se 1,5 %.
- **Mudança que importa (SWC):** 0,3 × TE (Hopkins 2004/2009).
- **Ruído da comparação:**
  - média de m reps contra a mediana de n reps: σ = TE·√(1/m + 1/n);
  - como as reps de uma série não são independentes, m é limitado a 4.
- **Rótulos de certeza** (d = diferença; os números nunca se mostram):
  - "quase de certeza": |d| ≥ SWC + 1,645·σ;
  - "provavelmente": |d| ≥ SWC + 0,674·σ;
  - "igual ao habitual": |d| ≤ σ/2 (com |d| ≤ σ deixava de existir a zona "ainda não dá para dizer" quando há pouco histórico);
  - "ainda não dá para dizer": os restantes casos, ou menos de 3 reps de histórico.
- **Uma rep isolada** compara-se com a faixa do normal: dentro de ±TE é "no tempo".
- **Carga e bem-estar** usam "acima/abaixo do habitual" pelo z face às 4 semanas anteriores, sem "melhor/pior":
  - |z| ≥ 1 → "acima/abaixo do habitual";
  - |z| ≥ 2 → "muito acima/abaixo do habitual".

Implementação: `apps/web/src/lib/coach-verdict.ts`, com testes.

## 6. Ecrãs depois desta revisão

- **Treino › "Como correu o treino?"** (treinador):
  - fichas de atleta com o ícone do veredito do dia;
  - frase-veredito e "Correu bem" / "A melhorar";
  - por série: um cartão com média contra o devido, regularidade, 2.ª metade e uma fila de pontos com a faixa
    do normal;
  - as reps (Fez / Previsto / Devia / Dif.) ficam em "ver reps".
- **Análise › Treino:**
  - "Sessão" usa o mesmo cartão de série;
  - "Modelo" passa a **"Evolução"**: por tipo de série, a média de cada sessão contra a faixa do habitual das
    6 semanas antes das últimas 2, com veredito;
  - os efeitos do modelo em % saíram: não tinham margem de incerteza para os dizer com segurança;
  - as paragens mantêm-se em frases.
- **Atleta › resumo:** três cartões com estado numa palavra:
  - **Treino**: evolução por tipo de série (últimas 2 semanas vs as 6 anteriores);
  - **Carga e cansaço**: km, esforço e sono face ao habitual;
  - **Provas**: último resultado contra o MP.
- **Prova › "Porque correu assim?":** cabeçalho com Δ ao MP com nome, parciais com Δ (= abaixo de 0,1 s),
  ritmo de prova num número, polimento (o alerta de pouco trabalho rápido olha para a proporção, não para os
  metros), últimos treinos e contexto; "Correu bem" / "A melhorar".
- **Atleta (app do nadador):**
  - "O meu último treino" com um ponto forte e um foco;
  - "Os meus tempos" com a série principal de cada treino, não o "melhor" misturado;
  - a prova na versão do atleta (sem crítica do polimento).
