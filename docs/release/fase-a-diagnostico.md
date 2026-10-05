# Fase A — Diagnóstico com medições (linha de base)

Data: 06/10/2026 · Branch: `release/hardening` (= `ml/modelo-estado` @ `d1ccb2a`) · Autor: agente, revisão do dono pendente.

Regras desta fase: nada foi alterado na produção. Na base de produção só correram `SELECT` de catálogo
(roles, tabelas, políticas, migrações) e contagens agregadas, nunca linhas de pessoas. As medições de páginas
autenticadas e da API foram feitas **localmente com uma equipa sintética** (nunca dados reais).

## 1. Resumo (o essencial em 6 pontos)

1. **A RLS não protege nada em produção.** A API liga-se como `aquastats_app`, que tem `BYPASSRLS`,
   `CREATEROLE`, `CREATEDB` e pertence a `neon_superuser` (que inclui `pg_read_all_data` e `pg_write_all_data`).
   O isolamento entre equipas depende só do código Python. Confirmado no catálogo da produção.
2. **O `apps/api/.env` local aponta para a branch *production* do Neon como `neondb_owner`, com
   `APP_ENV=development`.** Arrancar a API local (ou a configuração `api` do `.claude/launch.json`) corre o
   DDL de arranque e `run_migrations()` **contra a produção** — aplicaria a migração 010 sem autorização.
3. **Uma dependência crítica:** `next` 16.3.5 tem RCE em `next/og` (GHSA-vcvr-r3jv-pc5j) e a app usa `next/og`
   (`icon.tsx`, `opengraph-image.tsx`). Correção: 16.3.8 (patch). Na API, `pip-audit` encontra 81 avisos em
   5 pacotes (`pyjwt` — verifica o login Google; `pypdf` — lê PDFs carregados; `cryptography`; `starlette`; `pytest`).
4. **O `/snapshot` não escala.** Com uma equipa sintética de 32 atletas × 4 épocas (94 mil tempos):
   p50 **4,97 s** e **39 MB** de JSON por pedido do treinador; a página da matriz de cronometragem fica com
   **TBT 10,3 s** em telemóvel simulado. Hoje a produção quase não tem dados, por isso ainda não se nota.
5. **O CI está vermelho em `main` desde 28/09** (o `tsc` corre antes de o Next gerar `LayoutProps`; o pytest
   só passa com o `.env` local). Há 10 PRs do Dependabot com o mesmo CI vermelho.
6. **O trigger do ledger não bloqueia o apagamento em cascata** (testado em SQL com ROLLBACK, ver §5.3),
   mas a imutabilidade só é garantida pelas permissões quando a role deixar de ter `pg_write_all_data`.

## 2. Prioridades (impacto × esforço)

Impacto: C crítico · A alto · M médio · B baixo. Esforço: P pequeno (< ½ dia) · M médio (½–2 dias) · G grande.

