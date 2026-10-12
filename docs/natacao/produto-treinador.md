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

| Ecrã | Pergunta no título | O que mostra |
|---|---|---|
| Treino | "Como correu o treino?" | Seletor de atleta; por série, cada rep com **Fez / Previsto / Devia fazer / Dif.** (verde no devido, âmbar mais rápido, vermelho mais lento); "Leitura do treino" em frases com o porquê e, quando há queda, como a prevenir |
| Atleta › Perfil | "Que nadador é e o que treinar agora?" | Nível = melhor prova e pontos World Aquatics; queda média nas séries; como se sente (esforço, recuperação, sono); sinais de treino |
| Atleta / Época › Carga | "Carga: como reage este atleta?" | Uma frase de conclusão ("quando a carga sobe mais de 20 %, os tempos pioram x % na semana seguinte e recuperam na 2.ª") e, por semana: km, tempos face ao devido, esforço, sono |
| Análise › Prova | "Porque correu assim?" | 3–5 frases no topo; contra o recorde pessoal (reação e parciais, quando há); o polimento resultou (redução de volume: pouca < 30 %, adequada 30–65 %, demasiada > 65 %; estímulo de velocidade); últimos treinos; perfil 25/50 vs séries longas; contexto (sono, recuperação, ginásio) |
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

## Recolha de dados (só o que vale o toque)

| Dado | Porquê | Como |
|---|---|---|
| Tempos de todas as reps | Tudo depende disto | Cronómetro por pista |
| Chamada (presenças) | Separa "faltou" de "não cronometrado" | 1 toque por ausente |
| Esforço da sessão (0–10) | Carga sentida | Atleta, 1 toque no calendário de sono e recuperação |
| Sono, recuperação, ginásio | Explicam um dia bom ou mau | Atleta, de manhã, opcional |
| Reação e parciais de prova | Onde se ganha ou perde tempo ao recorde | Importação LENEX/PDF ou "Adicionar detalhes da prova" |

Não se pedem: lactato, FC contínua (só com sensor), campos livres.
