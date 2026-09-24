Schema canónico: [`../../data/schema.sql`](../../data/schema.sql).

O Dockerfile local (`api/Dockerfile`) espera `db/schema.sql`; copia ou symlink a partir de `data/` se precisares de build só dentro de `api/`.
