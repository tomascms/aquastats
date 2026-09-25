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

| Serviço | Plataforma | Comando (a partir da pasta indicada) |
|---|---|---|
| Web | Cloudflare Workers `aquastats-web` → aquastats.net | `apps/web`: `npm run deploy` (com `APP_URL=https://aquastats.net`) |
| API | Google Cloud Run `aquastats-api` (us-central1, projeto `gen-lang-client-0997549665`) | `apps/api`: `gcloud run deploy aquastats-api --source . --region us-central1` |
| Base de dados | Neon Postgres | — |

O Cloud Run mantém as variáveis de ambiente entre revisões e só muda o tráfego se a nova revisão arrancar.

Variáveis de produção e segredos vivem apenas nas plataformas (Cloud Run → Variables & Secrets; Cloudflare → Worker → Settings). Ver [docs/production-hardening.md](docs/production-hardening.md) e [docs/security.md](docs/security.md).

Pagamentos (Stripe) estão desligados por omissão: ativar com `BILLING_ENABLED=true` na API.
