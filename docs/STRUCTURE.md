# Estrutura do repositório

```
/
├── api/                 # Backend FastAPI
│   ├── src/app/         # Código da API (routes, domain, core)
│   ├── tests/
│   ├── db/              # Cópia do schema para Docker local
│   └── requirements.txt
├── web/                 # Frontend Next.js (Cloudflare Workers)
│   ├── src/
│   │   ├── app/         # App Router (páginas)
│   │   ├── components/
│   │   └── lib/
│   └── public/
├── data/                # Schema SQL canónico + dados partilhados
├── docs/                # Documentação interna (incl. SECURITY.md)
├── infra/               # Ferramentas de infra (Neon preview, etc.)
│   └── neon/
├── scripts/             # Scripts operacionais (OAuth, DNS, manutenção)
│   └── api/
└── .deploy-venv/      # Local only — deploy Cloud Run (gitignored)
    ├── cloudrun_deploy.py
    └── cloudrun_redeploy_env.py
```

## Comandos locais

```bash
# API
cd api && PYTHONPATH=src python -m uvicorn app.main:app --reload --port 8000

# Web
cd web && npm run dev
```

## Schema

Fonte canónica: `data/schema.sql`. Após alterações, sincroniza `api/db/schema.sql` se usares `api/Dockerfile` local.
