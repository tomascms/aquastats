# API

FastAPI (Python 3.12) sobre PostgreSQL 18 (Neon) com isolamento por RLS. Corre no Cloud Run (`europe-west3`).
É a única peça que fala com a base de dados: o site nunca lhe acede diretamente.

## O que faz

- **Autenticação:** registo e login por email (argon2id, bloqueio progressivo, mensagens sem enumeração),
  Google OAuth, repor palavra-passe, convites de equipa, pedidos de papel de treinador.
- **Dados da equipa:** atletas, treinos, tempos (gravação idempotente e ordenada), competições, inscrições,
  resultados, épocas, objetivos, bem-estar, frequência cardíaca.
- **Ficheiros oficiais:** importa Lenex e PDF (SPLASH, regulamentos); a leitura por IA devolve também o
  Markdown e a API valida cada valor contra o texto antes de o aceitar.
- **Integrações:** SwimRankings (recordes), Polar (frequência cardíaca), resultados ao vivo, email (SMTP).
- **Previsões:** ledger imutável das previsões do modelo (o modelo corre no browser; a API guarda e compara).

## Estrutura

```
src/app/
  main.py          aplicação, middlewares, arranque
  core/            configuração, sessões, RLS (rls.py, tenant.py), passwords, rate limit, SSRF, idempotência,
                   segurança HTTP, email, observabilidade, verificações de arranque
  domain/          regras: comandos e consultas, Lenex, SPLASH, regulamentos (meet_rules*), SwimRankings, Polar,
                   frequência cardíaca, objetivos, previsões, transferência de atletas, outbox
  routes/          auth_routes, data_routes, coach_request_routes, integration_routes
  schemas/         modelos de entrada e saída
db/
  schema.sql       esquema base
  migrations/      001–014, numeradas e aplicadas por ordem (RLS, roles, ledger, índices…)
scripts/           build_local_db, seed_synthetic, load_test, gestão de credenciais das roles
tests/             pytest (unidade e segurança) e tests/postgres (RLS, cascatas e corridas contra Postgres real)
```

## Isolamento de dados (RLS)

Duas roles de base de dados, sem `BYPASSRLS`:

| Role | Usada por | Pode |
|---|---|---|
| `aquastats_api` | pedidos autenticados | ler e escrever só as linhas da equipa e do utilizador da sessão |
| `aquastats_auth` | registo, login, convites | apenas o necessário para autenticar |

Em cada pedido a API define `app.user_id`, `app.team_id` e `app.role` na transação; as políticas
(`002`, `009`, `010`, `011`) filtram por esses valores. Sem contexto, uma consulta devolve 0 linhas.
Detalhe e limites conhecidos: [../../docs/security/rls.md](../../docs/security/rls.md).

## Correr e testar

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
python scripts/build_local_db.py postgresql://postgres@127.0.0.1:5432/postgres aquastats_demo
cp .env.example .env     # base local; o arranque recusa a base de produção
DATABASE_ENABLE_RLS=true PYTHONPATH=src .venv/Scripts/uvicorn app.main:app --reload --port 8000

.venv/Scripts/python.exe -m pytest tests/ -q     # TEST_ADMIN_DATABASE_URL liga também a suite de RLS
```

Dados de demonstração e passos completos: [README da raiz](../../README.md#correr-localmente-com-dados-sintéticos).
Deploy, reversão e restauro: [../../docs/runbooks.md](../../docs/runbooks.md).