| # | Achado | Imp. | Esf. | Fase |
|---|--------|:----:|:----:|------|
| 1 | Role da API com BYPASSRLS/superuser — RLS ineficaz em todas as tabelas | C | M | B + G1 |
| 2 | `.env` local e `launch.json` ligados à produção como owner; migrações correm no arranque local | C | P | guarda no código **feita**; falta tu trocares o `.env` |
| 3 | `next` 16.3.5 (RCE em `next/og`) | C | P | B |
| 4 | `pyjwt`, `pypdf`, `cryptography`, `starlette` desatualizados (81 avisos) | A | M | B |
| 5 | Origem Cloud Run aberta (`ingress: all`, `EDGE_AUTH_TOKEN` por definir) → contorna o rate limit da edge e permite falsificar `CF-Connecting-IP` | A | P | B + G |
| 6 | `/snapshot` carrega todo o histórico: 4,97 s / 39 MB (sintético 32×4) — risco de OOM a 512 MiB (não medido no Cloud Run) | A | G | C |
| 7 | Matriz de cronometragem: previsões ML e snapshot no *main thread* (TBT 10,3 s simulado) | A | M | C/D |
| 8 | `PUT /times`: *select-then-insert* sem upsert → corrida dá 500; sem ordem (edição antiga pode sobrescrever nova) | A | P | C |
| 9 | CI vermelho em `main` (tsc antes de `next typegen`; pytest depende do `.env` local) | A | P | B/F |
| 10 | Arranque a frio 6,9 s (min-instances 0) | M | P | C (decisão de custo) |
| 11 | Deriva de migrações: produção regista só 001–004; 005–009 aplicadas à mão; 003 nunca deu GRANTs nem timeouts; FORCE RLS manual; faltam 3 triggers `updated_at` | M | P | B |
| 12 | Segredos como variáveis de ambiente simples no Cloud Run (visíveis a quem tem `run.services.get`) | M | P | B (Secret Manager tem custo ≥ 7 versões → decisão) |
| 13 | Login: enumeração de contas ("entra com Google", 423) e bloqueio por conta abusável (8 tentativas/15 min) | M | P | B |
| 14 | RLS só por equipa; isolamento do atleta dentro da equipa só em Python (`filter_swimmer_snapshot`) | M | M | B |
| 15 | `resilience.py` (circuit breaker/retry/bulkhead) é código morto; chamadas externas síncronas (Gemini/AI até 60 s, live results até 200×20 s) seguram ligações da pool (3+7 por instância) | M | M | C |
| 16 | LCP `/entrar` 3,9 s (logótipo pedido a 1920 px, `_next/image` com TTL 0) | M | P | D |
| 17 | Erro de hidratação React #418 em `/termos` e `/privacidade` | M | P | D |
| 18 | Alvos de toque < 44 px (7 de 12 no login); contraste 3,5:1 em `text-mute/80` | M | P | D |
| 19 | Branch Neon `teste-i18n-local` com cópia integral da produção de 26/09 (dados pessoais fora do fluxo de apagamento) | M | P | tu decides (apagar) |
| 20 | `next=`: caracteres de controlo não são rejeitados (`/\t/x.com` → `//x.com`) | B | P | B |
| 21 | 8 pares de índices duplicados (custo de escrita sem ganho) | B | P | C |
| 22 | `X-Request-Id` aceite sem validação; `_hits` do rate limit sem limpeza (memória cresce por IP) | B | P | B/C |
| 23 | PITR do Neon só 6 h (plano gratuito); sem *snapshots* agendados; restauro nunca ensaiado | M | P | C (ensaio) |
| 24 | 8 commits de ML só existiam no teu disco | A | P | **feito** (push de `release/hardening`) |

## 3. Números de base

### 3.1 Produção (medido no site real, só leitura, 06/10/2026)

Lighthouse 12.8, perfil móvel por omissão (throttling simulado), Edge headless, mediana de 3 execuções:

| Página | Desempenho | LCP | FCP | TBT | CLS | Acessib. | Boas práticas | SEO | Peso | JS |
|--------|-----------:|----:|----:|----:|----:|---------:|--------------:|----:|-----:|---:|
| `/entrar` | 87 | 3,9 s | 1,0 s | 21 ms | 0 | 100 | 100 | 61 | 631 KB | 216 KB |
| `/privacidade` | 96 | 2,8 s | 1,1 s | 18 ms | 0 | 96 | 96 | 61 | 427 KB | 199 KB |
| `/termos` | 99 | 2,0 s | 1,1 s | 19 ms | 0 | 96 | 96 | 61 | 437 KB | 199 KB |

SEO 61 nas três: `noindex` (intencional?) e `canonical` inválido. Boas práticas: erro React #418.

Latência (30 pedidos sequenciais, 1 aquecimento descontado, a partir de Portugal):

| Pedido | 1.º pedido (frio) | p50 | p95 |
|--------|------------------:|----:|----:|
| `aquastats.net/api/v1/health` (Worker → Cloud Run) | **6 917 ms** | 86 ms | 168 ms |
| `aquastats.net/api/v1/health/ready` (com base) | 295 ms | 100 ms | 130 ms |
| Cloud Run direto `/api/v1/health` | 557 ms | 69 ms | 165 ms |
| `aquastats.net/entrar` (HTML) | 173 ms | 50 ms | 51 ms |

O URL direto do Cloud Run responde 200 — a origem não está fechada.

### 3.2 Local, equipa SINTÉTICA (seed 9001: 32 atletas, 4 épocas, 2 694 treinos, 93 812 tempos, 40 competições)

Ambiente: Postgres 16.2 local (espelho do esquema de produção, verificado por *fingerprint*), API local
(uvicorn, 1 processo), Worker local (`opennextjs-cloudflare preview` = workerd). Não é o Cloud Run: serve para
comparar antes/depois, não para prometer números de produção.

API (30 pedidos sequenciais; snapshot com 10):

| Endpoint | p50 | p95 | Corpo |
|----------|----:|----:|------:|
| `GET /auth/me` | 8,0 ms | 8,8 ms | 0,3 KB |
| `GET /snapshot` (treinador, equipa toda) | **4 965 ms** | **5 248 ms** | **39 040 KB** |
| `GET /snapshot` (atleta) | 2 689 ms | 2 786 ms | 3 284 KB |
| `GET /predictions` | 8,5 ms | 9,9 ms | — |
| `PUT /times` (uma rep) | 11,8 ms | 12,8 ms | 0,3 KB |
| `POST /auth/login` (argon2) | 301 ms | 355 ms | — |

