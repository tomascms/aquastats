# Aquastats

Plataforma de análise de natação para treinadores e atletas — tempos, treinos, provas e previsões.

- Site: https://aquastats.net
- Repositório privado: nunca fazer commit de segredos (`.env`, credenciais, chaves).

## Estrutura

```
apps/
  api/                  FastAPI (Python 3.12) → Google Cloud Run
    src/app/
      core/             config, base de dados, segurança, sessões, rate limit
      domain/           modelos, comandos, consultas, previsões
      routes/           endpoints HTTP (/api/v1/...)
      schemas/          validação de payloads (Pydantic)
      webhooks/         webhooks externos (Stripe)
    db/
      schema.sql        schema PostgreSQL completo
      migrations/       migrações SQL versionadas (aplicadas automaticamente só em dev)
    tests/
    Dockerfile
  web/                  Next.js 16 + Tailwind 4 → Cloudflare Workers (OpenNext)
    src/
      app/              rotas (App Router)
      components/       componentes por domínio + ui/
      lib/              lógica de cliente, API, store
    public/
    wrangler.jsonc      configuração do Worker (domínios, variáveis)
docs/                   segurança e hardening de produção
.github/                CI (testes API, lint/typecheck/build web)
docker-compose.yml      Postgres + Redis + Mailpit para desenvolvimento local
```

## Desenvolvimento local

```bash
docker compose up -d                      # Postgres (com schema), Redis, Mailpit

cd apps/api
cp .env.example .env                      # preencher DATABASE_URL e SESSION_SECRET
pip install -r requirements-dev.txt
PYTHONPATH=src uvicorn app.main:app --reload --port 8000
PYTHONPATH=src pytest

cd apps/web
cp .env.example .env.local
npm install
npm run dev                               # http://localhost:3000
```

## Deploy

Deploy contínuo a partir do branch `main`:

| Serviço | Plataforma | Build |
|---|---|---|
| Web | Cloudflare Workers `aquastats-web` (Workers Builds ligado ao GitHub) | raiz `apps/web`, `npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy` |
| API | Google Cloud Run `aquastats-api` (us-central1, trigger Cloud Build ligado ao GitHub) | `apps/api/Dockerfile` |
| Base de dados | Neon Postgres | — |

Variáveis de produção e segredos vivem apenas nas plataformas (Cloud Run → Variables & Secrets; Cloudflare → Worker → Settings). Ver [docs/production-hardening.md](docs/production-hardening.md) e [docs/security.md](docs/security.md).

Pagamentos (Stripe) estão desligados por omissão: ativar com `BILLING_ENABLED=true` na API.
