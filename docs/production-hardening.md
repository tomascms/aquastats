# Deploy — fundação de segurança

Checklist única para activar **defesa em profundidade** sem voltar a mexer na app quando escalar.

## Já activo (só deploy normal)

- Validação Pydantic estrita nos endpoints críticos (`times`, `athletes`, perfil nadador, delete account)
- `statement_timeout` 30s por ligação + idle transaction 60s
- Migrations versionadas (`schema_migrations`) — RLS policies aplicadas no arranque
- Rate limit **edge** (Cloudflare) em auth + writes API
- Rate limit **API** (in-memory; opcional Redis com `REDIS_URL`)
- CSRF Origin/Referer, cookies HttpOnly, refresh rotation, idempotency
- SSRF guard em OAuth Google
- Sentry opcional (`SENTRY_DSN`)
- Startup validation em produção (`TRUST_PROXY`, `SESSION_SECRET`, `APP_URL` https)

## Passo A — RLS na base (recomendado antes de BI / segundo serviço)

1. Neon SQL Editor:
   ```sql
   CREATE ROLE aquastats_app LOGIN PASSWORD 'gera-password-forte-aqui';
   ```
2. Deploy API (aplica migrations 001–003; 003 faz GRANT se o role existir).
3. Neon: copiar connection string pooled (porta **6543**) com user `aquastats_app`.
4. Cloud Run env:
   ```
   DATABASE_URL=postgresql://aquastats_app:...@...-pooler.../neondb?sslmode=require
   DATABASE_ENABLE_RLS=true
   TRUST_PROXY=true
   ```
5. Redeploy API. Ver logs: `Startup OK ... rls=True`.

**Nota:** O runtime já não aceita o owner Neon em produção. `neondb_owner` tem
`BYPASSRLS`, portanto a role limitada é obrigatória.

## Passo A.1 — Fechar o origin Cloud Run

Define o mesmo segredo aleatório em `EDGE_AUTH_TOKEN` no Cloud Run e como secret
`EDGE_AUTH_TOKEN` no Worker Cloudflare. O Worker envia `X-Edge-Auth` e a API
recusa chamadas diretas sem esse header. Faz o rollout nesta ordem:

1. Configura o secret na API e no Worker.
2. Publica o Worker e confirma `/api/v1/health/ready` pelo domínio.
3. Confirma que chamadas diretas ao hostname Cloud Run recebem `403`.
4. Remove exposição direta desnecessária do origin.

## Passo B — Observabilidade (opcional)

```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.05
```

## Passo C — Rate limit distribuído (escala multi-instância Cloud Run)

Upstash / Redis:

```
REDIS_URL=rediss://default:...@....upstash.io:6379
```

Sem Redis, edge + in-memory por instância continuam activos.
Os limites atuais foram mantidos; Redis serve para consistência entre réplicas.

## Passo D — Cloudflare (dashboard, uma vez)

| Item | Acção |
|------|--------|
| WAF managed rules | Security → WAF → Managed rules ON |
| Bot Fight Mode | Security → Bots |
| DNSSEC | DNS → Settings |
| Email SPF/DKIM/DMARC | Resend dashboard + DNS para `aquastats.net` |

## Passo E — Neon (dashboard)

- PITR / backups: Project → Backups
- IP allow list (opcional): só Cloud Run egress se souberes IPs fixos

## Variáveis de ambiente — referência

| Variável | Prod | Descrição |
|----------|------|-----------|
| `DATABASE_ENABLE_RLS` | `true` após passo A | Activa `SET LOCAL app.team_id` |
| `DB_STATEMENT_TIMEOUT_MS` | `30000` | Timeout queries |
| `RECENT_AUTH_SECONDS` | `300` | Re-auth OAuth delete account |
| `REDIS_URL` | opcional | Rate limit partilhado |
| `SENTRY_DSN` | opcional | Erros 5xx |

## Adicionar features novas

1. Tabela com `team_id` → incluir em `002_rls_policies.sql` (nova migration `004_...sql`).
2. Endpoint de escrita → schema Pydantic em `apps/api/src/app/schemas/payloads.py`.
3. Mutação destrutiva → exigir password ou sessão recente (padrão `delete-account`).
