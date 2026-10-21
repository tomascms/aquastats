# Controlos e limites

Legenda: ✅ em vigor em produção · 🟡 feito na branch, à espera da Fase G · ⏳ por fazer.

## Autenticação e sessões

| Controlo | Estado |
|----------|--------|
| Passwords argon2id (t=3, m=64 MiB, p=2); verificação fictícia quando a conta não existe (tempo constante) | ✅ |
| Mínimo 12 caracteres com letras e números nas passwords novas; lista de comuns (PT incluídas) | 🟡 |
| Mensagem única em qualquer falha de login (sem enumeração) | 🟡 |
| Bloqueio de 15 min após 8 falhas | ✅ (Turnstile no login trava o abuso automático, quando ligado) |
| Access token HMAC-SHA256 de 15 min, invalidado no logout e na mudança ou reposição da palavra-passe (`token_version`); refresh rotativo com deteção de reutilização (revoga a família) | ✅ |
| Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, `path=/` | ✅ |
| Eliminar conta exige "ELIMINAR" + password ou login recente (< 5 min) | ✅ |
| Links de aprovação de treinador assinados com validade | ✅ |
| Registo sem enumeração: resposta igual com ou sem conta; o dono existente é avisado por email (#15) | 🟡 |
| Menores de 13: dados de saúde só com autorização parental por link assinado (7 dias), revogável | 🟡 |
| Contas inativas há 3 anos apagadas, com aviso 30 dias antes (job com `x-cron-key`) | 🟡 |

## Pedidos

| Controlo | Estado |
|----------|--------|
| CSRF por Origin/Referer em todas as mutações | ✅ |
| CORS só `aquastats.net` em produção | ✅ |
| Limite de corpo 1 MB (15 MB codificados para ficheiros de provas e FC) | ✅ |
| Validação Pydantic `extra=forbid` nos endpoints críticos | ✅ |
| `next=` sem `//`, `://`, `\` nem caracteres de controlo | 🟡 (controlo novo) |
| `X-Request-Id` do cliente só se for um token simples | 🟡 |
| Rate limit: edge (Cache API, por *colo*, aproximado) + API (memória por instância, limpa) | ✅ / 🟡 |
| Origem Cloud Run só para o Worker (`EDGE_AUTH_TOKEN`) | 🟡 código e teste; ligar = passo 6 |
| SSRF: só HTTPS/443, IPs privados/loopback/link-local recusados | ✅ |

## Cabeçalhos

API: `X-Content-Type-Options`, `X-Frame-Options DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP/COEP,
`Cache-Control: no-store`, HSTS 2 anos com `preload`. Site: os mesmos + CSP (`frame-ancestors 'none'`,
`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`) com `script-src 'nonce-…' 'strict-dynamic'`: um nonce
novo por pedido em `middleware.ts`, sem `unsafe-inline` nos scripts (os estilos inline continuam permitidos) ✅.
Login e registo: Cloudflare Turnstile verificado na edge, ligado com `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` ✅.

## Base de dados

Ver [rls.md](rls.md). `statement_timeout` 30 s; SSL obrigatório; migrações versionadas e ensaiadas no staging;
a API recusa arrancar contra a produção fora de `APP_ENV=production` e, em produção, com roles que contornem a RLS.

## Segredos

| Controlo | Estado |
|----------|--------|
| Nenhum segredo no histórico do git (gitleaks 8.30.1: 93 commits, 0 fugas; também no CI) | ✅ / 🟡 CI |
| `.env*` ignorados; ficheiros de credenciais só com `git check-ignore` confirmado | ✅ |
| Um segredo no Secret Manager montado como ficheiro + conta de serviço própria | ⏳ passo 4 (gratuito) |
| Rotação do owner do Neon e revogação da role antiga | ⏳ passo 9 |

## Dependências

PR #14: Next 16.3.8, starlette 1.7.0, PyJWT 2.15.1, cryptography 50.0.2, pypdf 6.19.0 → `pip-audit` limpo,
`npm audit` de produção limpo. Restam 5 avisos altos só de desenvolvimento (`braces` via `eslint-config-next`)
sem versão corrigida. CI: `pip-audit` e `npm audit --omit=dev` bloqueiam; Dependabot agrupado.
Limite: CodeQL e *dependency review* exigem GitHub Advanced Security em repositórios privados (pago) → ativar
quando/se o repositório for público.

## Limites conhecidos (resumo honesto)

1. Nada disto protege a produção antes da Fase G (role, migrações, token da edge, segredos).
2. A RLS protege contra bugs da app; SQL injection nos fluxos de autenticação (`aquastats_auth`) continuaria grave.
3. Endpoint do Neon acessível da internet (sem *allowlist*: o Cloud Run não tem IP de saída fixo sem custo).
4. Rate limit distribuído aproximado (sem Redis).
5. CSP permite estilos inline (`style-src 'unsafe-inline'`); os scripts não.
6. Sem pentest independente; sem monitorização de segurança dedicada.
