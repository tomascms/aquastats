# Indicadores de natação

Código: [`apps/web/src/lib/indicators.ts`](../../apps/web/src/lib/indicators.ts) (testes em `indicators.test.ts`)
e `finaPoints` em [`rankings.ts`](../../apps/web/src/lib/rankings.ts). Fontes: [`referencias.md`](referencias.md).
Tudo é calculado sobre tempos registados; nenhum indicador usa o modelo de previsão.

| Indicador | Definição e fórmula | Fonte | Limites — o que NÃO concluir |
|---|---|---|---|
| **CSS** (ritmo crítico, s/100 m) | `100 × (T2 − T1)/(d2 − d1)`; teste do produto: 400 e 200 máximos, `(T400 − T200)/2` | Wakayoshi; Dekerle; Scott 2023 (CV < 2 %); referências §2.3, §4.1 | Sobrestima o ritmo dos 1500 em ~3,5 % (Zacca). Não é o limiar de lactato exato. Exige dois esforços máximos recentes (≤ 8 semanas). Sem 400, o ecrã usa 100/200 e marca-o "sobrestima" |
| **Zonas por atleta** | Alvo = CSS ÷ fração da velocidade CSS: Suave 75–84 %, A1 84–90 %, A2 92–95 %, A3 96–99 %, PA 102–106 %. Ritmos em piscina de 25 m convertidos para 50 m (× 1,03). Ritmo de prova e MAX vêm dos melhores tempos, não da CSS | Referências §4.1 (coluna % de velocidade, **estimativa**; os desvios em segundos da mesma tabela não batem com as % em CSS rápidas ou lentas) e §2.1 (conversão 25/50 m, estimativa 1,02–1,04) | Intervalos não cobrem tudo de propósito (há folga entre zonas). Não usar para atletas sem CSS recente |
| **Aderência de intensidade** | Ritmo da rep (s/100 m) vs alvo da zona ± 1 s: dentro / rápido / lento | Zonas acima; ruído §4.4 | Válido para livres sem material; com material, estilo ou piscina diferentes o alvo não se aplica |
| **Índice de queda** (%) | Média da 2.ª metade da série ÷ média da 1.ª metade − 1 (≥ 4 reps) | Definição operacional do protocolo ML (quebra), referências §2.4 | Depende da saída e do descanso: só se compara com séries iguais do próprio atleta |
| **Diferencial de parciais** (%) | 2.º 50 ÷ 1.º 50 − 1 num 100 | Referências §2.4 (elite 100 L ≈ +9 %) | O 1.º 50 inclui a partida; valores de outros estilos são estimativa |
| **SWOLF** | Segundos + braçadas por comprimento | Referências §5 | Só compara o mesmo atleta, mesma piscina e mesmo ritmo; nunca entre atletas |
| **Distância por braçada / frequência** | `d / ciclos` (m/ciclo); `ciclos / t × 60` (ciclos/min) | Born 2022 (elite), referências §3 | Valores nacionais são estimativa; mudam com a velocidade |
| **Pontos World Aquatics** | `floor(1000 × (B/T)³)`, B = tempo-base do ano, sexo, piscina e prova | World Aquatics 2026, referências §1.1 | Os tempos-base mudam todos os anos; pontos entre estilos são comparáveis só de forma aproximada |
| **Nível** | Pela pontuação: Iniciação < 300 ≤ Regional < 450 ≤ Nacional jovem < 600 ≤ Nacional absoluto < 750 ≤ Internacional < 870 ≤ Elite | Referências §1.6 (cortes: **estimativa** ancorada em mínimos FPN e finais olímpicas) | Um nível é uma escala, não um rótulo do atleta: depende da prova |
| **Ritmo em equivalente de 50 m** | Ritmo em 25 m × 1,03 (livres); usado na CSS e na aderência; o ecrã do treino mostra o alvo na piscina do treino | Referências §2.1 (**estimativa** 1,02–1,04) | Os outros estilos têm fatores diferentes (costas ≈ 1,06): só livres são julgados |
| **Plano de parciais** | Tempo-alvo × fração de cada 50 m da melhor prova do atleta com parciais (cumulativos), ou referência: 100 = 47,85 / 52,15 %; 200 = 24 / 25,4 / 25,4 / 25,2 %; mais longas: 1.º 50 com 6 % a menos, restantes iguais | Referências §2.4 (2.º 50 ≈ +9 % em elite) | É um plano, não uma previsão |
| **% do melhor** | `T ÷ melhor − 1` | — | Abaixo de 1 % em jovens (0,6–0,8 % em elite) é ruído |
| **Esforço, recuperação e sono** | Médias dos últimos 7 dias vs as 3 semanas antes (≥ 2 registos): RPE da sessão (CR-10, 0–10, 1 toque no calendário do atleta), recuperação 1–5, horas de sono | Foster 2001 (sRPE); Saw 2016 (medidas subjetivas mais sensíveis à carga) | Só descritivo: não há limiar validado para alertar, e não é diagnóstico. Sem duração da sessão não se calcula a carga sRPE (RPE × minutos) |
| **Carga e tendência** | Carga semanal = volume × peso da intensidade (`season.ts`); tendência = semana atual vs média das 4 anteriores; só é "real" acima de um limiar | Foster (sRPE), referências §5 | **Não é risco de lesão** (críticas ao ACWR: Impellizzeri 2020, Lolli 2019) |
| **Distribuição por zona vs fase** | % do volume por banda (Suave/A1, A2, A3, PA/MAX, ritmo de prova) contra um intervalo por fase | Prática de treino (**referência indicativa**, sem fonte verificada; referências §4.2) | Mostrar como referência, nunca como erro |

