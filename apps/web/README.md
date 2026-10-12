# Web

Next.js 16 (React 19, TypeScript, Tailwind 4) em Cloudflare Workers via OpenNext. Português europeu com
inglês completo. Pensado para o telemóvel à beira da piscina, com fila offline.

## O que faz

- **Treinador:** "Hoje" (quem merece atenção), construtor de treinos, cronometragem em matriz, competições e
  análise de prova, época e carga, equipa, comparação por dia, semana, mês e ano.
- **Atleta:** evolução, objetivos, recordes, bem-estar, histórico e provas, só com os seus dados.
- **Modelo de previsão:** corre no browser, num Web Worker, e prevê cada repetição com intervalo.
- **Proxy:** `/api/v1/*` é reencaminhado para a API (cookies, `X-Edge-Auth`, limites de tempo e tamanho).

## Estrutura

```
src/app/
  coach/        cronometro, matrix, workouts, plano, epoca, competicoes, provas, team, definicoes
  swimmer/      página do atleta, histórico, treino, provas, definições
  entrar/ confirmar/ repor/ escolher/ aprovar-treinador/   entrada, convites e confirmações
  api/v1/[...path]/route.ts   proxy para a API
src/components/  UI por área: workouts, matrix, race (analise), season, competicoes, goals, heart-rate,
                 wellness, team, shells (layouts), ui (botões, toasts, confirmações)
src/lib/         lógica pura e testada
  set.ts, workout-text.ts, send-off.ts      treino: estrutura, texto escrito, saídas
  race.ts, race-analysis.ts, rankings.ts    provas, parciais, recordes
  season.ts, planned-done.ts, morning.ts    época, planeado vs. feito, vista "Hoje"
  ml/                                        modelo de previsão (ver abaixo)
src/i18n/        en.ts: cada texto t("...") em português precisa de entrada em inglês
scripts/         gerador de dados sintéticos e ferramentas de backtest do modelo (ml-*.ts)
```

## Modelo de previsão (`src/lib/ml`)

`state-model.ts` e `v1.ts` (estado hierárquico com filtro de Kalman robusto), `fatigue.ts` (reserva anaeróbia
dentro da série), `calibration.ts` (intervalos conformal), `races.ts` (tempos de prova), `ledger.ts`
(previsões imutáveis para comparar com o real), `ml.worker.ts` (execução fora da thread principal),
`backtest.ts` e `synthetic.ts` (validação em dados sintéticos). Estado e limites honestos em
[../../docs/ml/README.md](../../docs/ml/README.md).

## Correr e testar

```bash
npm ci
API_URL=http://127.0.0.1:8000 APP_URL=http://127.0.0.1:3000 npm run dev    # http://127.0.0.1:3000
npm test                                                                   # lógica, harness e golden do modelo
npx next typegen && npx tsc --noEmit && npm run lint
npx opennextjs-cloudflare build                                            # build para o Worker
```

Sem uma API a correr, o site abre mas não autentica; os passos para a API e os dados sintéticos estão no
[README da raiz](../../README.md#correr-localmente-com-dados-sintéticos).
Backtest do modelo: [../../docs/ml/harness.md](../../docs/ml/harness.md). Deploy: [../../docs/runbooks.md](../../docs/runbooks.md).
