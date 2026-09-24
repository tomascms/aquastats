# Aquastats

App de treino de natação: treinador, atleta, tempos e estilos. Repositório **privado** — nunca commits secrets (`api/.env`, `web/.env.local`, credenciais GCP, etc.).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `web/src/` | Next.js — páginas, componentes, store |
| `api/src/app/` | FastAPI — auth, dados, segurança |
| `data/` | Schema PostgreSQL (`schema.sql`) |
| `docs/` | Planos e documentação |
| `infra/` | Ferramentas Neon preview (não produção) |
| `scripts/` | Setup OAuth, DNS, manutenção |

Ver [`docs/STRUCTURE.md`](docs/STRUCTURE.md) para detalhe.

## Correr em local

1. PostgreSQL (Neon). Corre `data/schema.sql` na base.
2. Copia `api/.env.example` → `api/.env` (`DATABASE_URL`, `SESSION_SECRET` ≥32 chars).
3. Copia `web/.env.example` → `web/.env.local`.
4. **API:** `cd api && set PYTHONPATH=src` (Windows) ou `PYTHONPATH=src` (Unix), depois `python -m uvicorn app.main:app --reload --port 8000`
5. **Site:** `cd web && npm run dev`

## Produção

Site: `https://aquastats.net` (Cloudflare Workers). API: Cloud Run. Base: Neon.

Variáveis sensíveis só no hosting — nunca no git. Ver `.gitignore` e [`docs/SECURITY.md`](docs/SECURITY.md).

### Deploy

```powershell
# API (Cloud Run) — requer AQUASTATS_GCP_PROJECT e api/.env
$env:AQUASTATS_GCP_PROJECT = "gen-lang-client-0997549665"
python .deploy-venv/cloudrun_deploy.py
python .deploy-venv/cloudrun_redeploy_env.py

# Web (Cloudflare)
cd web && npm run deploy
```
