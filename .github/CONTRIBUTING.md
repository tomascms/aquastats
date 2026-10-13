# Contributing

The code is proprietary ([LICENSE](../LICENSE)): outside contributions only with the owner's written agreement.
Bug reports and ideas are welcome as issues.

## Project rules

- Feature branches and a PR to `main`; nothing reaches `main` without a reviewed PR. No force pushes.
- Small commits with imperative messages. Never secrets, `.env` files or real swimmer data (demos use the
  synthetic data from `apps/web/scripts/export-synthetic.ts`).
- The UI is European Portuguese with full English: every new `t("...")` needs its key in
  `apps/web/src/i18n/en.ts`. Dates are always dd/mm/yyyy (`DateField`).
- New tables: RLS and `GRANT` in a migration, and a row in `apps/api/tests/postgres/test_rls_matrix.py`.
- Before a PR: `pytest` (with `TEST_ADMIN_DATABASE_URL` for the Postgres suite), `npm test`,
  `npx next typegen && npx tsc --noEmit`, `npm run lint`, `npx opennextjs-cloudflare build`.
- The prediction model is frozen at v1.0: any change is a new version, pre-registered in `docs/ml/`.
