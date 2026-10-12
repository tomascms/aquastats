# Protocolo de avaliação (pré-registado)

Fixado em 2026-10-05, **antes** de correr qualquer modelo novo no gerador v2. Não muda depois de
ver resultados; se alguma coisa tiver de mudar, a alteração fica registada no fim deste ficheiro com
data e motivo, e os resultados anteriores são repetidos.

## 1. Dados

- **Sintéticos** (`apps/web/src/lib/ml/synthetic.ts`, v2): todos os IDs começam por `syn-`,
  reprodutíveis pela semente, só com campos que o site pede (treinos, séries, tempos, atletas com
  data de nascimento/sexo/grupo, bem-estar, provas). Nunca misturados com dados reais.
- **Reais**: só leitura, relatados à parte, nunca agregados com sintéticos.
- Avaliação sobre reps **plausíveis** (`isPlausibleRep`, como na app). Métrica principal sobre reps
  **limpas** (sem erro de digitação injetado); as métricas com erros incluídos são relatadas ao lado.

## 2. Matriz de cenários

Cenários base (estrutura temporal):

| Cenário | Descrição |
|---|---|
| `arranque` | 6 semanas a meio da época (equipa começa a usar a app) |
| `esparso` | 12 semanas, poucos treinos e poucos tempos |
| `tipico` | 26 semanas desde o regresso de setembro |
| `denso` | 40 semanas, muitos treinos e tempos |
| `multiano` | 4 épocas com férias de agosto, crescimento por idade, entradas e saídas de atletas |
| `regresso-curta` / `regresso-longa` / `regresso-tardia` | 1 época + pausa de agosto de 3 / 7 semanas + 12 semanas de regresso; na `tardia`, ~40 % dos atletas regressam 3–5 semanas depois |

Fatores (cruzados com os cenários base):

- **dados**: `completos` (todas as séries cronometradas, todas as sessões registadas, bem-estar
  diário) vs `em-falta` (falta realista e informativa: cronometra-se mais o ritmo de prova do que o
  aeróbio, sessões sem tempos, sessões não registadas, reps falhadas, bem-estar esporádico e mais
  provável em dias maus, atletas ausentes listados por engano).
- **metros**: `baixo` (×0,7 sessões e volume), `base`, `alto` (×1,3).
- **contexto**: `nenhum` (só as séries cronometradas são introduzidas; sem bem-estar), `basico`
  (todas as séries principais, sem aquecimento/retorno à calma), `carga` (treino completo),
  `bem-estar` (treino completo + sono/ginásio/recuperação).

Erros de digitação (+1 minuto, dígitos trocados, parcial em vez de final, tempos trocados entre
atletas) existem em todas as células.

**Células de decisão** (as únicas que decidem manter/descartar): os 4 cenários base `arranque`,
`esparso`, `tipico`, `denso` com a variante por omissão `em-falta / base / carga`.

## 3. Horizontes

Cada rep é prevista uma vez por horizonte, só com dados anteriores à origem da previsão:

| Horizonte | Dados permitidos para uma rep do dia D |
|---|---|
| próxima rep | tudo até à rep anterior (inclui reps anteriores da mesma sessão e do mesmo dia) |
| dia (**principal**) | datas < D |
| semana | origens de 7 em 7 dias; reps com antecedência de 1–7 dias |
| mês | origens de 7 em 7 dias; antecedência de 22–28 dias |
| ano | origens de 7 em 7 dias; antecedência de 358–364 dias (só `multiano`) |

Nos horizontes próxima rep e dia, o contexto da própria sessão conhecido quando ela começa (o plano
da série, o turno, o bem-estar desse dia) pode ser usado; o resultado de outras reps desse dia só no
horizonte próxima rep. Nos horizontes semana/mês/ano o bem-estar do dia-alvo é desconhecido.
Para antecedências ≥ 22 dias o plano de treino ainda não é conhecido: os campos derivados da carga
planeada (metros antes, metros na semana, cansaço estimado) são substituídos pela mediana do próprio
atleta até à origem. A estrutura da rep (distância, estilo, intensidade, material, piscina, saída,
posição na série, turno) mantém-se: é a definição do que se está a prever.

## 4. Métricas

MAE (s), MAPE, mediana do erro absoluto %, viés %, cobertura e largura do intervalo, interval score
(Winkler) ao nível nominal do modelo, cobertura re-expressa a 80 % (média ± 1,2816·DP), CRPS
gaussiano (% do tempo), proporção de reps com previsão, e a **curva de erro ao longo do tempo**
(MAPE por semanas/meses de histórico do atleta). Referências sempre presentes: último valor,
mediana do grupo (só nível), modelo atual, oráculo (melhor previsão possível na véspera, conhecida
só no sintético).

