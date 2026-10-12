# Produto para o treinador — perguntas e ecrãs

O Aquastats existe para o treinador **perceber o treino**, **perceber cada atleta**, **decidir que treino
fazer** e **prever resultados**. O modelo de previsão é um meio: a sua fiabilidade fica num "Como se
calculou", nunca em destaque. Cada indicador tem fórmula e fonte em [`indicadores.md`](indicadores.md);
o que a ciência suporta e o que não suporta está em [`referencias.md`](referencias.md) §5.

## Princípios

1. **Telemóvel à beira da piscina primeiro**: a resposta mais comum está a ≤ 3 toques de "Hoje".
2. **Números reais com unidades**: s/100 m, m/s, pontos World Aquatics, % do melhor, km/semana, sempre
   com a tendência (seta e Δ face às 4 semanas anteriores).
3. **Cada gráfico responde a uma pergunta escrita no título** ("O treino foi feito ao ritmo pedido?").
   Cada gráfico tem uma tabela alternativa.
4. **Cada alerta diz porquê e o que ver a seguir** (ligação ao ecrã que o explica).
5. **Sinais, não ordens**: uma sugestão de treino traz o dado que a motiva, o raciocínio, a incerteza e
   uma alternativa. O treinador decide. Nunca 0 % nem 100 %. Nada de aconselhamento médico.
6. **Ruído antes de sinal**: diferenças abaixo do ruído típico (0,6–0,8 % em elite, 1–2 % em jovens) não
   geram alertas nem setas (referências §4.4).
7. **Sem métricas do modelo à vista** (MAPE, cobertura, "track record"), exceto o intervalo de uma
   previsão, que o treinador precisa para decidir.

## A. Perceber o treino — ecrã "Análise do treino" (sessão e semana)

| Pergunta | Resposta no ecrã | Indicador |
|---|---|---|
| O treino foi feito ao ritmo que pretendia? | Por série: ritmo-alvo da zona de cada atleta vs ritmo nadado, cor por aderência (dentro / rápido / lento) | Aderência de intensidade |
| Que % do volume caiu em cada zona, e quanto devia para esta fase? | Barras por zona: feito vs intervalo de referência da fase | Distribuição de zonas |
| Cada série foi nadada à intensidade certa para cada atleta? | Tabela atleta × série com Δ s/100 m ao alvo | Ritmo-alvo por zona (CSS do atleta) |
| Houve queda de ritmo na série e na sessão? | Índice de queda por série (últimas reps vs primeiras) | Índice de queda |
| A saída foi cumprida? | % de reps com descanso ≥ 5 s dentro da saída | Aderência à saída |
| O que mudou face às últimas semanas? | Volume, % por zona e carga vs média das 4 semanas anteriores | Carga e tendência |

## B. Perceber o atleta — página do atleta

| Pergunta | Resposta | Indicador |
|---|---|---|
| Qual o nível e onde está forte ou fraco? | Melhores tempos por estilo e distância, em pontos World Aquatics; o maior e o menor destacados | Pontos WA |
| Que perfil de velocidade tem? | CSS (s/100 m), reserva de velocidade (100 vs CSS), fundo vs velocidade, índice de queda | CSS, perfil |
| Que zonas de treino lhe correspondem? | Tabela de ritmos-alvo A1…PA em s/100 m e por 50/100/200 | Zonas por atleta |
| Como está a técnica? | Frequência, distância por braçada, SWOLF, reação, quando registados | DPS, SWOLF |
| Como estão a forma e a carga? | Carga semanal com tendência, km/semana, assiduidade, bem-estar | Carga e tendência |
| Como compara consigo e com o grupo? | % do melhor pessoal; posição no grupo de treino | % do melhor |
| Onde perde tempo em prova? | Parciais vs plano par, 1.º vs 2.º 50, reação | Análise de prova |
| Que treino a evidência sugere agora? | Sinais de treino (secção C) | Sinais |

## C. Decidir o treino — "Sinais de treino"

Regras ancoradas no que a evidência suporta (referências §4–§5). Cada sinal mostra: **dado**,
**raciocínio**, **incerteza** (baixa / média / alta) e **alternativa**.