O SQL do snapshot demora ~17 ms (plano: *hash join*, 93 813 linhas); o resto é ORM, serialização e JSON.

Lighthouse móvel nas páginas autenticadas (mediana de 3):

| Página | Desempenho | LCP | FCP | TBT | Main thread | Transferido | Acessib. |
|--------|-----------:|----:|----:|----:|------------:|------------:|---------:|
| `/coach` (início do treinador) | 63 | 22,1 s | 0,79 s | 282 ms | 1,5 s | 4,0 MB | 96 |
| `/coach/matrix/[id]` (cronometragem) | **37** | 21,8 s | 0,78 s | **10 331 ms** | **60,8 s** | 3,9 MB | 95 |
| `/coach/team` | 35 | 21,9 s | 0,79 s | 6 620 ms | 7,8 s | 4,1 MB | 100 |
| `/coach/competicoes` | 56 | 21,9 s | 0,79 s | 483 ms | 1,6 s | 4,0 MB | 100 |
| `/coach/epoca` | 68 | 21,5 s | 0,79 s | 286 ms | 1,3 s | 4,0 MB | 100 |
| `/coach/provas` | 60 | 22,3 s | 0,79 s | 313 ms | 1,5 s | 4,1 MB | 100 |
| `/swimmer` | 78 | 5,0 s | 0,78 s | 53 ms | 0,7 s | 0,6 MB | 96 |
| `/swimmer/history` | 78 | 4,8 s | 0,79 s | 202 ms | 0,9 s | 0,6 MB | 100 |

Leitura: o LCP de ~22 s nas páginas do treinador é o snapshot (39 MB em bruto, ~4 MB comprimido pelo Worker,
5 s de API) seguido do parse em CPU móvel simulada. A matriz soma o cálculo do modelo no *main thread*
(60,8 s de trabalho com o abrandamento 4× do Lighthouse). `/coach/team` faz *prefetch* de
`/coach/team/<id>` para os 32 atletas ao abrir. Com os dados reais de hoje (quase nenhuns) estas páginas são
rápidas; os números mostram para onde vão ao fim de algumas épocas.

### 3.3 Bundles e build

- `npx opennextjs-cloudflare build`: **OK** em 27 s (Next 16.3.5, Turbopack).
- JS cliente total: 57 chunks, **1 577 KB em bruto / 517 KB gzip** (todas as rotas); maior chunk 229 KB (71 KB gzip).

### 3.4 Dependências

- `npm audit` (812 pacotes): 1 crítica (`next`), 6 altas (`undici` via wrangler/miniflare — dev; `braces`/`micromatch`
  via `eslint-config-next` — dev, sem versão corrigida), 2 moderadas (`wrangler`, `miniflare` — dev).
- `pip-audit` (43 pacotes): 81 avisos — `pypdf` 5.1.0 (49), `pyjwt` 2.10.1 (15), `cryptography` 41.0.7 (9),
  `starlette` 0.46.2 (7, vem com `fastapi` 0.115.12), `pytest` 8.3.5 (1, dev).

### 3.5 Testes e CI

| Verificação | Local (antes de qualquer alteração) | CI em `main` |
|-------------|--------------------------------------|--------------|
| pytest da API | 115 passam, **15 ignorados** (testes assíncronos de `resilience.py` nunca correram) — só passa porque lê o `apps/api/.env` local (`SESSION_SECRET`) | **falha** desde 28/09 (sem `.env`) |
| Testes web (`npm test`, inclui o harness ML e o *golden* do v1.0) | 72/72 em 4,6 s | não corre (não está no `ci.yml`) |
| `npx tsc --noEmit` | 0 erros (há `.next/types` de um build anterior) | **falha**: `LayoutProps` não existe sem `next typegen` |
| `eslint` | 0 erros, 44 avisos (17 `no-unused-vars`, 15 `set-state-in-effect`, 7 `exhaustive-deps`, 4 `no-location-assign-relative-destination`, 1 `refs`) | passa (só avisos) |
| Build OpenNext | OK | `npm run build` OK |
| Testes contra Postgres (RLS, triggers, cascatas, concorrência) | **não existem** | — |

Os 10 PRs do Dependabot têm o CI vermelho pelas mesmas duas razões, não pelas atualizações em si.
`tests/conftest.py` importava um módulo inexistente (`app.domain.billing`) em fixtures que nenhum teste usa.

### 3.6 Git

