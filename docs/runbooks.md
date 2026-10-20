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

Turnstile (login e registo): criar o widget no painel da Cloudflare (Turnstile → Add widget, domínio
`aquastats.net`) e, a partir de `apps/web`, `npx wrangler secret put TURNSTILE_SECRET_KEY` e
`npx wrangler secret put TURNSTILE_SITE_KEY`. Fica ativo no pedido seguinte, sem novo deploy. Desligar: `npx wrangler
secret delete TURNSTILE_SECRET_KEY` (sem segredo a edge não verifica) e o mesmo para a chave do site.

Custo 0 €: Cloud Run com `min-instances` 0 e no máximo 3 instâncias, CPU só durante pedidos; Neon suspende o compute
quando parado (0,25–2 CU); orçamento GCP "aquastats 0 EUR" de 1 € com alertas por email a 1 %, 50 %, 100 % e
previsão de 100 % (`gcloud billing budgets list --billing-account=01072B-666958-EE03A3`).

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

A migração 016 (RGPD) tem de ser aplicada **antes** do deploy da API que a usa: o modelo `User` lê
`terms_version`, `terms_accepted_at` e `inactivity_notice_at`, e sem essas colunas qualquer login falha.

## Retenção (contas inativas há 3 anos)

`POST /api/v1/auth/internal/retention` avisa por email as contas a 30 dias de fazer 3 anos sem uso e apaga, pelo
fluxo de eliminar conta, as avisadas há 30 dias que não voltaram a entrar. Um treinador com atletas na equipa não
é apagado (fica no registo como `retention: account ... kept`). Sem `CRON_SECRET` (≥ 32 caracteres) o endpoint
responde 404. Corre uma vez por dia no Cloud Scheduler (3 jobs grátis por conta de faturação):

```bash
# Segredo novo na API (não fica no repositório)
gcloud run services update aquastats-api --region europe-west3 --project gen-lang-client-0997549665 --update-env-vars CRON_SECRET=<segredo>
# Job diário às 04:00 de Lisboa, direto ao Cloud Run (o Origin passa o CSRF; x-edge-auth passa a guarda da edge)
gcloud scheduler jobs create http aquastats-retencao --location europe-west3 --project gen-lang-client-0997549665 \
  --schedule "0 4 * * *" --time-zone "Europe/Lisbon" --http-method POST \
  --uri "https://<URL do Cloud Run>/api/v1/auth/internal/retention" \
  --headers "x-cron-key=<segredo>,x-edge-auth=<EDGE_AUTH_TOKEN>,Origin=https://aquastats.net"
# Correr já, e ver o resultado ({"reactivated", "warned", "deleted", "skipped"}) nos logs
gcloud scheduler jobs run aquastats-retencao --location europe-west3 --project gen-lang-client-0997549665
```

## Restauro (PITR)

Consola Neon → *Branches* → *New branch* → *Branch data and schema from a past point in time* → parent
`production`, hora anterior ao incidente → verificar os dados na branch nova → se estiverem certos, *Reset from
parent* ou apontar a API para a branch restaurada (nova revisão Cloud Run com o `DATABASE_URL` dessa branch).
Ensaio (09/10/2026, branch `staging-hardening`, dados sintéticos):

- Às 11:01:30Z foi inserida uma linha de teste em `organizations`, e às 11:01:38Z foi apagada.
- Às 12:39:56Z foi pedida, na consola, uma branch do *parent* `staging-hardening` no instante 11:01:35Z
  (`br-fragrant-star-b10idiu7`, auto-apagada em 1 dia).
- **Resultado: a linha voltou com o mesmo id e a mesma `created_at`; no *parent* continua apagada (0 linhas).**
- A branch ficou pronta em menos de 10 s. Os dados foram verificados por SQL às 12:40:44Z, 48 s depois do pedido,
  incluindo a consulta manual.
- O seletor da consola usa a hora local (Europe/Lisbon, UTC+1) e aceita segundos.
- Limite: o PITR gratuito cobre 6 h. Uma reversão tem de ser decidida dentro dessa janela.

## Incidentes

| Sinal | Primeiro passo |
|---|---|
| 5xx > 1 % em 15 min (logs `aquastats.request`, `status >= 500`) | Ver o `requestId` nos logs; se começou com um deploy, reverter |
| Dados de outra equipa visíveis | Reverter já a revisão; rodar `SESSION_SECRET`; rever logs de acesso; avisar os afetados |
| `/health/ready` em 503 | Neon em baixo ou sem compute: consola Neon → estado do endpoint |
| Cronometragem lenta | Logs: `PUT /times` ms; muitos snapshots em paralelo → mais instâncias (`--max-instances`) |
| Fuga de segredo | Rodar no fornecedor, atualizar o segredo, nova revisão, revogar o antigo; correr gitleaks |
