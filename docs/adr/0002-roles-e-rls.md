# ADR 0002 — Duas roles na base e RLS que se aplica de facto

- Estado: aceite (implementado na branch `release/hardening`; produção na Fase G)
- Data: 06/10/2026

## Contexto

A API ligava-se como `aquastats_app`, criada na consola do Neon, que a pôs em `neon_superuser` com BYPASSRLS: todas
as políticas eram ignoradas e o isolamento entre equipas dependia só do código. Além disso, o desvio da RLS era uma
variável de sessão (`app.bypass_rls`) que qualquer role pode definir.

## Decisão

1. `aquastats_api` (migração 011), criada por SQL: sem BYPASSRLS/CREATEROLE/CREATEDB, permissões tabela a tabela,
   ledger só SELECT/INSERT. Políticas por equipa e por papel (o atleta só vê o seu).
2. `aquastats_auth` (migração 012): única role para a qual `app_bypass_rls()` pode ser verdadeiro; usada só nos
   fluxos de autenticação (login, registo, tokens, convites, callback Polar, eliminar conta).
3. A API usa duas ligações (`DATABASE_URL`, `AUTH_DATABASE_URL`) e recusa arrancar em produção se alguma role
   contornar a RLS ou se a role da API pertencer à de autenticação.

## Alternativas

- **Retirar BYPASSRLS à role antiga:** não chega, continua em `neon_superuser` (`pg_write_all_data`).
- **Uma só role com a flag:** SQL injection num pedido normal desligaria o isolamento.
- **`SET ROLE` dinâmico:** reversível pelo próprio SQL injetado.

## Consequências

Duas credenciais a gerir (um único segredo no Secret Manager, ver plano da Fase G); `pg_trigger_depth` e permissões
mantêm o ledger imutável sem bloquear o direito ao apagamento. Suite `tests/postgres` (matriz por tabela e ator,
rotas, diferencial com superuser, cascatas, corridas) tem de passar em cada PR.
