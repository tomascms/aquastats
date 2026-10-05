# Plano de monitorização com dados reais

Para o período em que o site começa a ter tempos reais. Tudo o que está aqui foi fixado **antes**
de haver dados reais; os limiares não se mudam depois de ver os números.

## 1. O que corre

| Papel | Modelo | O que o treinador vê |
|---|---|---|
| Campeão | `atual` (mediana + ridge, o modelo de sempre) | As estimativas e intervalos |
| Desafiante em sombra | `estado` v1.0 (`apps/web/src/lib/ml/v1.ts`) | Nada; só o painel "Histórico de acerto" o refere |

Antes de cada treino com reps por cronometrar, o site grava no ledger (`prediction_ledger`,
migração 010) a previsão dos dois modelos para cada rep. A API recusa qualquer previsão que chegue
depois de o tempo existir: a previsão que conta é sempre a de antes. Os tempos introduzidos depois
são emparelhados com essas previsões (reconciliação).

**Pré-requisitos** (dependem de autorização): migração 010 aplicada em produção, API e site
publicados com esta versão.

## 2. Interruptores (sem nova versão do site)

Lidos em tempo de execução por `/api/ml-config`; valem no pedido seguinte (cache de 5 min no browser).

| Variável | Valores | Efeito |
|---|---|---|
| `ML_CHAMPION` | `atual` · `estado` · (vazio) | Modelo mostrado. Vazio = o da build (`atual`). `atual` = reversão imediata |
| `ML_SHADOW` | `off` · (vazio) | `off` deixa de gravar o desafiante em sombra |

```bash
cd apps/web
npx wrangler secret put ML_CHAMPION   # escrever: atual (reverter) ou estado (promover)
npx wrangler secret put ML_SHADOW     # escrever: off (parar a sombra)
npx wrangler secret delete ML_CHAMPION   # voltar ao valor da build
```

## 3. O que olhar todas as semanas (segunda-feira)

No painel **Histórico de acerto** (Análise → Análise de treino → vista "Modelo"), por atleta:

1. **Reps comparadas e cobertura** — o intervalo do modelo mostrado deve conter ~80 % dos tempos
   (`estado`) ou ~68 % (`atual`). Com poucos tempos as barras semanais oscilam; olhar para 4 semanas.
2. **Alertas** (aparecem a vermelho, só com ≥ 50 reps registadas nas últimas 4 semanas):
   - cobertura a mais de 12 pp do objetivo;
   - viés: erro médio com sinal acima de 1 % e |z| > 3 (estimativas sistematicamente lentas ou rápidas);
   - deriva: erro das últimas 4 semanas mais de 0,5 pp acima das 8 anteriores.
3. **Falhas recentes e porquê** — se a causa mais frequente for "Tempo com ar de erro de digitação",
   rever esses tempos com o treinador (o modelo não aprende com eles até serem corrigidos).
4. **O que aprendeu** — mudanças de forma, défice de regresso, fatores. Uma mudança grande sem razão
   aparente (por exemplo, todos os atletas "mais lentos 3 %" na mesma semana) aponta para um
   problema de dados (piscina errada, distância mal escrita), não para o modelo.
5. **Em sombra** — reps comuns, semanas e diferença de erro do desafiante face ao campeão.

## 4. Quando promover o desafiante

Todas, sobre as previsões **gravadas** (não reconstruídas), da equipa:

- ≥ 200 reps emparelhadas em ≥ 6 semanas;
- ΔMAPE (desafiante − campeão) com IC 95 % < 0 (bootstrap das semanas);
- CRPS do desafiante não pior; erro de cobertura não pior em mais de 1 pp;
- sem alertas ativos do desafiante nas últimas 4 semanas;
- paridade: nenhum subgrupo (sexo, escalão, estilo principal) com ≥ 200 reps pior mais de 0,10 pp
  (verificação manual a partir do ledger enquanto a equipa for pequena).

O painel diz "Já ganha nos dados reais: pode substituir o modelo atual" quando as três primeiras se
cumprem. A promoção é manual: `ML_CHAMPION=estado`.

## 5. Quando reverter

Depois de promovido, volta-se a `ML_CHAMPION=atual` **no mesmo dia** se:

- um alerta do modelo mostrado se mantiver duas semanas seguidas; ou
- nas últimas 6 semanas o ΔMAPE face ao modelo atual (que continua em sombra) tiver IC 95 % > 0; ou
- houver um erro técnico visível (estimativas em falta em massa, valores absurdos). A cadeia de
  degradação já evita NaN e páginas partidas (estado → mediana → último valor → sem estimativa),
  mas uma subida grande de estimativas "mediana"/"último valor" é sinal de avaria.

Depois de reverter: o modelo continua em sombra, os dados ficam, e a causa é investigada no
harness antes de qualquer nova versão.

## 6. Mudar de versão

O v1.0 está congelado (teste `v1.test.ts`: falha se alguma previsão mudar). Qualquer melhoria é uma
versão nova (`V1_VERSION` → `1.1`, …): começa uma série nova no ledger e tem de voltar a ganhar nos
dados reais. Nunca se reescreve o histórico de previsões (o ledger é append-only).

## 7. O que não se pode saber com estes dados

- Com uma equipa pequena, 200 reps emparelhadas podem demorar meses: a promoção vai ser lenta.
- A probabilidade de quebra de série e a capacidade ("devia fazer") só foram validadas em dados
  sintéticos; não aparecem na interface.
- Previsões de provas: há poucas provas por época; a calibração do intervalo só fica estável com
  dezenas de provas da equipa.
