# Contribuir

Código proprietário ([LICENSE](LICENSE)): contribuições externas só com acordo escrito do titular.

## Regras do projeto

- Branches de funcionalidade e PR para `main`; nada vai para `main` sem PR aprovado. Sem *force push*.
- Commits pequenos, mensagem no imperativo; nunca segredos, `.env` ou dados reais de atletas (demonstração =
  dados sintéticos de `scripts/export-synthetic.ts`).
- UI em português europeu com inglês completo: cada `t("...")` novo precisa da chave em `apps/web/src/i18n/en.ts`.
  Datas sempre dd/mm/aaaa (`DateField`).
- Tabelas novas: RLS + `GRANT` numa migração e classificação em `tests/postgres/test_rls_matrix.py`.
- Antes do PR: `pytest` (com `TEST_ADMIN_DATABASE_URL` para a suite Postgres), `npm test`, `npx next typegen &&
  npx tsc --noEmit`, `npm run lint`, `npx opennextjs-cloudflare build`.
- Modelo de previsão congelado em v1.0: mudanças são uma versão nova, pré-registada em `docs/ml/`.
