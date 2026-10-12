# Registo de alterações

## [Por lançar]

### Produto para o treinador
- Perfil do atleta "Que nadador é e o que treinar agora?": nível por pontos WA, CSS, zonas pessoais, aderência de
  intensidade, queda de ritmo e sinais de treino com dado, razão, incerteza e alternativa (ADR 0004).
- Época: distribuição de zonas da equipa vs referência indicativa da fase.
- Fiabilidade do modelo passa para "Como se calculou".
- `lib/indicators.ts` com testes; documentação em `docs/natacao/` (referências com fontes, gerador, indicadores,
  produto, guia do treinador).

### Dados sintéticos
- Gerador 4.0: 6 níveis (iniciação a elite) ancorados em pontos World Aquatics, razões de distância e estilo dos
  recordes mundiais, zonas na CSS 200/400, todas as reps dos presentes cronometradas, faltas registadas, parciais e
  reação, grupos de treino por nível, teste CSS de 7 em 7 semanas; invariantes G1–G8 no CI.
- Corrige: blocos com vários segmentos só simulavam o 1.º.

### Modelo
- v1.0.1: corrige uma fuga (o prior de fadiga de um atleta novo usava séries de colegas do mesmo dia).

## [1.0.0] — 2026-10-11

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
- Snapshot em janela (42 dias primeiro, pedidos no `<head>`; competições incluídas), gzip fora do *event loop*,
  recordes em SQL; modelo num Web Worker; índices duplicados removidos (migração 014); logótipos WebP.
  Medido localmente, com dados sintéticos: matriz com LCP de 5,6 → 3,8 s e `PUT /times` p95 com leituras
  pesadas de 375 → 121 ms (`docs/release/desempenho.md`).
- Etiqueta "Volume total" no atleta: o valor é o de todas as épocas, não o do treino do dia.

### Produto
- Fase E: carga A:C ao longo do tempo, mesociclos, comparação de períodos, planeado vs. feito, semana do atleta.
- "Hoje": quem merece atenção e a ação sugerida; nota de privacidade do atleta; tabelas alternativas aos gráficos;
  alvos de toque de 44 px no login.

### Modelo
- Modelo de estado v1.0 em sombra, ledger imutável de previsões (migração 010), backtest e ficha do modelo.
