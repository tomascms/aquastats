# Registo de experiências do modelo (Aquastats)

Todas as tentativas, incluindo as falhadas. A secção **Pré-registo** foi escrita e guardada em git
**antes** de correr qualquer experiência da fase final; o **Registo** é preenchido à medida que cada
experiência corre e nunca é reescrito depois de visto o resultado.

## 1. Onde está a margem (estado de partida, gerador 3.0)

Medido em sementes que já não decidem nada (ajuste 1–5 e antigas de teste 1001–1005), campeão
atual (`modelo de estado + qualidade + conformal`, "estado 2.0") contra o oráculo (a melhor previsão
possível, conhecida só no sintético). Script: `scripts/ml-error-sources.ts`.

| Horizonte | arranque | esparso | típico | denso |
|---|---|---|---|---|
| dia — campeão / oráculo | 3,11 % / 0,96 % | 2,86 % / 0,99 % | 2,01 % / 1,01 % | 1,70 % / 1,00 % |
| próxima rep — campeão / oráculo | 1,37 % / 0,74 % | 1,35 % / 0,76 % | 1,23 % / 0,77 % | 1,16 % / 0,76 % |

Com o gerador 3.0 (atletas heterogéneos) a margem é **maior** do que os 0,35–0,45 pp do gerador
2.0: 0,7–2,2 pp no horizonte dia. Mas o oráculo conhece o perfil verdadeiro de cada atleta; uma boa
parte desta margem é a parte individual de coisas que o atleta ainda nunca fez (abaixo), que nenhum
modelo pode saber antes de as ver. A margem **alcançável** é menor e não é observável diretamente.

De onde vem o erro redutível (campeão − oráculo), horizonte **dia**, todos os cenários:

| Fonte | % das reps | Erro campeão | % do erro redutível |
|---|---|---|---|
| Tipo de rep que o atleta nunca nadou (fator ainda no prior) | 27 % | 2,79 % (vs 1,58 % conhecidas) | **55 %** |
| Primeiras 2 semanas do atleta | 6 % | 4,12 % | 21 % |
| Atletas atípicos | 19 % | 2,27 % (vs 1,83 %) | 26 % |
| Reps em que a série quebra (precipício) | 7 % | 3,00 % | 14 % |
| Intensidades MAX / P200 | 18 % | 2,81 % / 2,24 % | 28 % |

Horizonte **próxima rep**: a 1.ª rep de cada série tem 36 % do erro redutível (1,75 % vs 0,88–1,27 %
nas seguintes) e as reps com precipício 34 %. Depois da 1.ª rep o filtro já corrige a série
(*nowcasting* já existe: o efeito de sessão e o fator do tipo de rep aprendem rep a rep).

Consequência para a ordem: o pacote com mais valor esperado no horizonte que decide (dia) é **P3**
(partilha entre eventos / arranque a frio dentro do atleta), não P1.

## 2. Pré-registo da fase final

### 2.1 Sementes

| Conjunto | Células de decisão | Regimes (`multiano`, `regresso-*`) | Matriz | Uso |
|---|---|---|---|---|
| Ajuste | 1–5 | 1–3 | 1–5 | Desenho e hiperparâmetros (também 1001–1015, já vistas) |
| Desenvolvimento | **3001–3015** | 3001–3010 | 3001–3005 | Decisão de cada experiência |
| Fadiga (tentativa única) | **2001–2015** | — | — | Só a experiência E12 |
| Confirmação | **4001–4015** | 4001–4010 | — | **Uma única vez**, no modelo final combinado |

Sementes já usadas para decidir (1001–1015) nunca mais decidem nada. O gerador fica congelado na
versão **3.0** durante toda a fase (nenhuma alteração ao gerador depois de ver resultados).

### 2.2 Regras de decisão de cada experiência

Contra o campeão do momento (o atual, depois o atual + cada experiência aceite), nas sementes de
desenvolvimento, nas mesmas reps, no **horizonte de decisão** da experiência (dia, salvo indicação):

- **R1–R6** como no protocolo (R1: ΔMAPE com IC 95 % < 0 em ≥ 3 de 4 células; R2: nenhuma célula
  pior que +0,05 pp; R3: ΔCRPS ≤ 0 em todas; R4: erro de calibração a 80 % não sobe > 1 pp em
  nenhuma; R5: 0 previsões alteradas pelo teste de fuga, incluindo a reconstrução do ledger;
  R6: atípicos não pioram mais de 0,10 pp).
