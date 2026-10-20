# Isolamento na base de dados (RLS)

## Roles

| Role | Para quê | Atributos | Pode contornar a RLS? |
|------|----------|-----------|-----------------------|
| `aquastats_api` (011) | Todos os pedidos de equipa | sem SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION; não pertence a nenhuma role; timeouts 30 s / 60 s / 10 s | **Não**, nem definindo `app.bypass_rls` |
| `aquastats_auth` (012) | Login, registo, tokens, convites, callback Polar, eliminar conta | iguais | Só com `app.bypass_rls=true` (definido pela própria app nesses fluxos) |
| `aquastats_app` (antiga) | Produção até à Fase G | BYPASSRLS, CREATEROLE, CREATEDB, membro de `neon_superuser` | Sim (é o problema) → revogada 7 dias após a troca |
| `neondb_owner` | Migrações (operador) | owner, BYPASSRLS | Sim |

As roles novas são criadas por SQL (a consola do Neon põe as suas roles em `neon_superuser`). Passwords nunca no
repositório: `scripts/role_credentials.py` + `ALTER ROLE … LOGIN PASSWORD` pelo operador.

## Contexto de cada pedido

1. A sessão assinada identifica o utilizador → `app.user_id` (vê a própria conta, memberships e fichas de atleta).
2. A membership dá a equipa → `app.team_id`, `app.role` (`coach` | `swimmer`).
3. Atleta: `app.athlete_id` = a sua ficha.
Variáveis `SET LOCAL` (transação): não passam de um pedido para outro na pool.

## Matriz (o que cada papel vê; testada em `apps/api/tests/postgres/test_rls_matrix.py`)

| Tabela(s) | Treinador da equipa | Atleta da equipa | Outra equipa / sem contexto |
|-----------|--------------------|------------------|-----------------------------|
| `teams`, `organizations` | a sua | a sua | nada |
| `team_members` | da equipa | da equipa + as suas | nada |
| `athletes` | da equipa | **só a sua ficha** | nada |
| `time_logs`, `meet_entries`, `meet_results`, `personal_records`, `race_sessions`, `goals`, `hr_sessions`, `polar_links`, `prediction_ledger` | da equipa | **só as suas** | nada |
| `workouts`, `competitions`, `season_plans`, `attendance_sessions` | da equipa | da equipa (a app filtra o que mostra) | nada |
| `audit_logs`, `outbox_events`, `team_invites` | da equipa | **nada** | nada |
| `users` | a própria + contas da equipa | a própria + treinadores | nada |
| `profiles`, `refresh_tokens`, `password_reset_tokens`, `email_verification_tokens`, `oauth_accounts`, `idempotency_keys` | só as suas | só as suas | nada |
| `parental_consents` (016) | as da equipa, só leitura | só a sua, só leitura | nada (escreve só `aquastats_auth`) |
| `oauth_states`, `saga_instances`, `saga_logs` | nada (só `aquastats_auth`) | nada | nada |
| `schema_migrations` | sem permissão | sem permissão | — |

Escritas: `WITH CHECK` igual à leitura — não se escreve para outra equipa nem (atleta) para outro atleta.
`prediction_ledger`: a API só tem SELECT/INSERT; UPDATE/DELETE recusados por permissão e por trigger; as linhas
saem por cascata quando se apaga o atleta, o treino, a equipa ou a conta.

## Exceções legítimas (`aquastats_auth` + `app.bypass_rls`)

Login, registo, confirmação de email, reposição de password, refresh/logout, escolher papel, aceitar convite
(`/auth/join`), sair da equipa (com ou sem purga), mudar password, eliminar conta (apaga tudo o que é do
utilizador em qualquer equipa e entrega o resto ao dono da equipa), pedidos de conta de treinador e aprovação
por link assinado, callback do Polar (estado assinado). Todas em `routes/auth_routes.py`,
`routes/coach_request_routes.py` e `routes/integration_routes.py::polar_callback`.

## Como é testado

`TEST_ADMIN_DATABASE_URL` (Postgres local ou o serviço do CI, nunca o Neon) — 40 testes:
matriz por tabela e ator; rotas entre equipas (403/404); diferencial "role nova = superuser" no snapshot;
RLS quando o código pede a equipa errada; fluxos de escrita de treinador e atleta; apagamentos com o ledger;
a role da API não contorna com a flag; a role da API não pertence à de autenticação. Ensaio das migrações
005–012 no staging Neon (PostgreSQL 18, como `neondb_owner`).
