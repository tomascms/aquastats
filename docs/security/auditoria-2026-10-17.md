# Auditoria de segurança — 2026-10-17

Âmbito: as Fases 1 a 4 estão concluídas. Na produção (Fase 3) só se fizeram verificações passivas. A Fase 4 correu
contra a API local ligada ao staging, com RLS ativa e as roles `aquastats_api`/`aquastats_auth`. Nada foi publicado.

Isto não é uma garantia de "segurança total". Foi uma revisão dirigida, não uma leitura linha a linha de todos os
ficheiros. O risco residual está no fim.

## Falhas corrigidas (código local, sem deploy)

| # | Gravidade | Falha | Onde | Correção | Teste |
|---|---|---|---|---|---|
| 1 | Média | Rate limit e IPs de auditoria viam o IP de saída do Worker e não o do utilizador. Um atacante a fazer ~80 POST/min em `/auth/*` dava 429 a todos (login, registo, reset e refresh em baixo), e o lockout por IP não fazia nada. | `apps/web/src/app/api/v1/[...path]/route.ts:9-19`, `apps/api/src/app/core/client.py` | O Worker envia `x-aquastats-client-ip` = `cf-connecting-ip`. A API só acredita nesse cabeçalho quando o `x-edge-auth` é válido (comparação em tempo constante), por isso um chamador direto não o consegue forjar. | `tests/test_client_ip.py` |
| 2 | Média | A verificação de "autenticação recente" usava `iat`, que o `/auth/refresh` renova. Com um cookie de refresh roubado: refresh, depois `change-password` sem `currentPassword`. Uma conta só-Google ficava com uma palavra-passe do atacante (tomada persistente), ou era apagada. | `core/sessions.py:43`, `routes/auth_routes.py:528,553` | Nova claim `auth_time`, posta só no login (`identity.py:339`, `fresh=True`). Um token renovado nunca conta como autenticação recente. | `tests/test_recent_auth.py` |
| 3 | Média | O limite do corpo do pedido só lia o `Content-Length`. Um corpo chunked contornava-o e esgotava memória. | `core/http_security.py:127` | Middleware ASGI que também conta os bytes recebidos e responde 413. | `tests/test_http_guards.py` |
| 4 | Média (config) | `EDGE_AUTH_TOKEN` vazio deixa a origem aberta (falha aberto). | `core/http_security.py:48`, `core/startup.py:72` | Em produção a API recusa arrancar sem `EDGE_AUTH_TOKEN` de ≥32 caracteres. | `tests/test_startup_guard.py` (suite existente) |
| 5 | Baixa | O fallback de CSRF por Referer usava um prefixo: `https://aquastats.net.evil.com` passava. | `core/http_security.py:205` | Comparação exata da origem, ou origem seguida de `/`. | `tests/test_http_guards.py` |
| 6 | Baixa | Depois de um reset, os outros links de reset continuavam válidos (até 30 min). | `routes/auth_routes.py:414-418` | O reset invalida todos os tokens por usar desse utilizador. | Coberto pela suite de Postgres (não corrida, ver abaixo) |
| 7 | Baixa | A chave de idempotência era global. A chave de outro utilizador (ou o `X-Request-Id`) bloqueava a escrita dele com 409. | `core/idempotency.py:47` | A chave passa a ter o utilizador como prefixo. | `tests/test_idempotency_scope.py` |

> **Antes do deploy:** a correção 4 faz a API falhar no arranque se o `EDGE_AUTH_TOKEN` de produção tiver menos de 32
> caracteres. Confirma o tamanho no Cloud Run antes de publicar. A correção 1 precisa de deploy da web **e** da API;
> só com a API, o comportamento é o de hoje.

## Fase 3 — produção (só verificações passivas)