- **R9 — comparações múltiplas** (novo): o ΔMAPE *agregado* (média das 4 células por semente) tem
  de ter o limite superior do intervalo unilateral a 1 − 0,05/15 (= 99,67 %, Bonferroni sobre o
  orçamento de 15 experiências) abaixo de 0. Bonferroni porque as decisões são sequenciais (é o
  limiar que o Holm usa para a primeira rejeição); no fim relata-se também o Holm de todas.
- **R10 — paridade** (novo): em nenhum subgrupo (sexo; escalão por idade; especialidade = estilo
  principal) com ≥ 200 reps o ΔMAPE agregado passa +0,10 pp, nem o erro de calibração a 80 % sobe
  mais de 2 pp.
- Experiências de incerteza (P2): métrica primária **CRPS** — R1 e R9 aplicam-se ao CRPS e o MAPE
  só tem de cumprir R2.
- Experiências que por construção não mudam o horizonte dia (verificado: previsões idênticas)
  decidem-se no horizonte que mudam (adenda 1 do protocolo).
- Heterogeneidade antes de rejeitar (R7) e gating por atleta como no protocolo; a versão por
  atleta conta como **mais uma** experiência do orçamento.
- Quebra (R8) como no protocolo.
- Sem segundas tentativas: uma experiência que falhe não é afinada nas sementes de
  desenvolvimento e repetida. Afinação só nas sementes de ajuste, antes de correr em
  desenvolvimento.

### 2.3 Orçamento e critério de paragem

- **Orçamento: 15 experiências** (E1–E15 abaixo; as condicionais só gastam orçamento se correrem).
- Ordem dos pacotes de melhoria: **P3 → P1 → P2 → P4 → P5 → P7 → P8**.
- **Paragem**: dois pacotes de melhoria seguidos sem nenhuma experiência aceite, ou orçamento
  esgotado → congela-se o modelo combinado (v1.0) → corre-se a confirmação **uma vez** → entrega.
  Não se otimiza mais depois disso, passe ou não a confirmação.
- A tentativa de fadiga (E12, decidida antes) e a previsão de provas (P6, capacidade nova com
  métrica própria) correm uma vez cada, independentemente da paragem, e não contam para a regra
  dos "dois pacotes seguidos".
- "Pára se uma fase não ganhar" = uma experiência que falhe não entra no modelo e não é forçada.

### 2.4 Critério de confirmação (modelo final v1.0 vs estado 2.0, sementes 4001–4015)

- C1: ΔMAPE agregado nas 4 células de decisão, IC 95 % < 0 (um único teste).
- C2: ΔCRPS ≤ 0 em todas as células de decisão.
- C3: cobertura a 80 % entre 77 % e 83 % em cada célula de decisão, ou não pior que a do campeão.
- C4: nenhuma célula de decisão pior que +0,05 pp de MAPE.
- C5: 0 fugas (rolante, horizontes, ledger).
- C6: dados reais, só leitura: sem regressões grosseiras (> 0,3 pp de MAPE) se houver ≥ 200 reps
  cronometradas; caso contrário, "não avaliável" e dito explicitamente.
- Relatados (não decidem): próxima rep, semana, mês, regimes (4001–4010), ano, paridade.

Se falhar, o v1.0 fica mesmo assim em sombra (não muda nada para o treinador), marcado como "não
confirmado", e o campeão continua.

### 2.5 Experiências

