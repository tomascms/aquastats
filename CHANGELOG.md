# Registo de alterações

## [Por publicar] — release/hardening

### Segurança
- Roles `aquastats_api` (sem BYPASSRLS) e `aquastats_auth` (só autenticação); RLS por equipa e por papel; o atleta
  só vê os seus dados; a API recusa roles que contornem a RLS (migrações 011–012).
- Next.js 16.3.8 (GHSA-vcvr-r3jv-pc5j), starlette 1.7.0, PyJWT 2.15.1, cryptography 50.0.2, pypdf 6.19.0.
- Login sem enumeração, passwords novas com 12+ caracteres, `next=` sem caracteres de controlo, IPs validados.
- A API recusa arrancar contra a base de produção fora de `APP_ENV=production`.

### Fiabilidade
- Gravação de tempos num só upsert ordenado pela hora da edição (migração 013); previsões sem duplicados.
- Timeouts Worker→API (504), orçamento de 25 s nos resultados ao vivo, bulkhead nos snapshots, logs JSON.

### Desempenho
- Snapshot 2,7× mais rápido (treinador) e 4× (atleta), gzip, janela de 120 dias; modelo num Web Worker;
  índices duplicados removidos (migração 014); logótipos WebP.

### Produto
- "Hoje": quem merece atenção e a ação sugerida; nota de privacidade do atleta; tabelas alternativas aos gráficos;
  alvos de toque de 44 px no login.

### Modelo
- Modelo de estado v1.0 em sombra, ledger imutável de previsões (migração 010), backtest e ficha do modelo.