## 5. Estatística

- **Sementes de ajuste**: 1–5. Hiperparâmetros e escolhas de desenho só podem olhar para estas.
- **Sementes de teste**: 1001–1015 nas células de decisão; 1001–1005 nas restantes células da
  matriz; 1001–1010 em `multiano` e `regresso-*`.
- Comparação **emparelhada** desafiante vs campeão nas **mesmas reps** (as que ambos preveem):
  Δ por semente, IC 95 % por bootstrap das sementes (10 000 reamostragens, semente fixa).

## 6. Regra de decisão

Uma melhoria só fica se, no horizonte **dia**, nas células de decisão, cumprir **todas**:

1. **R1 — MAPE**: Δ médio < 0 com limite superior do IC 95 % < 0 em pelo menos 3 de 4 cenários.
2. **R2 — sem estragos**: Δ médio de MAPE ≤ +0,05 pp em todos os 4.
3. **R3 — CRPS**: Δ médio de CRPS ≤ 0 em todos os 4.
4. **R4 — cobertura**: o erro de calibração a 80 % (|cobertura80 − 80 %|) não aumenta mais de
   1 pp em nenhum dos 4.
5. **R5 — fuga temporal**: 0 previsões alteradas ao perturbar o futuro (rolante, horizontes e
   reconstrução do ledger).

Nas restantes células e horizontes os resultados são relatados; uma regressão > +0,3 pp de MAPE
em qualquer célula é assinalada e explicada, mesmo que a melhoria fique.

Ordem dos campeões: modelo atual → vencedor de cada fase. Uma fase que não cumpra a regra pára o
trabalho dessa linha e é relatada como falhada.

## Alterações ao protocolo

1. **2026-10-05, antes de qualquer resultado da Fase 6.** Uma mudança que, por construção, não altera
   nenhuma previsão do horizonte dia (verificado: previsões idênticas em todas as células de decisão)
   não pode ser julgada pela R1, que só olha para o dia. Essas mudanças são decididas com as mesmas
   regras R1–R5 no horizonte que alteram (mês; ano quando existir), nas células onde ele é mais
   exigente: `multiano`, `regresso-curta`, `regresso-longa`, `regresso-tardia` (sementes 1001–1010),
   além de terem de deixar o horizonte dia exatamente igual nas 4 células de decisão. Motivo: a Fase 6
   (sazonalidade) só mexe em previsões feitas antes de o plano existir.

## Adenda v3 (2026-10-05, antes de qualquer resultado com o gerador v3)

Os resultados das fases 1–6 foram obtidos com o gerador 2.0 (commit `476f041`). A partir daqui
usa-se o **gerador 3.0** (atletas heterogéneos) e esta adenda junta-se às regras R1–R5, que se
mantêm para o tempo "vai fazer" no horizonte dia.

**Gerador 3.0.** Cada atleta tem velocidade crítica e reserva anaeróbia W′ próprias (8–50 m),
recuperação de W′ com constante de 30–240 s, perda de W′ com o volume da sessão de 5 % a 30 %
(por 4 km), efeitos de ginásio, sono e turno com sinal individual (positivo, nulo ou negativo) e
atraso (dia anterior / duas noites antes), precipício real quando o W′ se esgota, séries
abandonadas depois de uma quebra (reps não registadas: censura), capacidade que evolui dimensão a
dimensão (W′ com o treino anaeróbio, recuperação com o treino de descanso curto, cada uma à sua
velocidade e às vezes nada), ~20 % de atletas atípicos e várias equipas como coortes separadas.
Verdade registada por rep: tempo de capacidade ("devia"), tempo sistemático nas condições reais
("vai" sem choques), custo das condições, quebra.

**Definições operacionais** (também usadas em dados reais):
- *Quebra*: numa série, uma rep com tempo ≥ 4 % acima da mediana das reps anteriores da mesma
  série (pelo menos 2 anteriores). A série quebra na primeira dessas reps.
- *Condições de referência* ("devia" observável): 1.ª ou 2.ª rep da série, descanso ≥ 2× o tempo
  da rep, menos de 1,5 km nadados antes na sessão.

**Métricas novas** (relatadas por célula, horizonte dia):
- "devia": MAPE, viés, cobertura a 80 % e interval score contra a verdade sintética, e contra as
  reps em condições de referência (o proxy que existe em dados reais);
- custo das condições: erro absoluto médio (pp) entre o custo previsto e o verdadeiro;
- quebra: Brier score e log loss da probabilidade de a série quebrar (séries com ≥ 3 reps
  registadas), erro absoluto na rep em que quebra; referência = taxa de quebra da equipa até à véspera;
- recuperação de parâmetros: correlação de Spearman entre o parâmetro estimado e o verdadeiro
  (W′, recuperação, sensibilidade ao volume, efeitos de ginásio/sono) e acerto de sinal;