| Sinal | Dado que o dispara | Raciocínio | Fonte |
|---|---|---|---|
| Base aeróbia abaixo da fase | % de volume em A1+A2 nas últimas 3 semanas abaixo do intervalo da fase geral/específica | A base aeróbia é o grosso do volume na preparação geral | Periodização, referências §4.2 |
| Intensidade acima do pedido | ≥ 30 % das reps aeróbias mais rápidas que o alvo da zona (> 2 s/100 m) | Aeróbio nadado rápido deixa de ser aeróbio e acumula fadiga | Zonas, §4.1 |
| Carga acima do habitual | Carga da semana > média das 4 anteriores em mais de 30 % | Subida brusca de carga; **descritivo, não é risco de lesão** | Foster; críticas ao ACWR, §5 |
| Queda de ritmo acumulada | Índice de queda médio das séries principais pior que o habitual do atleta em 2 semanas seguidas | Fadiga dentro das séries | Ruído §4.4 |
| Velocidade parada | Melhor das reps MAX/ritmo de prova sem melhoria em 6 semanas, enquanto a CSS melhora | Perfil a afastar-se da velocidade | Perfil de velocidade |
| Taper a aproximar-se | Prova A daqui a ≤ 21 dias | Polimento de ~2 semanas com −41–60 % de volume e intensidade mantida | Bosquet 2007, §4.3 |
| Sem tempos para decidir | < 3 sessões com tempos nas últimas 2 semanas | Sem dados não há sinal | — |

Não se afirma: risco de lesão, zonas "seguras" de ACWR, efeito garantido do taper, previsões de
carreira. Bem-estar mau mostra-se como dado, nunca como diagnóstico.

## D. Prever resultados

| Pergunta | Resposta |
|---|---|
| Que tempo devia fazer (potencial dado o estado)? | Tempo "devia" por rep e prova, com a data da última evidência |
| Que tempo vai fazer? | Previsão com intervalo a 80 % (o único número do modelo à vista) |
| Que parciais devo pedir? | Plano de parciais a partir do tempo-alvo e do perfil de queda do atleta |
| Quanto vale o taper? | Intervalo de 1–3 % (estimativa da literatura), nunca um número único |
| O que preciso de treinar para chegar a X? | Δ ao alvo em s e em pontos; ritmo-alvo por 100 m; CSS necessária (estimativa) |

## E. Equipa

Quadro por grupo de treino: atletas fora do padrão (carga, assiduidade, queda de ritmo), carga coletiva
por semana, próximas provas e dias para o taper.

## Ecrãs

| Ecrã | Pergunta no título | Toques desde "Hoje" |
|---|---|---|
| Hoje | "O que merece atenção hoje e porquê?" | 0 |
| Atleta › Perfil | "Que nadador é e o que treinar agora?" | 2 (Equipa › atleta) |
| Análise do treino | "O treino foi feito como pedido?" | 2 (treino › análise) |
| Época | "A distribuição de zonas está certa para a fase?" | 1 |
| Preparação de prova | "Que tempo e que parciais pedir?" | 2 |
| Equipa | "Quem está fora do padrão?" | 1 |

## Recolha de dados (só o que vale o toque)

| Dado | Porquê | Como, com o mínimo de toques |
|---|---|---|
| Tempos de todas as reps | Tudo depende disto | Cronómetro por pista já existente; repetir a saída automaticamente |
| Chamada (presenças) | Separa "faltou" de "não cronometrado" | 1 toque por atleta ausente ao abrir a sessão |
| RPE da sessão (CR-10) | Carga interna, Foster | Atleta, 1 toque no calendário de sono e recuperação (**feito**); o perfil mostra a média de 7 dias vs as 3 semanas antes |
| Bem-estar (sono, fadiga, dor) | Medidas subjetivas são sensíveis à carga (Saw 2016) | Atleta, 3 toques de manhã, opcional |
| Teste CSS (400 + 200) | Âncora das zonas | Sessão-modelo de teste a cada 6–8 semanas |
| Reação e parciais de prova | Onde se perde tempo | Importação LENEX/PDF já existente |

Não se pedem: lactato (exige material), FC contínua (só se houver sensor), campos livres.
