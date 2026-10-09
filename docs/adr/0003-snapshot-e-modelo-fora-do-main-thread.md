# ADR 0003 — Snapshot em janela e modelo fora do main thread

- Estado: aceite
- Data: 08/10/2026

## Contexto

O site carrega a equipa inteira (`GET /snapshot`) e corre o modelo no browser. Com 32 atletas × 4 épocas
(sintético): 4,97 s e 39 MB por pedido; o modelo bloqueava a matriz de cronometragem ~10 s num telemóvel simulado.

## Decisão

- Tempos em JSON gerado pelo Postgres, corpo escrito sem re-serializar, gzip, filtro do atleta em SQL.
- `since`/`before` por data do treino: o site mostra os últimos 120 dias e junta o resto em segundo plano.
- Modelo num Web Worker (`lib/ml/ml.worker.ts`); o ledger só grava com o histórico completo.
- Bulkhead: no máximo 2 snapshots em construção por instância.

## Alternativas

- **Sincronização incremental com cache no dispositivo (IndexedDB):** melhor a prazo, exige *tombstones* para
  apagamentos; adiada.
- **Modelo no servidor:** tiraria trabalho ao telemóvel, mas o modelo é TypeScript e está congelado (v1.0).

## Consequências

Medido: snapshot 4 965 → 1 867 ms (janela: 604 ms), atleta 2 689 → 681 ms, TBT da matriz 10 331 → 610 ms, LCP
21,8 → 10,0 s. O resto do LCP é transferência em 4G simulada; próximo passo é a sincronização incremental.
