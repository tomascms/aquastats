# Cloudflare (plano Free) — checklist Aquastats

Activa no dashboard [Cloudflare](https://dash.cloudflare.com) para `aquastats.net`:

## Segurança (grátis)

| Funcionalidade | Onde | Notas |
|---|---|---|
| **SSL/TLS Full (strict)** | SSL/TLS → Overview | Certificado origem Cloud Run |
| **Always Use HTTPS** | SSL/TLS → Edge Certificates | Redirect HTTP→HTTPS |
| **HSTS** | SSL/TLS → Edge Certificates | Já reforçado em `next.config.ts` e API |
| **Bot Fight Mode** | Security → Bots | Bloqueio básico de bots |
| **Security Level Medium** | Security → Settings | |
| **Email Routing** | Email → Routing | `contact@`, `confirmation@`, `security@` |
| **DNS proxied (laranja)** | DNS | Workers + proteção DDoS edge |

## Performance (grátis)

| Funcionalidade | Onde |
|---|---|
| **Auto Minify** | Speed → Optimization |
| **Brotli** | Speed → Optimization |
| **Early Hints** | Speed → Optimization |
| **`/_headers`** | Já em `web/public/_headers` — cache estático + headers |

## Workers (já configurado)

- `web/wrangler.jsonc` — observability ON, rotas custom domain
- Deploy: `cd web && npm run deploy`

## Opcional (quando quiseres)

- **Turnstile** — widget anti-bot em login (precisa site key no dashboard)
- **Rate limiting** — regras edge (limite baixo no free)

Código da app **não** guarda secrets Cloudflare — só variáveis no dashboard / Wrangler secrets.
