# API

FastAPI (Python 3.12) sobre Neon Postgres com RLS. Corre no Cloud Run (`europe-west3`).

```
src/app/   main.py, core/ (config, sessão, RLS), domain/ (regras), routes/, schemas/
db/        schema.sql e migrations/ (numeradas, sem lacunas)
scripts/   seed sintético, teste de carga, gestão de credenciais das roles
tests/     pytest; a suite de RLS precisa de TEST_ADMIN_DATABASE_URL
```

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
cp .env.example .env     # base local ou staging; o arranque recusa produção
PYTHONPATH=src .venv/Scripts/uvicorn app.main:app --reload --port 8000
.venv/Scripts/python.exe -m pytest tests/ -q
```

Roles: `aquastats_api` (pedidos de equipa, sujeita à RLS) e `aquastats_auth` (só autenticação).
Detalhe em [../../docs/security/rls.md](../../docs/security/rls.md). Deploy em [../../docs/runbooks.md](../../docs/runbooks.md).