- erro por tipo de atleta (típico vs atípico);
- observações até o modelo individual bater o prior do grupo, por tipo de atleta.

**Regras novas:**
- **R6 — atípicos**: uma mudança que melhore o global mas piore o MAPE dos atletas atípicos em
  mais de 0,10 pp (média nas células de decisão) não fica.
- **R7 — heterogeneidade antes de rejeitar**: um componente que falhe R1–R5 é testado atleta a
  atleta (Δ por atleta com IC por bootstrap dos dias; teste Q de Cochran). Se p < 0,05 e ≥ 20 % dos
  atletas melhorarem com IC < 0, avalia-se uma versão *por atleta* (o componente só atua num atleta
  quando a evidência desse atleta exclui zero a 90 %), que tem de passar R1–R6 para ficar.
- **R8 — componentes do "devia"/quebra**: ficam se baterem a referência correspondente (fronteira
  = quantil 20 % das reps comparáveis das últimas 8 semanas, para o "devia"; taxa de quebra da
  equipa, para a quebra) com IC < 0 em ≥ 3 de 4 células de decisão, com cobertura do "devia" entre
  75 % e 85 %, e sem piorar o "vai" (R2–R5).

Sementes: as mesmas (ajuste 1–5; teste 1001–1015 nas células de decisão, 1001–1010 nas restantes).

## Adenda final (2026-10-05, antes de qualquer resultado da fase final)

Pré-registo completo em [`experiments.md`](experiments.md) §2. Em resumo:

- **Três conjuntos de sementes** novos: desenvolvimento 3001–3015 (decide cada experiência),
  confirmação 4001–4015 (uma única vez, no modelo final combinado) e 2001–2015 (só a tentativa
  única da fadiga). As sementes 1001–1015 já foram usadas para decidir e passam a servir só para
  desenho, como as de ajuste.
- **Gerador congelado** na versão 3.0 durante a fase final.
- **R9 — comparações múltiplas**: além de R1–R8, o ΔMAPE agregado das 4 células de decisão tem de
  ter o limite superior unilateral a 99,67 % (Bonferroni sobre 15 experiências) abaixo de 0.
- **R10 — paridade**: nenhum subgrupo (sexo, escalão, estilo principal) com ≥ 200 reps piora mais
  de 0,10 pp nem perde mais de 2 pp de calibração.
- **Paragem**: dois pacotes seguidos sem experiência aceite, ou 15 experiências gastas → congelar
  v1.0 → confirmação única → entrega.

## Adenda gerador 4.0 — realismo para o treinador (2026-10-12, antes de qualquer código ou resultado)

Motivo: críticas do treinador aos dados sintéticos (tempos irrealistas, reps por cronometrar,
produto centrado no modelo). O pedido chama-lhe "gerador v2"; no repositório é o **gerador 4.0**.

**Regra de independência.** Os parâmetros do gerador 4.0 vêm só de
[`../natacao/referencias.md`](../natacao/referencias.md). O gerador é congelado (commit registado
em `../natacao/gerador.md`) **antes** de o modelo correr nele. Depois de ver resultados do modelo,
nenhum parâmetro do gerador muda por causa desses resultados; um erro de realismo detetado depois
é corrigido, registado aqui com data, e o backtest repete-se inteiro.

**Modelo.** O v1.0 fica congelado. Nesta adenda não há experiências de modelo: só se mede o v1.0
no gerador novo. Adaptações do harness ao formato novo (sem efeito nas previsões) são permitidas
e testadas com o gerador 3.0 (previsões idênticas às de `results/confirmacao-v1.json`).

**Sementes.**
- Sintonia 6001–6005: depurar gerador e harness; nunca para relatar o modelo.
- Desenvolvimento 6101–6115: invariantes do gerador e tabelas de realismo.
- Confirmação 6201–6215: **uma única execução** do backtest v1.0 no gerador 4.0, nas 4 células de
  decisão (`arranque`, `esparso`, `tipico`, `denso`), horizonte dia. É o número que se relata.

**Critérios de sucesso do gerador** (invariantes, testes automáticos no CI, sementes 6101–6115):
- G1: 0 reps por cronometrar para atletas presentes; ausência = falta registada, sem treino parcial.
- G2: ritmo monotónico com a intensidade, por atleta e por condições iguais.
- G3: melhores tempos dentro da banda do nível do atleta (tabelas de referência).
- G4: razões 50/100/200/400 e 25 m/50 m dentro dos limites das referências.
- G5: soma dos parciais = tempo final (tolerância 0,01 s).
- G6: variação dia a dia do ritmo em condições iguais dentro do limite das referências (sem saltos).
- G7: mesma semente → dados idênticos.
- G8: distribuição por nível e sexo conforme a especificação.