- `main` = `origin/main` (`fbf4da0`). `ml/modelo-estado` está 8 commits à frente e **não existe no GitHub**.
- Os 3 ficheiros por commitar (`.github/dependabot.yml`, `.github/workflows/ci.yml`, `README.md`): conteúdo
  **idêntico** ao do índice; só têm CRLF no disco (hash normalizado = hash do índice). O `.gitattributes`
  (`* text=auto eol=lf`) já existe desde o commit inicial. Correção sem perda: `git checkout -- <3 ficheiros>`.
- Scan de segredos (regex ao estilo gitleaks sobre os 86 commits de todas as refs): **limpo** — 7 candidatos,
  todos *placeholders* (`$VARIAVEL`, `dev-…` do docker-compose local). Nenhum `.env` alguma vez commitado.
  Repositório privado, sem branch protection (indisponível em repositórios privados no plano gratuito).

## 4. Base de dados (produção, só leitura)

- Postgres 18.6, Neon Free (eu-central-1), PITR de **6 h**, sem *snapshots* agendados.
- 30 tabelas; 21 com RLS ativo (18 com FORCE); 9 sem RLS: `users`, `refresh_tokens`, `oauth_accounts`,
  `oauth_states`, `email_verification_tokens`, `password_reset_tokens`, `saga_instances`, `saga_logs`,
  `schema_migrations`.
- Políticas: só por equipa (`app_team_id()`); `app.role` é definido mas nenhuma política o usa.
- `schema_migrations` regista 001–004; os objetos de 005–009 existem (aplicados fora do mecanismo).
- `prediction_ledger` (010) não existe em produção (esperado — por autorizar).
- Volume real: 4 utilizadores, 2 atletas, 1 treino, 0 tempos, 1 competição (estimativas do catálogo).
- `pg_stat_statements` não está instalado → sem histórico de queries lentas em produção.
- Branch `staging-hardening` criada (só esquema, 0 linhas, sem expiração) para os ensaios das fases B/C.

## 5. Segurança, resiliência e acessibilidade — detalhe

### 5.1 Segurança do código (revisão própria; não substitui pentest)

Bom: cookies `HttpOnly` + `Secure` + `SameSite=Lax`; access token HMAC de 15 min; refresh com rotação e deteção
de reutilização (revoga a família); CSRF por Origin/Referer em mutações; argon2id; validação de tamanho de corpo;
SSRF limitado a HTTPS/443 com bloqueio de IPs privados; `safe_app_path` contra redirecionamentos abertos;
cabeçalhos de segurança na API e no site; links de aprovação assinados com TTL; sem endpoints sem autenticação
além dos de login/convite.

A corrigir (além da tabela §2): CSP com `'unsafe-inline'` em scripts; política de password mais fraca do que a
documentada (8 vs 12); DNS rebinding possível no seguidor de resultados (mitigado por HTTPS obrigatório);
rate limit da edge via Cache API é por *colo* e não atómico (aproximado; o funcionamento no domínio real não
foi verificado para não fazer testes ativos em produção); o Worker de IA no `workers.dev` não tem rate limit
(protegido por chave partilhada).

### 5.2 Resiliência

- Cronometragem: debounce de 500 ms, chave de idempotência por conteúdo, fila offline no cliente; o servidor
  faz *select-then-insert* (corrida → 500 por violação de unicidade, sem *upsert* nem verificação de ordem).
- Previsões: gravadas 1,5 s depois de abrir a matriz, em segundo plano e com falhas ignoradas (não partem a
  cronometragem), mas o cálculo corre no *main thread* (ver §3.2).
- Dependências externas sem disjuntor: Gemini/AI worker (30–60 s), resultados ao vivo (até 200 ficheiros × 20 s
  dentro do pedido), Polar (30 s), SMTP (20 s). Worker → Cloud Run sem timeout; Cloud Run 300 s.
- Base: `statement_timeout` 30 s por ligação; pool 3+7 por instância; máx. 3 instâncias × 80 pedidos.
- Observabilidade: request id, health e readiness existem; Sentry não está configurado; sem alertas.

### 5.3 Ledger vs apagamento (testado no espelho local, transações com ROLLBACK)

| Caso | Resultado |
|------|-----------|
| `DELETE` direto numa previsão | recusado (`prediction_ledger is append-only`) |
| `UPDATE` direto | recusado |
| Apagar atleta (depois dos dependentes, como `_purge_athlete`) | previsões apagadas em cascata |
| Apagar treino | previsões apagadas em cascata |
| Apagar utilizador que fez previsões | `predicted_by` → NULL |
| Apagar a equipa inteira | previsões apagadas em cascata |

