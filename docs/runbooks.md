# Runbooks

Comandos oficiais apenas (sem scripts de deploy próprios). Projeto GCP `gen-lang-client-0997549665`, serviço
`aquastats-api` (`europe-west3`), Worker `aquastats-web`, Neon `polished-fog-70080186` (branch `production`).
Qualquer passo em produção só com autorização explícita do dono.

## Deploy pelo GitHub (caminho principal)

O workflow [`deploy.yml`](../.github/workflows/deploy.yml) chama os comandos oficiais diretamente (`opennextjs-cloudflare`,
`wrangler`, `gcloud`), sem scripts próprios. **Só arranca à mão, e esse clique é a aprovação do dono:** no GitHub
Free, um repositório privado não tem *Environments* nem *required reviewers* (só em repositórios públicos ou no
GitHub Enterprise). Só quem tem escrita no repositório pode arrancá-lo, e o GCP só aceita este workflow, em `main`,
arrancado à mão.

1. Fazer merge do PR em `main` e esperar pelo CI verde. Se o CI não estiver verde, o workflow recusa publicar.
2. Se o merge trouxer uma migração, aplicá-la primeiro (ver [Migrações](#migrações)).
3. Abrir **Actions → Deploy → Run workflow** em `main`, marcar **Publicar em produção** e carregar em **Run
   workflow**. Pelo terminal: `gh workflow run deploy.yml -f publicar=true`. Para publicar as três partes, mesmo as
   que não mudaram, marcar também **tudo** (`-f tudo=true`).
4. O workflow publica só as partes que mudaram desde a última publicação com sucesso (API, site, Worker de IA). A
   API vai primeiro; o site só avança se a API não falhar.
5. Cada parte é verificada no fim: a revisão do Cloud Run com 100 % do tráfego tem a etiqueta `commit-sha` deste
   commit; a versão do Worker com 100 % do tráfego tem a *tag* com os 12 primeiros caracteres do commit;
   `https://aquastats.net/api/v1/health` devolve `aquastats-api`; `/api/v1/health/ready` devolve `ok`; `/entrar`
   devolve 200. Se alguma verificação falhar, o job falha e o resumo da execução diz como reverter.
6. No fim, confirmar no site: login, criar treino, cronometrar, competições.

**Ensaio** (não publica nada): o mesmo **Run workflow** sem marcar **Publicar**, ou `gh workflow run deploy.yml`.
Faz o build do site com `opennextjs-cloudflare build`, `deploy --dry-run` do site e do Worker de IA, e o
`docker build` da imagem da API. Também corre sozinho em cada PR que mexa no `deploy.yml`.

### Configuração (uma vez, pelo dono)

Nenhum valor secreto entra no repositório nem no chat. Cada passo na conta do dono é feito por ele, ou por mim com
`gcloud` só depois de ele escrever "autorizo" para esse passo.

**1. GCP: Workload Identity Federation e conta de serviço** (sem chaves; custo 0 €). Num terminal com `gcloud`:

```bash
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project gen-lang-client-0997549665
gcloud iam workload-identity-pools create github --location global --display-name "GitHub Actions" --project gen-lang-client-0997549665
gcloud iam workload-identity-pools providers create-oidc aquastats-privado --location global --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" --attribute-condition "assertion.workflow_ref == 'tomascms/aquastats-privado/.github/workflows/deploy.yml@refs/heads/main' && assertion.event_name == 'workflow_dispatch'" --project gen-lang-client-0997549665
gcloud iam service-accounts create github-deploy --display-name "Deploy pelo GitHub" --project gen-lang-client-0997549665
gcloud projects add-iam-policy-binding gen-lang-client-0997549665 --member serviceAccount:github-deploy@gen-lang-client-0997549665.iam.gserviceaccount.com --role roles/run.sourceDeveloper --condition None
gcloud projects add-iam-policy-binding gen-lang-client-0997549665 --member serviceAccount:github-deploy@gen-lang-client-0997549665.iam.gserviceaccount.com --role roles/serviceusage.serviceUsageConsumer --condition None
gcloud iam service-accounts add-iam-policy-binding aquastats-api@gen-lang-client-0997549665.iam.gserviceaccount.com --member serviceAccount:github-deploy@gen-lang-client-0997549665.iam.gserviceaccount.com --role roles/iam.serviceAccountUser --project gen-lang-client-0997549665
gcloud iam service-accounts add-iam-policy-binding github-deploy@gen-lang-client-0997549665.iam.gserviceaccount.com --role roles/iam.workloadIdentityUser --member "principalSet://iam.googleapis.com/projects/445938662978/locations/global/workloadIdentityPools/github/attribute.repository/tomascms/aquastats-privado" --project gen-lang-client-0997549665
```

Papéis mínimos de deploy a partir do código: Cloud Run Source Developer e Service Usage Consumer no projeto, e
Service Account User só na conta de serviço da API (`aquastats-api@…`). O build usa a conta do Cloud Build que já
hoje faz os deploys. O pool e a conta de serviço já estão escritos no `deploy.yml`. Se o nome de algum mudar, o
`deploy.yml` tem de mudar também.

**2. Cloudflare: token com permissão mínima.** Painel → *Manage Account* → *Account API Tokens* → *Create Token* →
*Custom token*: *Account* → *Workers Scripts* → *Edit*. Se o painel deixar, limitar o token aos Workers
`aquastats-web` e `aquastats-ai`. Não precisa de *Workers Routes*, porque os domínios `aquastats.net` e
`www.aquastats.net` já estão ligados e o deploy não os altera. Copiar o valor do token só para o passo 3.

**3. GitHub: segredo e variável** (Settings → Secrets and variables → Actions):

- *Secrets* → *New repository secret* → `CLOUDFLARE_API_TOKEN` = o token do passo 2.
- *Variables* → *New repository variable* → `CLOUDFLARE_ACCOUNT_ID` = o *Account ID* (painel da Cloudflare,
  página do Worker, lado direito). Não é secreto.

Num repositório privado do GitHub Free, os segredos são do repositório e não de um *Environment*. Só os workflows
deste repositório os leem, e nunca os PRs de *forks* nem do Dependabot.

**4. Primeiro deploy:** fazer um ensaio (`gh workflow run deploy.yml`) e depois publicar com **tudo**
(`gh workflow run deploy.yml -f publicar=true -f tudo=true`). Sem uma publicação anterior, o workflow publica as três
partes.

Se um dia o repositório passar para um plano com *required reviewers* em repositórios privados, basta acrescentar
`environment: production` aos jobs `api`, `web` e `ai` e criar esse Environment com o dono como revisor.

## Deploy manual (alternativa, a partir do PC)

```bash
# API, a partir de apps/api (a revisão nova só recebe tráfego se arrancar)
gcloud run deploy aquastats-api --source . --region europe-west3 --project gen-lang-client-0997549665 --quiet
# Site, a partir de apps/web
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
# Worker de IA, a partir de apps/ai-worker
../web/node_modules/.bin/wrangler deploy
```

Se um antivírus intercetar o TLS no PC, `NODE_EXTRA_CA_CERTS` tem de apontar para o certificado dele antes dos
comandos. O deploy pelo GitHub não tem este problema.

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
cd apps/ai-worker && ../web/node_modules/.bin/wrangler rollback
```

Depois de uma reversão com `--to-revisions`, o tráfego fica preso a essa revisão e os deploys seguintes não recebem
tráfego (a verificação do workflow falha). Para voltar ao normal: `gcloud run services update-traffic aquastats-api
--to-latest --region europe-west3 --project gen-lang-client-0997549665`.

Modelo de previsão: `npx wrangler secret put ML_CHAMPION` com `atual` (reverte já, sem rebuild); `ML_SHADOW=off`
para parar o desafiante.

## Migrações

1. Ensaiar na branch `staging-hardening` (só esquema): as instruções da migração numa transação.
2. Anotar a hora (ponto de restauro; PITR do plano gratuito = 6 h).
3. Aplicar na produção, numa transação, como `neondb_owner`; registar em `schema_migrations`.
4. Verificar no catálogo (roles, políticas, colunas).

A migração 017 (RGPD) tem de ser aplicada **antes** do deploy da API que a usa: o modelo `User` lê
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