**Critérios para o modelo** (relatados tal como saírem; é por eles que se decide se mudam a decisão de o ligar):
- M1: MAPE do v1.0 abaixo da referência "último valor" com IC 95 % < 0 em ≥ 3 de 4 células.
- M2: cobertura a 80 % entre 75 % e 85 % em todas as 4.
- M3: fuga temporal 0.
Se M1 ou M2 falharem, o trabalho pára e pergunta-se ao dono antes de qualquer alteração ao modelo.
O MAPE pode subir face ao gerador 3.0 (dados mais realistas e com mais níveis); isso relata-se, não se corrige.

### Registo de tentativas (gerador 4.0)

| Data | Tentativa | Resultado |
|---|---|---|
| 2026-10-12 | Níveis, razões de distância/estilo, reps todas cronometradas, faltas, parciais | G1 falhou: só o 1.º segmento de cada bloco era simulado (defeito do 3.0) → corrigido |
| 2026-10-12 | G6 | Falhou por defeito do teste (misturava estilos na mesma chave) → chave inclui o estilo |
| 2026-10-12 | Volume semanal | Elite ≈ 12 km/semana (fora das referências) → grupos de treino por nível; volume dentro das referências |
| 2026-10-12 | Destreino de agosto | Adultos ≈ 0 % mais lentos: carga de referência de Banister sobrestimada 15–30 % → calibrada para a carga efetiva medida; níveis intercalados para equipas pequenas terem adultos |
| 2026-10-12 | Modelo: propriedade "independente da ordem" falhou no gerador 4.0 | Fuga: o prior de fadiga de um atleta novo usava séries de colegas do mesmo dia (`forecaster.ts`, `fatigueFor`), proibido no horizonte dia. Corrigido como **v1.0.1** (desvio registado: é correção de fuga, não experiência); checksums dourados retirados de novo. Efeito: máx. 8·10⁻⁵ em log, ≈ 28 % das previsões do dia num cenário típico |
| 2026-10-12 | Zonas de treino (detetado pelo teste de coerência dos indicadores, antes de qualquer resultado do modelo; o backtest em curso foi interrompido sem ser lido) | Zonas eram frações da velocidade dos 1500 m, não da CSS 200/400 das referências (A2 saía ≈ CSS + 8 s, na fronteira do A1) → ancoradas na CSS; congelamento e backtest repetidos |
| 2026-10-12 | Validação no site local (perfil do atleta, antes de qualquer resultado do modelo; backtest interrompido sem ser lido) | Fundista de elite com 400 L acima do recorde mundial (1118 pontos): a banda de nível só fixava o 100 L → nível passa a fixar os pontos da prova principal da especialidade; 50/100 com razão própria; invariante G3 alargado a "nenhuma prova > 1000 pontos" |
| 2026-10-12 | G2 com as zonas na CSS | A3 mais lento que A2 num atípico: o desvio atípico do A2 passava o A3 → limitado a A3 − 0,015; velocidade crítica do W′ = 0,986 × CSS (Dekerle) ajustada à piscina; teste compara intensidades na mesma distância |
| 2026-10-12 | Validação no site (perfil do atleta; backtest interrompido sem ser lido) | Provas no taper acima da banda (velocista de elite com 962 pontos): banda passa a ser a da prova no pico (fresco = +2,5 %); velocistas sem CSS → teste CSS 400/200 em treino de 7 em 7 semanas; defeito na variante em-falta com blocos de teste corrigido |
| 2026-10-12 | Backtest de confirmação (gerador congelado 4.ª vez; substituído pela linha seguinte) | M1 ✓, M2 ✓ (79,0–79,5 %), M3 ✓; ver `modelo-atual.md` |
| 2026-10-12 | Validação no site (perfil, análise do treino) | Teste CSS em treino "quebrava" (W′ abaixo do que um 400 máximo exige) → CSS medida 7 % lenta; recuperação 1–5 sempre baixa (centrada em zero) → W′ mínimo coerente com as razões 200/400; recuperação centrada na forma habitual; invariante G9. Gerador congelado (5.ª vez) e confirmação repetida com as mesmas sementes 6201–6215 (os resultados anteriores não motivaram a mudança: vieram do ecrã) |

Gerador 4.0 congelado (4.ª vez, versão final) no commit que acrescenta esta linha, antes de qualquer resultado do modelo.

Gerador 4.0 (histórico) congelado (3.ª vez) no commit que acrescenta esta linha, antes de qualquer resultado do modelo.

Gerador 4.0 (histórico) congelado (2.ª vez) no commit que acrescenta esta linha (ver `git log -- docs/natacao/gerador.md`), antes de qualquer resultado do modelo.

