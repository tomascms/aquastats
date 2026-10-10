# O que o modelo precisa do site e dos dados para melhorar

Lista para as fases seguintes (requisitos, dashboards). Por ordem de impacto esperado. Entre
parênteses, a evidência (sintética) ou a razão.

## Indispensável

1. **Tempos cronometrados, com regularidade.** A base de produção tem 0 tempos (2026-10-05). Sem
   eles nada se valida nos dados reais e o desafiante nunca pode ser promovido (≥ 200 reps
   emparelhadas em ≥ 6 semanas). Cronometrar pelo menos uma série por sessão chega para o modelo
   aprender; o painel "O que cronometrar" diz qual ensina mais (−0,07 a −0,16 pp vs escolher ao acaso).
2. **Migração 010 e deploy** (ledger), para que cada previsão fique gravada **antes** do treino.
   Sem ledger só há histórico reconstruído, que não serve para decidir a promoção.
3. **Data de nascimento e sexo** de cada atleta: são o ponto de partida do motor de um atleta novo
   (priors por idade e sexo). Sem eles a primeira semana tem intervalos muito largos.

## Melhora o modelo já validado (sintético)

4. **Estilo principal** de cada atleta (E2: −0,021 pp; com dados reais o efeito pode ser maior ou menor).
5. **Resultados de provas com data** — competições e resultados, ou recordes pessoais com data
   (E3: −0,054 pp no treino; E13: previsão de tempos de prova −0,19 pp vs o melhor tempo anterior).
   Recordes **anteriores** ao primeiro treino cronometrado ainda não são usados: não foram
   validados (o gerador não os tem); são o candidato mais óbvio a ajudar atletas novos.
6. **Saída (send-off) real de cada série e séries completas**: a fadiga individual (E12, −0,092 pp)
   e a probabilidade de quebra dependem do descanso entre reps. Cronometrar também as reps lentas
   do fim da série e **marcar quando o atleta parou a meio** (hoje uma série incompleta é
   ambígua: parou ou não foi cronometrado?) transforma uma censura numa observação.
7. **Piscina (25/50 m) e distância sempre certas** — um erro aqui parece uma mudança de forma.

## Só ajuda se for registado de forma consistente (não validado como ganho)

8. **Bem-estar diário** (sono, ginásio, recuperação percebida). Com bem-estar esporádico o
   contexto não melhorou as previsões (fase 3 e E8: ganhos só com muitos dados). Só vale a pena
   pedir se os atletas o preencherem quase todos os dias.
9. **Variar o volume antes de uma mesma série** (por exemplo 6×50 no início ou depois de 3 km), de
   forma controlada: é a única maneira de aprender a sensibilidade ao volume de cada atleta, que
   hoje não se recupera dos dados (correlação ≈ 0). Até lá não aparece na interface.
10. **Pausas e ausências marcadas com o motivo** (férias, doença, outro desporto): o modelo deduz
    as pausas da falta de treino; uma marca separa "não treinou" de "não foi registado".
11. **Planeamento das semanas antes de uma prova (taper)** introduzido com antecedência: a
    previsão de prova a 28 dias usa o treino planeado.
12. **Parciais** (splits): ainda não usados; são o próximo passo para ritmo de prova.

## Decisões adiadas

- **Priors entre equipas** (agregados, não identificáveis, coorte mínima): adiado — só há uma
  equipa e levanta privacidade.
- **Prescrição** ("saída recomendada", "probabilidade de completar a série"): o modelo de quebra
  passou a R8 **só em sintético**; fica fora da interface até haver validação com dados reais.
