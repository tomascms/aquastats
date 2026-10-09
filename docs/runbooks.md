# Runbooks

Comandos oficiais apenas (sem scripts de deploy próprios). Projeto GCP `gen-lang-client-0997549665`, serviço
`aquastats-api` (`europe-west3`), Worker `aquastats-web`, Neon `polished-fog-70080186` (branch `production`).
Qualquer passo em produção só com autorização explícita do dono.

## Deploy

```bash
# API, a partir de apps/api (a revisão nova só recebe tráfego se arrancar)
gcloud run deploy aquastats-api --source . --region europe-west3 --project gen-lang-client-0997549665 --quiet
# Site, a partir de apps/web
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```

Antes: CI verde, `npx tsc --noEmit`, `npm run lint`, `npm test`, `pytest` (com Postgres), build OpenNext.
Depois: `https://aquastats.net/api/v1/health` → `aquastats-api`; `/api/v1/health/ready` → `ok`; login, criar
treino, cronometrar, competições.

## Reversão

```bash
gcloud run revisions list --service aquastats-api --region europe-west3 --project gen-lang-client-0997549665
gcloud run services update-traffic aquastats-api --to-revisions <REVISÃO_ANTERIOR>=100 --region europe-west3 --project gen-lang-client-0997549665
cd apps/web && npx wrangler deployments list && npx wrangler rollback
```

Modelo de previsão: `npx wrangler secret put ML_CHAMPION` com `atual` (reverte já, sem rebuild); `ML_SHADOW=off`
para parar o desafiante.

## Migrações

1. Ensaiar na branch `staging-hardening` (só esquema): as instruções da migração numa transação.
2. Anotar a hora (ponto de restauro; PITR do plano gratuito = 6 h).
3. Aplicar na produção, numa transação, como `neondb_owner`; registar em `schema_migrations`.
4. Verificar no catálogo (roles, políticas, colunas).

## Restauro (PITR)

Consola Neon → *Branches* → *New branch* → *Branch data and schema from a past point in time* → parent
`production`, hora anterior ao incidente → verificar os dados na branch nova → se estiverem certos, *Reset from
parent* ou apontar a API para a branch restaurada (nova revisão Cloud Run com o `DATABASE_URL` dessa branch).
Ensaio: preparado no staging a 09/10/2026; por concluir (consola Neon exigiu novo login).

## Incidentes

| Sinal | Primeiro passo |
|---|---|
| 5xx > 1 % em 15 min (logs `aquastats.request`, `status >= 500`) | Ver o `requestId` nos logs; se começou com um deploy, reverter |
| Dados de outra equipa visíveis | Reverter já a revisão; rodar `SESSION_SECRET`; rever logs de acesso; avisar os afetados |
| `/health/ready` em 503 | Neon em baixo ou sem compute: consola Neon → estado do endpoint |
| Cronometragem lenta | Logs: `PUT /times` ms; muitos snapshots em paralelo → mais instâncias (`--max-instances`) |
| Fuga de segredo | Rodar no fornecedor, atualizar o segredo, nova revisão, revogar o antigo; correr gitleaks |
