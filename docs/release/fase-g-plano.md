# Fase G — Plano de produção (cada passo só com "autorizo o passo N")

Estado em 06/10/2026: **nada executado em produção.** Cada passo tem o comando exato, o impacto, a verificação e
a reversão. Um passo só começa depois de o anterior estar verificado. Custo previsto: 0 € (tudo dentro dos
escalões gratuitos; se algo exigir pagamento, paro e pergunto).

Identificadores: projeto GCP `gen-lang-client-0997549665`, serviço `aquastats-api` (`europe-west3`), Worker
`aquastats-web`, Neon `polished-fog-70080186`, branch `production` = `br-broad-bread-b1xob6r8`.
PITR do Neon: **6 horas** (plano gratuito) — por isso o ponto de restauro é anotado no início de cada passo
que toca na base, e qualquer reversão de dados tem de acontecer dentro dessa janela.

## Pré-condições (todas com evidência)

- [ ] PR #14 (hotfix) aprovado por ti e CI verde.
- [ ] PR da `release/hardening` para `main` aprovado por ti e CI verde (inclui a suite Postgres 18).
- [ ] Fases A–F concluídas (`docs/release/checklist.md`).
- [ ] Hora e LSN anotados (ponto de restauro) antes dos passos 2–4.

## Passo 1 — Hotfix de segurança (independente do resto)

O quê: merge do PR #14 em `main` e deploy de `main`.
```
cd apps/api && gcloud run deploy aquastats-api --source . --region europe-west3 --project gen-lang-client-0997549665 --quiet
cd apps/web && npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```
Impacto: Next 16.3.8 (GHSA-vcvr-r3jv-pc5j) e dependências Python corrigidas; sem mudança funcional.
Verificação: `https://aquastats.net/api/v1/health` → `aquastats-api`; `/entrar` carrega; chunk JS com `16.3.8`;
login, criar treino, cronometrar.
Reversão: `gcloud run services update-traffic aquastats-api --to-revisions <revisão anterior>=100 ...`;
`npx wrangler rollback` (versão anterior do Worker).

## Passo 2 — Migrações 005–014 na base de produção

O quê: as mesmas instruções ensaiadas no staging (`br-raspy-leaf-b1wvhlo5`), numa transação, como `neondb_owner`,
pelo conector Neon. Idempotentes; 005–009 já existem (só ficam registadas), 010 cria o ledger, 011/012 criam as
roles novas (sem login), as políticas por papel e o FORCE RLS; 013 acrescenta `time_logs.client_updated_at`; 014 remove índices duplicados.
Impacto: nenhum para o código atual — a API continua com `aquastats_app` (BYPASSRLS), que ignora as políticas.
Verificação: catálogo (roles, políticas, FORCE, permissões do ledger, `schema_migrations` 001–014).
Reversão: o código atual não depende de nada disto; em último caso, restauro PITR para a hora anotada.

## Passo 3 — Credenciais das roles novas (sem nunca mostrar as passwords)

O quê: `scripts/role_credentials.py` gera as passwords de `aquastats_api` e `aquastats_auth` diretamente para um
ficheiro ignorado; o operador aplica-as com `ALTER ROLE … LOGIN PASSWORD` na produção (ou o agente, com a
regra de permissão que desbloqueia `apply_role_passwords.py`).
Impacto: nenhum (ninguém usa as roles ainda).
Reversão: `ALTER ROLE … NOLOGIN`.

## Passo 4 — Segredos no Secret Manager (gratuito: 1 versão)

O quê: ativar a API Secret Manager; criar **um** segredo `aquastats-api-env` com todos os valores (dotenv):
`DATABASE_URL` (aquastats_api), `AUTH_DATABASE_URL` (aquastats_auth), `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`,
`SMTP_PASSWORD`, `POLAR_CLIENT_SECRET`, `GEMINI_API_KEY`, `AI_WORKER_KEY`, `EDGE_AUTH_TOKEN`. Conta de serviço
própria `aquastats-api@…` só com `roles/secretmanager.secretAccessor` nesse segredo (a atual é a *default* do
Compute, com permissões a mais).
Impacto: nenhum até ao passo 5.
Reversão: apagar o segredo e a conta de serviço.

## Passo 5 — Nova revisão do Cloud Run com as roles novas, tráfego gradual

O quê: `gcloud run deploy` de `main` (já com a release) com o segredo montado em `/secrets/api.env`
(`AQUASTATS_ENV_FILE=/secrets/api.env`), as variáveis secretas atuais removidas, a conta de serviço nova,
`--no-traffic --tag candidata`; depois 10 % → 50 % → 100 % com verificação em cada degrau.
Verificação: o arranque recusa roles com BYPASSRLS (logs `Startup OK`); prova de acesso cruzado com duas contas
de teste sintéticas em equipas diferentes; latências e erros; o ledger grava sem afetar a cronometragem.
Reversão: tráfego 100 % para a revisão anterior (que continua com `aquastats_app`).

## Passo 6 — Fechar a origem do Cloud Run (`EDGE_AUTH_TOKEN`)

O quê: `npx wrangler secret put EDGE_AUTH_TOKEN` (mesmo valor do segredo) e novo deploy do Worker; a API já o
lê do segredo do passo 4.
Verificação: `curl` ao URL direto do Cloud Run → 403; `https://aquastats.net/api/v1/health` → 200.
Reversão: apagar o segredo do Worker e remover `EDGE_AUTH_TOKEN` do segredo da API (nova versão).

## Passo 7 — Interruptores de ML

`ML_CHAMPION=atual` (o treinador vê o mesmo modelo de hoje), `ML_SHADOW` ligado, `ML_YEAR_ANCHORS` desligado
(`npx wrangler secret put …`). Reversão: `ML_SHADOW=off`.

## Passo 8 — Verificação em produção e vigilância 24–48 h

Smoke tests (login, criar treino, cronometrar, competições, análise), acesso cruzado, health, latências, erros,
ledger. Gatilhos de reversão: qualquer resposta com dados de outra equipa; taxa de 5xx > 1 % em 15 min;
`/snapshot` p95 > 2× a linha de base; falha de gravação de tempos.

## Passo 9 — Fecho de segurança (depois de 7 dias sem incidentes)

1. Rodar a password de `aquastats_app` (fica sem uso, só para reverter) logo após o passo 5.
2. **Rodar a password do owner `neondb_owner`** (estava no `.env` local e numa branch de dados reais já apagada).
3. **Revogar a role antiga `aquastats_app`** ao fim de 7 dias: `REVOKE … ; DROP ROLE aquastats_app;` (Neon
   consola, porque foi criada pela consola).
4. Remover da API a variável `DATABASE_URL` antiga e as variáveis simples que passaram para o segredo.

## Passo 10 — Interruptores gratuitos nas consolas (opcional, sem código)

Cloudflare: *WAF managed rules*, *Bot Fight Mode*, DNSSEC. Resend + DNS: SPF/DKIM/DMARC de `aquastats.net`.
Neon: confirmar retenção do histórico (PITR 6 h no plano gratuito) depois de cada passo que toca na base.
