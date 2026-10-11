# Web

Next.js 16 (React, TypeScript, Tailwind 4) em Cloudflare Workers via OpenNext. PT-PT com inglês completo.

```
src/app/         páginas e rotas (incl. proxy /api/v1/* para a API)
src/components/  UI por área (workouts, matrix, race, season…)
src/lib/         lógica pura: treinos, provas, época, modelo de previsão (ML)
src/i18n/        en.ts (todas as chaves t("...") precisam de entrada)
scripts/         backtest e ferramentas do modelo, gerador de dados sintéticos
```

```bash
npm ci && npm run dev                      # http://localhost:3000
npm test                                   # lógica, harness e golden do modelo
npx next typegen && npx tsc --noEmit && npm run lint
npx opennextjs-cloudflare build            # build para o Worker
```

Backtest do modelo: [../../docs/ml/harness.md](../../docs/ml/harness.md). Deploy: [../../docs/runbooks.md](../../docs/runbooks.md).
