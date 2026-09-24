# Segurança — Aquastats

Fundação **pronta para escalar**: novas features herdam isolamento, validação e rate limits. Só falta activar RLS (role Neon) e extras de infra (Sentry, Redis, WAF).

## Arquitectura

- **Web** (Cloudflare Workers): sem secrets no cliente; proxy same-origin para a API.
- **API** (Cloud Run): única superfície com acesso à base de dados.
- **Neon Postgres**: pooled 6543, SSL, timeouts.

## Camadas de defesa

| Camada | Estado | Notas |
|--------|--------|-------|
| Isolamento Python (`require_coach`, `_owned_*`) | ✅ | Sempre activo |
| RLS Postgres | ⚠️ runtime pendente | A API exige `aquastats_app` + `DATABASE_ENABLE_RLS=true` em produção |
| Validação Pydantic (`extra=forbid`) | ✅ | Times, athletes, perfil, delete |
| Rate limit edge (CF Cache API) | ✅ | Auth + writes |
| Rate limit API | ✅ | In-memory; Redis opcional |
| CSRF Origin/Referer | ✅ | Mutações |
| Cookies HttpOnly + Secure + SameSite=Lax | ✅ | |
| Idempotency-Key + audit_logs | ✅ | |
| SSRF outbound (Google OAuth) | ✅ | Allowlist hosts |
| Startup validation prod | ✅ | Secrets, HTTPS, TRUST_PROXY |
| Migrations versionadas | ✅ | `api/db/migrations/` |
| Sentry | ⚙️ opcional | `SENTRY_DSN` |
| Origin Cloud Run | ⚙️ preparado | `EDGE_AUTH_TOKEN` partilhado entre Worker e API |
| CSP strict (nonces) | 🔜 | `unsafe-inline` ainda no Next |
| Convites assinados com TTL | 🔜 | join codes estáticos hoje |

## Secrets

| Secret | Onde | Nunca |
|--------|------|-------|
| `DATABASE_URL` | Cloud Run / `api/.env` | Git, wrangler |
| `SESSION_SECRET` | Cloud Run | Git |
| `GOOGLE_CLIENT_SECRET` | Cloud Run | Git |
| SMTP / Resend | Cloud Run | Git, `.deploy-venv/` |

Rotação só quando pedido ou após exposição.

## RLS

Políticas em `api/db/migrations/002_rls_policies.sql`. Contexto por request:

- Auth: `app.bypass_rls=true` (`get_auth_session`)
- Dados equipa: `app.team_id` + `app.user_id` (`require_coach` / `require_member`)

Owner Neon **ignora** RLS — usar role `aquastats_app` em produção.

## Controlo de conta

- Palavra-passe: mínimo **12** caracteres, lista de passwords comuns bloqueada.
- Eliminar conta: confirmação `ELIMINAR` + password ou login recente (<5 min) para OAuth.

## Ficheiros locais — nunca commitar

- `.deploy-venv/`, `web/.next/`, `api/.env`, `*.pem`, credenciais JSON

## Próximo deploy de segurança

Seguir [DEPLOY-SECURITY.md](./DEPLOY-SECURITY.md) passos A–E (15–30 min, sem alterar código).