Falta (Fase B): provar pelos caminhos reais da app (`_purge_athlete`, `delete_user_account`, `leave_team` com
purga, apagar treino) com a role nova sem privilégios; e fechar a porta `SET LOCAL aquastats.ledger_maintenance`
(qualquer role pode definir esta variável — a defesa real tem de ser o `REVOKE UPDATE, DELETE`).

### 5.4 Acessibilidade (linha de base)

- Lighthouse: 100 (`/entrar`), 96 (`/privacidade`, `/termos`); páginas autenticadas na tabela §3.2.
- Teclado em `/entrar` (Tab × 12): ordem lógica, *skip link* presente, contorno de foco de 2 px em todos os
  elementos; o botão de língua ativo tem contorno **branco** (provavelmente invisível em fundo claro — a confirmar).
- Alvos de toque: 7 de 12 elementos abaixo de 44 px (PT/EN 40×32, "Mostrar" 52×32, links de 20 px de altura).
- Contraste: 3,5:1 em texto pequeno `text-mute/80` (mínimo 4,5:1).
- Por fazer: axe completo nas páginas autenticadas, leitor de ecrã (NVDA/Narrador) — Fase D.

## 6. Modelo de ameaças (resumo; versão completa em `docs/security/` na Fase B)

Ativos: dados de atletas (incluindo menores, bem-estar e frequência cardíaca), contas e sessões, chaves de
fornecedores (Gemini, Polar, SMTP, Google), base de dados.
Atores: anónimo na internet; atleta curioso sobre colegas; treinador de outra equipa; dependência comprometida;
alguém com acesso de leitura ao projeto GCP; cópia do `.env` local.
Entradas: `aquastats.net` (Worker), URL direto do Cloud Run, Worker de IA (`workers.dev`), endpoint público do
Neon (sem *allowlist* de IP), repositório.
Maiores riscos hoje: acesso entre equipas por um bug na app (RLS ineficaz); execução remota via `next/og`;
negação de serviço com pedidos de snapshot pesados (5 s de CPU e 39 MB por pedido autenticado) ou com bloqueio
de contas alheias; PDF malicioso (`pypdf`); exposição de segredos (variáveis simples, `.env` local com o owner).

## 7. O que não foi medido e porquê

- Lighthouse e latências autenticadas **na produção**: exigiria entrar com uma conta real e dados reais; foi
  feito localmente com dados sintéticos.
- Planos e queries lentas na produção: `pg_stat_statements` não existe e há 0 tempos — os planos foram medidos
  no espelho local com 94 mil tempos sintéticos.
- Memória do snapshot no Cloud Run (512 MiB): não medida (seria um teste de carga em produção).
- Testes de carga: só em staging, nas fases seguintes.
- Ligar a API ao staging Neon: bloqueado pelo classificador de segurança quando tentei gerar a credencial
  (ver "o que preciso de ti").

## 8. Decisões e ações que preciso de ti

1. **Licença** e **autoria** (as respostas vieram com o modelo por preencher).
2. **Os 3 ficheiros CRLF:** posso fazer `git checkout -- .github/dependabot.yml .github/workflows/ci.yml README.md`
   (zero alterações de conteúdo)?
3. **`apps/api/.env`**: trocar o `DATABASE_URL` de produção por um local/staging (és tu que o editas; eu ponho
   no código uma guarda que recusa migrações contra a produção fora de `APP_ENV=production`).
4. **Credencial de staging:** colar tu a connection string da branch `staging-hardening` em
   `apps/api/.env.staging` (ou autorizar-me a gerar credenciais de staging) — só é preciso para ensaiar uma
   revisão Cloud Run de staging; os testes de RLS e carga podem correr no Postgres local e no Neon via conector.
5. **Branch `teste-i18n-local`** (cópia de dados reais de 26/09): apagar?
6. **Custos que exigem decisão (orçamento 0 €):** Secret Manager (≈ 0,06 USD/versão/mês acima de 6 versões),
   min-instances=1 no Cloud Run (arranque a frio de 6,9 s) — alternativa gratuita: ping agendado nas horas de treino.
7. **`ci.yml`**: a correção do CI vermelho (`npx next typegen` antes do `tsc`) e o `npm test` ficam à espera da
   tua decisão sobre esse ficheiro, como pediste.

Feito entretanto (sem decisão necessária): push de `release/hardening` (os 8 commits de ML já têm cópia no
GitHub); guarda no código que recusa arrancar a API contra a base de produção fora de `APP_ENV=production`
(testada com o teu `.env` real: o arranque é recusado); testes da API independentes do `.env`.