| # | Gravidade | Achado | Evidência | Correção |
|---|---|---|---|---|
| 20 | **Alta** | **O Turnstile não está ativo em produção.** Um `POST /api/v1/auth/login` sem `x-turnstile-token` chega à API e devolve o 401 dela. Com o Turnstile ativo, o Worker devolvia 403 "Confirma que não és um robô". O login e o registo ficam protegidos só pelo rate limit, que hoje é partilhado por todos (#1). | 1 pedido com corpo vazio, 17/10 | `wrangler secret put TURNSTILE_SECRET_KEY` (e confirmar a sitekey no build da web). Depois, o Worker deve falhar fechado em produção quando falta o segredo. Precisa de autorização. |
| 21 | Baixa | O Cloud Run tem `ingress: all` e `allUsers` como `run.invoker`. A origem está protegida só pelo `x-edge-auth`, que hoje funciona: `/api/v1/health` e `/auth/me` diretos dão 403. | `gcloud run services describe` | Aceitável com o `x-edge-auth`. A camada extra seria o ingress interno + LB, que tem custo; fica fora do orçamento de 0 €. |
| 22 | Info | Cabeçalhos duplicados nas respostas da API, porque o Worker e a API definem os dois: `x-frame-options: DENY, DENY`, `permissions-policy` repetido. Os browsers toleram. | curl | Definir só num sítio. |
| 23 | Info | O HSTS em produção é `max-age=15552000; includeSubDomains`, sem `preload`. | curl | Opcional: `max-age=63072000; includeSubDomains; preload` e submeter. |

Verificado OK em produção:
- CSP com nonce por pedido e `strict-dynamic`, sem `unsafe-inline` nos scripts; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- CORS: o preflight de `https://evil.example` dá 400 sem `Access-Control-Allow-Origin`; um POST com Origin estranha dá 403.
- `/docs`, `/openapi.json`, `/.env` e `/.git/config` dão 404.
- Os segredos da API vêm do Secret Manager (`aquastats-api-env` montado em `/secrets`) e não estão em variáveis em claro.
- A role da BD (#8): a revisão `aquastats-api-00034` (17/10 09:34) foi construída depois do commit `3506e49`, cujo guard recusa no arranque uma `DATABASE_URL` que não seja `aquastats_api`. A produção já não usa `aquastats_app`, salvo se o guard tiver falhado aberto (#10). **Rebaixado para resolvido (provável).**
- Não verificado: o tamanho do `EDGE_AUTH_TOKEN` de produção (não li o segredo) e os orçamentos de faturação (o comando falhou).

## Fase 4 — testes ativos no staging

Montagem: 2 equipas (A e B), cada uma com 1 treinador, 1 atleta, 1 treino, 1 competição e 1 objetivo, criados pelos
fluxos normais (registo, confirmação, escolha de role, adesão por código). Os emails são `audit-*@audit.aquastats.test`
e as palavras-passe aleatórias foram descartadas. **Estas contas continuam no staging**; podem ser apagadas.

| Teste | Resultado |
|---|---|
| Treinador A: PATCH/DELETE do treino, competição e atleta da equipa B | 404 em todos |
| Treinador A: tempos, inscrições, objetivos, race-session, live e swimrankings com ids de B | 404 / 400 |
| Treinador A: criar competição com `athleteIds` de B | 201, mas a lista é ignorada (`commands.py:657` grava `[]`). Não é falha. |
| Snapshot do treinador A e do atleta A | Sem nenhum id de B |
| Atleta A: rotas de treinador (workouts, team, competitions, delete athlete) | 403 |
| Atleta A: `choose-role` coach (escalada) | 409, a role já foi escolhida |
| Atleta A: `coach-approval` forjado | 404 |
| Atleta A: editar a ficha ou os objetivos do atleta B, ou o swimrankings de B | 403 |
| SQL/path injection em ids (`' OR '1'='1`, `;DROP`, `../`) | 400 / 404, nunca 500 |
| Título `<script>…' OR 1=1--` | Guardado como texto literal (o React escapa) |
| CSRF: Origin estranha, ou sem Origin nem Referer | 403 |
| Lenex com XXE (`file:///etc/passwd`) e billion laughs | 400, sem fuga |
| Zip bomb (200 MB descomprimidos) e zip de 39 MB | 400 em <1 s |
| PDF falso e bytes aleatórios | 400 |
| Corpo de 22 MB | 413 |
| Turnstile com as chaves de teste oficiais (`1x…AA` passa, `2x…AA` falha) | O siteverify responde como esperado; `verifyTurnstile` só aceita `success === true` |

Fora da Fase 4: força bruta, carga/DoS e contorno do Turnstile/Cloudflare, por regra. O fluxo web→Worker→API
completo também não correu, porque a API foi chamada diretamente.

### Atualização 18/10 — Turnstile

- O widget "Aquastats producao" foi criado para `aquastats.net` e `www.aquastats.net`, e a `TURNSTILE_SITE_KEY` foi posta no Worker `aquastats-web`. O widget aparece em `/entrar` e o login continua a funcionar.
- A `TURNSTILE_SECRET_KEY` foi definida pelo dono a 18/10. Um login sem token, ou com um token falso, dá 403 "Confirma que não és um robô". **#20 está resolvida.**
- A secret key foi colada numa conversa com o assistente. Recomendo rodá-la no painel antes de a definir; o dono decidiu não o fazer, e isso fica como risco residual.

### Atualização 19/10 — correções seguintes

- #9 Lockout: 8 falhas bloqueiam 15 min só o IP que falhou (`identity.py` `login_locked`), por isso quem só sabe o email já não tranca o dono fora da conta. 40 falhas acumuladas, de qualquer IP, bloqueiam a conta inteira, para quem muda de IP não ter tentativas ilimitadas. Teste: `test_login_hardening.py`.
- #14 `/forgot`: no máximo um link por conta a cada 5 min, e a resposta é igual nos dois casos. Teste Postgres: `test_forgot_password_sends_one_link_per_cooldown`.
- #18 Race-session: um id de outra equipa dá 404 em vez de 500. Teste Postgres: `test_race_session_id_of_another_team_is_not_found`.
- #19 ai-worker: só aceita os modelos da lista `MODELS`.
- #12 Turnstile: o `hostname` do token tem de ser `aquastats.net` ou `www.aquastats.net`; as chaves de teste continuam a passar. Teste: `turnstile.test.ts`.
- Suite Postgres corrida localmente (pgserver 16): 51 passaram.
- Link de convite testado de ponta a ponta, com web e API locais ligadas ao staging e as chaves de teste do Turnstile: link → criar conta → confirmar → login → escolher atleta → o atleta fica na equipa do convite.
- **Estado final (19/10)**:
  - #11 (RLS WITH CHECK por role): a migração `015_coach_write_check.sql` (PR #39) foi testada no staging como `aquastats_api`, numa transação revertida no fim. Um nadador vê os treinos da equipa, mas o UPDATE e o DELETE afetam 0 linhas e o INSERT é recusado (42501). O treinador continua a escrever. Os fluxos de nadador e pending que escrevem nestas tabelas usam a ligação `aquastats_auth`, com bypass, por isso nada parte. Foi aplicada em produção a 19/10, com autorização do dono. O dono confirmou que criar e editar treinos como treinador continua a funcionar.
  - #13 (Origin sintetizado pelo proxy): corrigida no PR #40. O login Google usa rotas próprias com GET e não passa pelo proxy.
  - Leitor de IA dos resultados live: testado com PDFs reais da ANL e da ARNN, que os parsers fixos não leem. Tempos, anos e clubes saíram certos. O lugar ia parar ao campo da pista; corrigido no PR #38.
  - #10, #15, #16 e #17: o dono decidiu deixá-las como estão.
  - **20/10:** o dono pediu a correção de #10, #15, #16 e #17. #15 corrigida no PR do RGPD: o registo devolve
    sempre `{"ok": true, "needsConfirmation": true, "next": "/confirmar-pendente"}`, depois do mesmo trabalho
    argon2, e o dono da conta existente recebe "alguém tentou registar-se com este email" (no máximo um email por
    5 min). Testes: `test_account_linking.py`, `tests/postgres/test_privacy_flows.py`.
  - As contas `audit-*` de teste foram apagadas do staging, com as respetivas equipas e dados.

### Atualização 20/10 — #10, #16 e #17 corrigidas

O dono pediu para corrigir as três. A #15 (registo) fica com a sessão que trata o registo e o RGPD.

| # | Correção | Teste |
|---|---|---|
| 10 | Em produção, o guard da role tenta 3 vezes (esperas de 3 s e 7 s, ~10 s) e depois recusa arrancar, com um log `ERROR` "refusing to start". Em desenvolvimento e teste não consulta a BD, como antes. Contrapartida aceite: um soluço longo do Neon impede uma instância nova de arrancar, e o Cloud Run tenta outra. | `tests/test_startup_guard.py` (`RoleCheckRetryTest`) |
| 16 | `users.token_version` (migração `016_token_version.sql`; a 017 é a do RGPD) vai no access token (`tv`) e é comparado com a linha do utilizador que cada pedido já lê (`require_user`, `/auth/me` e as outras rotas de conta). O logout, o "terminar todas as sessões" (`revoke_user_sessions`: mudança de palavra-passe, reset e eliminação da conta) incrementam-no. Os tokens anteriores à migração não têm `tv` e contam como 0, por isso o deploy não termina sessões. Os outros dispositivos do utilizador recebem 401 depois de um logout, renovam com o refresh e continuam. | `tests/test_token_version.py`; Postgres: `tests/postgres/test_session_revocation.py` (token antigo dá 401 depois do logout e da mudança de palavra-passe; falha sem a correção) |
| 17 | `PinnedTransport` (`core/ssrf.py`) resolve e verifica o nome uma vez por pedido e liga-se a esse IP. O `Host` mantém o nome original e o TLS envia-o como SNI e valida o certificado contra ele. Os redirects continuam desligados. Os resultados live usam-no. | `tests/test_ssrf_rebinding.py` (resolver simulado que muda de IP entre chamadas) |

Impacto da #16, medido com a suite Postgres local (pgserver 16), 100 pedidos, main vs este ramo:
`GET /snapshot` 27 queries nos dois; `GET /auth/me` 11 nos dois. O tempo por pedido ficou dentro do ruído
(snapshot 20,8 vs 23,5 ms; me 11,7 vs 12,1 ms). Não há ida extra à BD: a verificação compara dois inteiros.

A #17 foi confirmada contra um site real: com o IP fixado e o SNI, `https://live.swimrankings.net/` responde 200
com o certificado validado; sem o SNI, a ligação ao mesmo IP falha a validação.

Suites: `pytest tests/ -q` 132 passed, 58 skipped; suite Postgres local 58 passed.

Staging (20/10, com autorização do dono): a migração 016 foi aplicada como `neondb_owner` no branch
`br-raspy-leaf-b1wvhlo5` (coluna `integer not null default 0`; `aquastats_api` e `aquastats_auth` com SELECT e
UPDATE). Com a API deste ramo ligada ao staging, RLS ativa: conta nova → login → `/auth/me` 200 → logout →
`/auth/me` com o token antigo 401; novo login → mudança da palavra-passe → token antigo 401, token novo 200 →
conta eliminada. As contas `audit-tv-*` das tentativas ficaram apagadas; o staging ficou sem utilizadores, como estava.

## Falhas propostas (não corrigidas, precisam de decisão ou de migração)

| # | Gravidade | Falha | Onde | Proposta |
|---|---|---|---|---|
| 8 | ~~Alta~~ resolvida (provável, ver Fase 3) | A memória do projeto diz que a produção ainda usa a role `aquastats_app` (BYPASSRLS). Nesse caso a RLS não protege nada em produção e o isolamento entre equipas depende só das verificações do código. O guard em `startup.py:36` recusaria essa role, por isso, ou a produção corre um build anterior, ou já migrou. | Fase G | Verificar na Fase 3 (query `current_user` via logs, ou consola do Cloud Run). Se ainda for `aquastats_app`, fazer a Fase G passo a passo. |
| 9 | Média | Lockout de 15 min após 8 falhas, por conta: quem sabe o email bloqueia a vítima indefinidamente. | `domain/identity.py:546-554`, `auth_routes.py:350` | Contar falhas por (conta, IP); a correção 1 torna isto possível. Ou deixar passar a palavra-passe certa quando o Turnstile foi resolvido. |
| 10 | Média, ~~aberta~~ corrigida a 20/10 | O guard da role da BD falha aberto se a query der erro no arranque. | `core/startup.py:42-44` | Em produção, tentar de novo e depois falhar. Contrapartida: um soluço do Neon impede instâncias novas. Decisão do dono. |
| 11 | Baixa | As políticas RLS de `workouts`, `competitions`, `season_plans`, `attendance_sessions` e `teams` não verificam `app_role()` no WITH CHECK. Só o `require_coach` impede um atleta de as escrever. | `db/migrations/002_rls_policies.sql:12-58` | Nova migração: `WITH CHECK (app_bypass_rls() OR (team_id = app_team_id() AND app_role() = 'coach'))`. Testar primeiro no staging. |
| 12 | Baixa | O Turnstile só verifica `success`, sem hostname nem action. | `apps/web/src/lib/turnstile.ts:17` | Verificar `hostname`. Mitigado porque a sitekey está restrita a domínios no painel. As chaves de teste devolvem `example.com`, por isso não pode partir o staging. |
| 13 | Baixa | O proxy inventa `Origin = APP_URL` quando o pedido não tem Origin. A API nunca recusa um pedido sem Origin que venha do Worker. | `route.ts:53-56` | Remover o fallback. É preciso confirmar no staging que nenhum fluxo legítimo (ex.: o form POST do Google) fica sem Origin. |
| 14 | Baixa | O `/forgot` não tem cooldown por email (flood da caixa de correio). | `auth_routes.py:367-391` | O mesmo cooldown do `resend-confirmation`. |
| 15 | Baixa, ~~aberta~~ corrigida a 20/10 | O registo revela se um email já tem conta (409). | `auth_routes.py:311-313` | Resposta uniforme, e email ao dono existente. |
| 16 | Baixa, ~~aberta~~ corrigida a 20/10 | O access token (15 min) continua válido depois do logout ou da mudança de palavra-passe. | `core/sessions.py:57-70` | Aceitar, ou `token_version` no utilizador. |
| 17 | Baixa, ~~aberta~~ corrigida a 20/10 | DNS rebinding no SSRF dos resultados live: a verificação resolve o nome, mas o httpx resolve-o de novo. | `core/ssrf.py:33-37`, `domain/live_results.py:89` | Fixar o IP resolvido num transport do httpx. Os redirects já estão desligados. |
| 18 | Baixa | Um id de race-session de outra equipa dá 500 em vez de 404 (confirma que o UUID existe). | `domain/commands.py:976` | `uuid4()` quando a linha não existe. É preciso confirmar que o cliente usa o id devolvido. |
| 19 | Baixa | O ai-worker aceita qualquer modelo `@cf/` vindo de quem tem a chave. | `apps/ai-worker/src/index.ts:43-65` | Allowlist contra `MODELS`. |

## Controlos verificados como corretos

- Tokens HMAC-SHA256 com `compare_digest` e `exp`; `SESSION_SECRET` com ≥32 caracteres.
- Cookies HttpOnly, SameSite=Lax e Secure em produção.
- Refresh tokens rodados com `FOR UPDATE`, com deteção de reutilização da família.
- Argon2id; hash fictício para o tempo de resposta ser igual; mensagem 401 uniforme.
- OAuth Google com PKCE S256, state assinado, aud/iss/exp verificados; ligação de contas só com `email_verified`.
- Autorização: role e equipa vêm sempre da BD; nenhuma rota com id tem IDOR (tabela completa revista); schemas `extra=forbid`; nenhuma escalada de atleta para treinador.
- GUC de tenant com `set_config(..., true)` por transação, sem fuga entre pedidos; as 30 tabelas com RLS ENABLE+FORCE.
- SQL: sem interpolação de dados do utilizador.
- XML com defusedxml; zip Lenex limitado (10 MB comprimido, 40 MB declarados); PDFs limitados a 15 MB; uploads em base64 sem caminhos.
- SSRF: só HTTPS na porta 443, allowlist para Polar e Google, IPs privados recusados, timeouts.
- CSP com nonce por pedido e `strict-dynamic`, sem `unsafe-inline` nos scripts (`style-src` mantém `unsafe-inline`, já documentado); `dangerouslySetInnerHTML` só em conteúdo estático.
- CORS com lista explícita; `/docs` desligado em produção.
- Nenhum segredo nos ficheiros versionados nem nos logs.

## Fase 2 — dependências

- `pip-audit -r requirements.txt` e `-r requirements-dev.txt`: sem vulnerabilidades. Só o `pip` 25.0.1 do venv local tinha avisos; foi atualizado para 26.2.1 (não vai para a imagem).
- `npm audit --omit=dev`: 0. Com dev: 5 altas (`braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`), todas na cadeia do lint. A correção do npm é uma mudança de versão major de `eslint-config-next`. Não foi aplicada; não chega à produção.

## Verificação

- API: `pytest tests/ -q` dá 117 passed e 49 skipped. A suite de Postgres (RLS, isolamento entre rotas) não correu: precisa do pgserver local (`TEST_ADMIN_DATABASE_URL`).
- Web: `tsc --noEmit` e `eslint` no `route.ts` estão limpos. O `opennextjs-cloudflare build` ainda não correu.

## Risco residual

- A role da BD em produção foi inferida pela data do build, e não por uma query (#8).
- O lockout por conta só dispara às 40 falhas, vindas de qualquer IP; até lá, cada IP é bloqueado ao fim de 8 (#9).
- #10, #15, #16 e #17 foram corrigidas a 20/10 (ver a atualização de 20/10).
- O Turnstile reduz bots, mas não os humanos/fazendas de resolução.
- Os testes de isolamento entre rotas cobrem só 5 rotas, e só como treinador. Faltam meet-entries, results, race-sessions, season-plans, attendance, goals, hr, predictions, swimrankings, live e lenex, e os casos de atleta→colega e atleta→rotas de treinador. A Fase 4 deve cobrir isto.
- A Fase 4 cobriu as rotas principais, mas não todas (`season-plans`, `attendance`, `meet-results`, `hr/delete`, `predictions` GET). Esses casos ficam para a suite de Postgres, que ainda não os cobre.
