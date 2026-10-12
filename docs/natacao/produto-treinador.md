# Produto para o treinador — perguntas e ecrãs

O Aquastats existe para o treinador **ver, perceber e saber como melhorar o atleta**, de preferência no
telemóvel à beira da piscina. Teste de cada número, gráfico ou frase: *um treinador sem formação em dados
percebe isto em 5 segundos e sabe o que fazer a seguir?* Se não passa, sai.

A lógica de natação por trás de cada regra está em [`logica-treinador.md`](logica-treinador.md) (§8 tem as
regras do produto); as fontes em [`referencias.md`](referencias.md).

## Princípios

1. **Telemóvel primeiro** (375 px, sem scroll horizontal da página, números legíveis).
2. **Unidades de piscina**: tempos (0:30,5), segundos, metros, km por semana. **Nada de ritmos /100 m
   calculados**: um 50 em 30,0 não é "1:00/100 m". Cada distância tem o seu tempo-alvo.
3. **Um gráfico, uma pergunta**, escrita no título em linguagem de piscina. Preferir tabela de tempos com
   cores, barras simples, linha com no máximo 2 séries, e frases.
4. **Cada frase aponta o dado que a sustenta**; sem causa nos dados diz "sem causa clara nos dados".
5. **Ruído antes de sinal**: nada abaixo do ruído típico do atleta (o seu desvio rep a rep na mesma série,
   mínimo 0,5 % do tempo; Pyne 2004).
6. **Sinais, não ordens**, sem diagnóstico médico. Sem métricas do modelo, intervalos estatísticos ou siglas
   sem explicação.
7. **Menos é mais**: o que não ajuda a decidir o treino de amanhã sai.

## O "tempo que devia fazer"

Para cada rep: a mediana das reps do atleta na mesma piscina, estilo, distância, zona, material e descanso
nos 42 dias anteriores (≥ 3 reps); sem isso, o mesmo sem o descanso; sem isso, melhor tempo de prova nessa
distância + 0,8 s (partida de bloco → impulso) ÷ % da zona (A1 79 %, A2 85 %, A3 90 %, ritmo de prova
97,5 %; estimativas, `logica-treinador.md` §1.2). Material diferente nunca se mistura. Código:
`apps/web/src/lib/coach-analysis.ts`.

## Ecrãs

A forma de apresentar (conclusão primeiro, "Correu bem / A melhorar", certeza em palavras, cores acessíveis,
versão do atleta) vem de [`benchmark-visualizacao.md`](benchmark-visualizacao.md).

| Ecrã | Pergunta no título | O que mostra |
|---|---|---|
| Treino | "Como correu o treino?" | Fichas de atleta com o estado do dia; frase de abertura; Correu bem / A melhorar (coincide com…, opção para a próxima); cartão por série (média, devia, regularidade, fim vs início, pontos sobre a faixa normal; reps com Fez / Previsto / Devia fazer / Dif.) |
| Análise › Treino | Sessão · "Está a melhorar?" | O mesmo relatório para qualquer dia; Evolução por tipo de série (2 últimas semanas vs as 6 anteriores), melhores médias, recuperação depois das paragens |
| Atleta | "Como está …?" | Cartões Treino / Carga e cansaço / Provas com estado em palavras e ligação ao detalhe; nível (melhor prova e pontos World Aquatics); até 3 sinais de treino |
| Atleta / Época › Carga | "Carga: como reage este atleta?" | Frase de conclusão sobre a reação a subidas de carga; por semana: km, tempos face ao devido, esforço, sono |
| Análise › Prova | "Porque correu assim?" | Tempo, MP, Δ ao MP com nome; Correu bem / A melhorar; parciais com Δ e ritmo de prova; preparação (polimento, trabalho rápido, treinos antes, contexto) só para o treinador |
| Atleta (app) | "O teu último treino" · "Como correu a tua prova?" | Um ponto forte e um foco, comparação só consigo, sem crítica do polimento; histórico com a série principal de cada treino |
| Hoje | "Hoje" | O que mudou desde o último treino e a comparação do período |
| Época | "A distribuição de zonas está certa para a fase?" | % do volume por zona contra a referência da fase |

## Removido (e porquê)

- "Quem merece atenção" e os sinais em "Hoje": listas de alertas sem o treino à frente; os sinais ficam no
  perfil de cada atleta.
- "Como se calculou": explicações de fórmula não ajudam a decidir o treino.
- "Que tempo e que parciais pedir?" e "Planeado vs feito".
- CSS, zonas em s/100 m e a tabela de aderência de intensidade: ritmos /100 m calculados não são a forma
  como o treinador pensa uma série; substituídos pelo tempo devido por distância.
- Prova mais forte e mais fraca: o nível mostra só a melhor prova.
- "Carga A:C": substituída por "Carga", que liga carga, cansaço e tempos.
- Análise › Treino › "Modelo" (médias que misturavam zonas, histograma, efeitos do modelo em %, fiabilidade
  das estimativas): substituído por "Evolução" por tipo de série.

## Recolha de dados (só o que vale o toque)

| Dado | Porquê | Como |
|---|---|---|
| Tempos de todas as reps | Tudo depende disto | Cronómetro por pista |
| Chamada (presenças) | Separa "faltou" de "não cronometrado" | 1 toque por ausente |
| Esforço da sessão (0–10) | Carga sentida | Atleta, 1 toque no calendário de sono e recuperação |
| Sono, recuperação, ginásio | Explicam um dia bom ou mau | Atleta, de manhã, opcional |
| Reação e parciais de prova | Onde se ganha ou perde tempo ao recorde | Importação LENEX/PDF ou "Adicionar detalhes da prova" |

Não se pedem: lactato, FC contínua (só com sensor), campos livres.