| Id | Pacote | Hipótese | Horizonte / métrica | Aceitação | Orçamento |
|---|---|---|---|---|---|
| E1 | P3 | O expoente de Riegel muda com a distância: um expoente para ≤ 100 m e outro para > 100 m (o 2.º encolhido para o 1.º) liga melhor 50/100 aos 200/400 e à velocidade crítica | dia / MAPE | R1–R6, R9, R10 | 1 |
| E2 | P3 | O estilo principal do atleta (campo do site) é relativamente mais rápido: o fator desse estilo parte de "equipa − δ", δ aprendido dos colegas (prior 2 % ± 2 %) | dia / MAPE | idem | 1 |
| E3 | P3 | Os resultados de provas (campo do site: resultados e recordes) são observações do mesmo motor (MAX, da partida, com fato, fator "prova" aprendido): ajudam o arranque a frio de atletas novos e as reps MAX/ritmo de prova | dia / MAPE | idem | 1 |
| E4 | P1 | Resíduos autocorrelacionados dentro da série: somar ρ × (erro da rep anterior da mesma série) à previsão seguinte (ρ afinado no ajuste); ganho medido por posição na série | próxima rep / MAPE | idem no horizonte próxima rep | 1 |
| E5 | P1 | As variâncias do filtro (nível, dia AR(1), sessão, rep) foram afinadas com o gerador 2.0; re-estimadas por verosimilhança preditiva nas sementes de ajuste do gerador 3.0 melhoram dia e próxima rep | dia / MAPE (próxima rep relatado) | idem | 1 |
| E6 | P2 | Caudas pesadas: distribuição preditiva Student-t (ν afinado no ajuste) em vez de normal, com o mesmo intervalo conformal | dia / CRPS | R1, R9 em CRPS; R2–R6, R10 | 1 |
| E7 | P2 | Conformal também estratificado por semanas de histórico do atleta (atletas novos): cobertura certa por tamanho do grupo e por atleta | dia / CRPS e erro de calibração | R1, R9 em CRPS; R4 com cobertura por estrato relatada | 1 |
| E8 | P4 | Contexto individual com sinal e atraso (sono de 2 noites, ginásio na véspera, turno) melhora atletas com efeitos fortes (incluindo efeitos invertidos dos atípicos) | dia / MAPE + R7 por atleta | idem | 1 |
| E9 | P4 | Encolhimento local: quando os erros de um atleta num fator apontam sempre para o mesmo lado, a força do prior da equipa nesse fator desce (o grupo pesa menos quando a evidência individual o contradiz) | dia / MAPE, atípicos | idem | 1 |
| E10 | P4 | (Condicional) versão por atleta de uma experiência de P1–P4 que falhe a regra mas cumpra o critério da R7 | dia / MAPE | idem | 1 |
| E11 | P5 | O défice de regresso depende da duração da pausa com uma forma aprendida da equipa (em vez de fixa) e do escalão; velocidade de aprendizagem maior nas 2 primeiras semanas | dia, células de regime (3001–3010), 2 primeiras semanas | R1–R6 nas 4 células de regime; células de decisão sem piorar (R2) | 1 |
| E12 | Fadiga | Tentativa única: fadiga individual só ativa depois de ≥ N séries do atleta (N escolhido no ajuste), sem a dimensão "sensibilidade ao volume" (não identificável), probabilidade de quebra recalibrada no ajuste | dia / MAPE + quebra | R1–R6, R9, R10 e R8; se falhar, sai do produto | 1 |
| E13 | P6 | Previsão de tempos de prova a partir do estado (motor, Riegel, forma no dia da prova, fato, fator prova) com intervalo conformal | provas sintéticas / MAPE e cobertura | MAPE < referência (melhor tempo anterior + desenvolvimento esperado) com IC < 0; cobertura 80 % ± 5 pp | 1 |
| E14 | P7 | (Condicional: ≥ 2 candidatos que ganham em células diferentes e com correlação dos erros < 0,8) combinação com pesos online | dia / MAPE | idem | 1 |
| E15 | P8 | Aprendizagem ativa: sugerir o dado em falta (ou a série a cronometrar) que mais reduz a incerteza vs ao acaso, mesmo orçamento | redução de MAPE nas reps seguintes | IC < 0 | 1 |

Não se testa uma matriz atleta × evento de baixo rank genérica: no gerador 3.0 as zonas, estilos e
material de cada atleta são sorteados **independentemente**, por isso essa estrutura não tem nada
que aproveitar além do que E1–E3 já cobrem; testá-la seria gastar orçamento numa experiência que
não pode ganhar, e acrescentar correlações ao gerador para a fazer ganhar seria Goodhart. Fica
como limite documentado.

### 2.6 Hipóteses do gerador 3.0 e onde o modelo as pode estar a aproveitar (Goodhart)