## Sinais de treino

Regras em `trainingSignals` (ver [`produto-treinador.md`](produto-treinador.md) §C). Cada sinal traz o dado com
unidades e uma incerteza qualitativa; o ecrã junta o raciocínio, a alternativa e a fonte.

| Sinal | Dispara quando | Incerteza |
|---|---|---|
| Sem dados | < 3 sessões com tempos em 14 dias (não se mostra mais nenhum sinal) | alta |
| Taper | Prova A em ≤ 21 dias | média |
| Carga acima do habitual | Última semana completa > 1,3 × média das 4 anteriores, **só se as 4 tiveram treino** (o regresso de uma pausa é rampa, não pico) | média |
| Base aeróbia abaixo da fase | Fase geral/específica e % Suave+A1+A2 em 21 dias abaixo do mínimo indicativo | alta |
| Intensidade acima do pedido | ≥ 30 % das reps A1/A2 (livres, sem material, ≥ 10 reps) mais de 2 s/100 m abaixo do alvo | média; **alta** se a CSS vem de um teste com mais de 8 semanas (o dado diz a idade) |
| Queda de ritmo acumulada | Queda média das séries principais em 14 dias > habitual (15–70 dias) + 1,5 pp | média |

Nenhum sinal usa probabilidades, prevê lesões ou dá conselho médico.

## Tempos explicados (treino e perfil do atleta, treinador)

Código: [`apps/web/src/lib/explained-times.ts`](../../apps/web/src/lib/explained-times.ts) e `explainTrainingTargets` em
`training-prediction.ts` (testes em `explained-times.test.ts`). Usa o modelo v1.0 tal como está: só o expõe, em palavras de treinador.

| Onde | O que mostra | Regra |
|---|---|---|
| Treino, cada série | Cada tempo é um chip: verde mais rápido, cinzento normal, laranja mais lento do que costuma. Tocar abre a caixa "1:03,9 · 1,9 s mais rápida do que costuma" e até 3 motivos | Normal = diferença abaixo de 1 % face ao habitual (mediana ponderada, meia-vida 28 dias, das reps iguais anteriores); um tempo normal não leva explicação |
| Treino, cada série | Curva numa frase ("Começou como costuma e quebrou nas últimas 2 (mais do que costuma)") e "Esta vez vs a última" com o que foi diferente (máx. 3 linhas) | Índice de queda comparado com séries iguais anteriores; diferenças abaixo de 1 pp são ruído. "O que foi diferente" são só dados |
| Treino, topo | Uma linha de resumo ("3 reps mais lentas do que costuma, quase todas no fim das séries; 4.º dia seguido de treino") | |
| Perfil | Cartão da semana (s por 100 m e etiquetas dos motivos), uma bola por semana na época, e até 4 frases do que costuma coincidir com os tempos | Frases só para associações fora da margem (≈ ± 2 desvios residuais ÷ √sessões; volume semanal: declive ± 2 erros-padrão, ≥ 6 semanas) |

Motivos = fatores do modelo com o mesmo sentido do tempo, aprendidos em ≥ 8 reps e com peso ≥ 0,2 %, ditos com os dados do dia
("dormiu 6 h", "voltou de 10 dias sem treinar"). Sempre "nos registos dele/dela, isto costuma coincidir com…": associação, nunca
causa, porque a parte de contexto não passou no backtest. Sem sono registado, a frase diz-o. Os números (s, %, n, margem) ficam em
"Ver detalhes". Capturas da demo sintética: `docs/img/tempos-*.jpg`.