| Hipótese do gerador | O modelo usa a mesma forma? | Risco |
|---|---|---|
| Tempo de uma rep = estrutura (lei de potência por troços, ≤ 100 m / > 100 m) × zona × estilo × material, multiplicativo | Sim (log-linear); E1 copia os troços | Ganho de E1 é um limite superior; na realidade a curva é mais suave |
| Zonas de treino = frações fixas da velocidade crítica, por atleta | Sim | Treinadores reais podem nadar "A2" de forma inconsistente |
| Estilo principal 2–5 % relativamente mais rápido | E2 aprende δ da equipa (prior 2 %) | Moderado |
| Ruído da rep Student-t (4–6 gl) por atleta + erro de cronometragem absoluto | E6 usa t; o filtro já tem ruído relativo + absoluto | Caudas reais podem ser diferentes |
| Forma: impulso-resposta de 3 componentes, choque diário AR(1), choque de sessão normal | O filtro tem nível + AR(1) diário + sessão | Estrutura muito parecida: o ganho do filtro é otimista |
| Défice de regresso após pausa com forma exponencial | O modelo usa uma forma parecida | Otimista nos regressos |
| W′ com precipício, recuperação exponencial | fatigue.ts usa a mesma física | Otimista (já se viu que mesmo assim não passou) |
| Provas = esforço máximo da partida com fato e −1 % de "dia de prova" | E3/E13 aprendem o fator prova (não o fixam) | Moderado; provas reais têm táticas e eliminatórias |
| Erros de digitação de 4 tipos | A deteção de suspeitos foi desenhada a olhar para estes tipos | Otimista |
| Efeitos de contexto pequenos, com sinal individual | E8 | Bem-estar raro → difícil de aprender também na realidade |

### 2.7 Robustez (engenharia, não conta para o orçamento)

Cadeia de degradação (estado → mediana → último valor → "sem estimativa", nunca NaN), determinismo
e versão do modelo; orçamento de desempenho e estado incremental por equipa (checkpoint, sem
reprocessar o histórico a cada pedido); testes por propriedades (monotonia, sem fuga, invariância a
reordenação, dados em falta e erros de digitação, sondas contrafactuais); paridade por subgrupo;
interruptor de emergência e alertas de deriva/calibração a partir do ledger; sem alegações médicas.

## 3. Registo

### Tentativas anteriores (gerador 2.0 e 3.0)

| Data | Fase | Mudança | Sementes | Resultado | Decisão |
|---|---|---|---|---|---|
| 2026-10-05 | 1 | Qualidade de dados + conformal | 1001–1015 | MAPE −0,07 a −0,26 pp; calibração −6 a −25 pp | Mantida |
| 2026-10-05 | 2 | Modelo de estado hierárquico | 1001–1015 | MAPE −0,20 a −0,36 pp | Mantida |
| 2026-10-05 | 3 | Contexto (turno, 2.º treino, sono, ginásio) | 1001–1015 | ≈ 0 | Rejeitada |
| 2026-10-05 | 4 | Banister | 1001–1015 | +0,05 pp com poucos dados | Rejeitada |
| 2026-10-05 | 5 | Ensemble online | 1001–1015 | +0,01 pp | Rejeitada |
| 2026-10-05 | 6 | Sazonalidade + âncoras | 1001–1010 (regimes) | ano 3,36 → 2,63 %; mês 2 de 4 | Rejeitada pela regra; âncoras só no ano, em sombra (decisão do utilizador) |
| 2026-10-05 | (i) | Aprendizagem ativa (que série cronometrar) | 1001–1015 | −0,16 / −0,065 pp vs acaso | Positiva |
| 2026-10-05 | v3-1 | Fadiga individual com precipício | 1001–1015 | típico/denso −0,08 pp, arranque/esparso n.s.; R1, R3 ✗ | Rejeitada |
| 2026-10-05 | v3-1 R7 | A mesma, por atleta | 1001–1015 | −0,04 pp em 2 de 4; nunca pior | Rejeitada |
| 2026-10-05 | v3-1 R8 | Probabilidade de quebra | 1001–1015 | Brier melhor em 2 de 4 | Rejeitada |

### Fase final

| Id | Data | Sementes | Resultado (pp, IC) | Regras | Decisão |
|---|---|---|---|---|---|
