# SwimAnalytics — Plano Mestre de Arquitetura

**Versão:** 3.1.0  
**Estado:** Aprovado para implementação  
**Última atualização:** 2026-08-16  
**Arquitetura:** Python (FastAPI) + PostgreSQL + Redis + Worker Assíncrono + PWA Offline-First  
**Foco:** Alta performance, tolerância a falhas, offline-first, multi-país, pagamentos B2B e preparação para ML

---

## Índice

1. [Visão e princípios](#1-visão-e-princípios)
2. [Riscos estratégicos e mitigações](#2-riscos-estratégicos-e-mitigações)
3. [Decisões técnicas fechadas](#3-decisões-técnicas-fechadas)
4. [Estratégia €0/mês (free tier)](#4-estratégia-0mês-free-tier)
5. [Arquitetura de alto nível](#5-arquitetura-de-alto-nível)
6. [Stack tecnológica endgame](#6-stack-tecnológica-endgame)
7. [Multi-país e internacionalização](#7-multi-país-e-internacionalização)
8. [Identidade, autenticação e autorização](#8-identidade-autenticação-e-autorização)
9. [Pagamentos, billing e GTM comercial](#9-pagamentos-billing-e-gtm-comercial)
10. [Modelo de dados completo](#10-modelo-de-dados-completo)
11. [API design](#11-api-design)
12. [Segurança, compliance, RGPD e menores](#12-segurança-compliance-rgpd-e-menores)
13. [Observabilidade e SLOs](#13-observabilidade-e-slos)
14. [Estrutura de projeto](#14-estrutura-de-projeto)
15. [Roadmap de implementação](#15-roadmap-de-implementação)
16. [Variáveis de ambiente](#16-variáveis-de-ambiente)
17. [Critérios de escalada (quando sair do free tier)](#17-critérios-de-escalada-quando-sair-do-free-tier)

---

## 1. Visão e princípios

### 1.1 Objetivo de produto

O SwimAnalytics é uma plataforma SaaS B2B de alta performance para natação competitiva. Resolve a perda de dados e a ineficiência do registo em papel ou folhas de cálculo, fornecendo uma **Matriz de Velocidade** de ultra-baixa latência para treinadores registarem tempos ao vivo na piscina ou retroativamente.

**Modelo comercial:** treinadores/clubes pagam subscrição SaaS; atletas entram gratuitamente via self-service ou convite do treinador.

### 1.2 Atores do sistema

| Ator | Responsabilidades |
|---|---|
| **Treinador (Coach)** | Cria treinos, regista tempos offline/online, gere equipa, aprova atletas, gere billing |
| **Atleta (Swimmer)** | Entra via convite ou self-service, visualiza treinos alocados e os seus tempos |
| **Admin (Ops)** | Métricas globais, auditoria, conformidade, monitorização (interno) |

> **Nota v3.1:** Não existe papel Parent/Guardian. Menores sem conta própria são geridos como **placeholders** criados pelo treinador.

### 1.3 Regras críticas de negócio (revistas v3.1)

1. **Onboarding híbrido (não bloquear o dia 1):**
   - O treinador pode criar **atletas placeholder** (nome + data nascimento) para usar a matriz imediatamente.
   - Placeholders recebem convite (link/QR) para o atleta completar registo quando aplicável.
   - Self-service: atleta pede entrada via `join_code`.
   - Dados pessoais completos só visíveis ao treinador após **aprovação explícita**.

2. **Menores sem conta própria** — atletas abaixo da idade mínima de registo (16 anos EU) existem apenas como placeholder gerido pelo treinador; não têm login.

3. **Formato de tempo fixo** — sempre `MM'SS"CC` (minutos, segundos, centésimos), 2 dígitos máx. por campo; ver §7.4 e Apêndice C.

4. **Isolamento de dados por aprovação** — mantido.

5. **Offline-first obrigatório** — sync assíncrono; nunca depender de rede em tempo real.

6. **Side-effects fora do ciclo HTTP** — outbox transacional.

7. **Idempotência end-to-end** — inclui sync batches offline (`client_batch_id`).

### 1.4 Princípios arquiteturais

| Princípio | Implicação |
|---|---|
| **Offline-first** | PWA + IndexedDB + sync queue; backend aceita batches idempotentes com `client_batch_id` |
| **Modular Monolith** | Um deployable com módulos isolados; extração só com métricas |
| **Multi-tenant desde o dia 1** | `organization_id` em todas as entidades |
| **Locale-aware by design** | Timezone, moeda, idioma, formatos de tempo |
| **Security by default** | RLS + guards + auditoria |
| **Peak-hour resilient** | Pool tuning, PgBouncer, write coalescing, conflict-free sync |
| **Idempotência everywhere** | HTTP + offline sync + webhooks + pagamentos |
| **Event-driven side effects** | Outbox + ARQ |
| **Observability first** | SLOs incluem horário nobre (18h–20h) e taxa de sync offline |
| **Free tier first** | €0/mês com design que aguenta picos moderados |

---

## 2. Riscos estratégicos e mitigações

> Secção para parceiros, investidores e equipa. Cada risco real tem mitigação concreta no produto, arquitectura ou GTM.

### 2.1 Riscos de Produto e UX

#### R1 — Falta de suporte offline ("caixas de Faraday" nas piscinas)

| | |
|---|---|
| **Risco** | Treinador perde ligação ao submeter matrix-batch → perde treino inteiro → abandono imediato |
| **Probabilidade** | Alta (Wi-Fi instável ou inexistente em piscinas cobertas) |
| **Impacto** | Crítico — deal-breaker na piscina |
| **Mitigação** | Arquitectura **offline-first** (ver §5.3) |
| **Implementação** | PWA + Service Worker + IndexedDB; teclado numérico custom; sync queue com retry; indicador "X pendentes para sync" |
| **Critério de sucesso** | 100% do treino registado offline; sync automático; zero perda em teste 8h offline |
| **Fase** | 5 + 5b |

#### R2 — Atrito na inserção de tempos (ecrã táctil caótico)

| | |
|---|---|
| **Risco** | Teclado nativo é lento; treinador não acompanha ritmo dos atletas |
| **Probabilidade** | Alta |
| **Impacto** | Alto — UX core comprometida |
| **Mitigação** | **Teclado numérico swim-specific** (Apêndice C) |
| **Implementação** | Teclado 3 campos `MM'SS"CC`; input dígito a dígito; padding automático |
| **Critério de sucesso** | 20 tempos inseridos em < 60 segundos |
| **Fase** | 5 (frontend) |

#### R3 — Adesão atleta vs. treinador (bloqueio no dia 1)

| | |
|---|---|
| **Risco** | Atletas jovens demoram a criar conta → treinador não usa matriz no 1.º treino |
| **Probabilidade** | Alta |
| **Impacto** | Crítico — falha de activação |
| **Mitigação** | **Onboarding híbrido** (regra #1 revista) |
| **Implementação** | Placeholders + QR convite + merge automático placeholder → conta real |
| **Critério de sucesso** | Treinador operacional em < 5 min sem atletas registados |
| **Fase** | 4 + 4b |

### 2.2 Riscos de Negócio e Go-To-Market

#### R4 — Ciclos de venda e burocracia dos clubes

| | |
|---|---|
| **Risco** | Treinador adora a app, aprovação orçamental demora meses |
| **Probabilidade** | Alta em PT/ES |
| **Impacto** | Alto — receita B2B atrasada |
| **Mitigação** | GTM em camadas (§9.5) |
| **Implementação** | Free generoso; trial 90 dias Pro; facturação anual -20%; piloto clube 3 meses; PDF proposta junta |
| **Critério de sucesso** | Uso grátis enquanto aguarda aprovação; conversão > 30% pós-piloto |
| **Fase** | 6 + GTM |

#### R5 — Sazonalidade e churn de verão

| | |
|---|---|
| **Risco** | Julho/agosto sem treinos → cancelamentos |
| **Probabilidade** | Alta |
| **Impacto** | Médio — MRR instável |
| **Mitigação** | **Season Pause** + valor off-season |
| **Implementação** | Stripe `pause_collection`; plano Off-Season €9/mês; análise de época; cobrança anual (2 meses grátis) |
| **Critério de sucesso** | Churn Jul-Ago < 15% |
| **Fase** | 6 + 10 |

#### R7 — Gargalo de I/O em horário nobre (18h–20h)

| | |
|---|---|
| **Risco** | Múltiplos clubes → writes disparam → pool esgotado → 409/5xx |
| **Probabilidade** | Alta com > 20 clubes |
| **Impacto** | Crítico — falha no pico de uso |
| **Mitigação** | Arquitectura **peak-resilient** (§5.4) |
| **Implementação** | PgBouncer; pool tunado; write coalescing; lock por bloco; fila Redis se pool > 80%; circuit breaker |
| **Critério de sucesso** | p99 < 100ms com 50 clubes simultâneos |
| **Fase** | 2 + 9 + 12 |

#### R8 — Menores de idade (sem conta Parent)

| | |
|---|---|
| **Risco** | Atletas competitivos são frequentemente menores; registo directo levanta questões RGPD |
| **Probabilidade** | Certa |
| **Impacto** | Médio — legal + UX |
| **Mitigação** | **Placeholders coach-managed** (sem papel Parent) |
| **Implementação** | Menor de idade mínima → só placeholder (sem login); registo self-service bloqueado abaixo de 16 anos; treinador gere dados mínimos; convite para registo quando atleta atinge idade ou com autorização documentada offline |
| **Critério de sucesso** | Zero contas login de menores < 16 anos sem validação |
| **Fase** | 4b |

### 2.4 Matriz de priorização

| ID | Risco | Impacto | Urgência | Fase |
|---|---|---|---|---|
| R1 | Offline-first | Crítico | Launch | 5 + 5b |
| R2 | Teclado custom | Alto | Launch | 5 |
| R3 | Onboarding híbrido | Crítico | Launch | 4 + 4b |
| R8 | Menores (placeholder) | Médio | Launch | 4b |
| R7 | Peak I/O | Crítico | Pré-escala | 2 + 9 + 12 |
| R4 | Burocracia clubes | Alto | GTM | 6 |
| R5 | Churn verão | Médio | Pós-launch | 6 + 10 |

---

## 3. Decisões técnicas fechadas

Todas as dúvidas resolvidas pela opção **mais forte e robusta**, mantendo €0/mês enquanto possível.

| Decisão | Escolha | Justificativa |
|---|---|---|
| **PKs** | UUID v7 (time-sortable) | Melhor indexação B-tree, ordenação temporal, sem colisões |
| **Tempo na matriz** | `INTEGER` centiseconds | `6542` = 65.42s; UPSERT mais rápido que `NUMERIC` |
| **Password hashing** | argon2id | OWASP #1 recomendado (mais robusto que bcrypt) |
| **Worker** | ARQ | Maduro, async nativo, Redis-backed, cron integrado |
| **OAuth library** | authlib | PKCE, extensível, well-maintained |
| **RLS PostgreSQL** | Fase 2 (não Fase 8) | Segurança na camada DB desde cedo |
| **Pagamentos** | Stripe Billing + Checkout | PCI SAQ-A, zero custo fixo, webhooks robustos |
| **Email dev** | Mailpit (Docker) | Grátis, local, captura todos os emails |
| **Email prod (início)** | Resend free tier | 3 000 emails/mês grátis |
| **Object storage** | Cloudflare R2 free tier | 10 GB grátis, S3-compatible |
| **DB produção (início)** | Neon PostgreSQL free | 0.5 GB, branching, serverless |
| **Redis produção (início)** | Upstash Redis free | 10k cmds/dia, serverless |
| **Compute (início)** | Fly.io free tier | 3 shared VMs grátis |
| **CDN + WAF** | Cloudflare free | CDN global, DDoS, Turnstile grátis |
| **CI/CD** | GitHub Actions free | 2 000 min/mês |
| **Observabilidade** | Sentry free + structlog | 5k events/mês grátis |
| **IaC** | Terraform | Grátis (tooling), preparado para AWS/GCP |
| **Monorepo** | Backend neste repo | Frontend em repo separado |
| **Paginação** | Cursor-based | Escala sem OFFSET degradation |
| **Erros API** | RFC 7807 Problem Details | Padrão industria |
| **Refresh tokens** | Rotação com family_id | Detecção de roubo de sessão |
| **Encryption at rest (OAuth tokens)** | Fernet (AES-128-CBC) | Tokens OAuth encriptados na DB |
| **Audit logs** | Partitioning mensal | Performance + retenção controlada |
| **Pasta raiz** | `vsc_app/` directamente | Sem sub-pasta extra |
| **Offline sync** | IndexedDB + `client_batch_id` UUID | Idempotência offline; merge server-side |
| **Optimistic lock scope** | Por `workout_block` (não workout inteiro) | Menos conflitos 409 em picos |
| **Connection pooling** | PgBouncer transaction mode + asyncpg pool | Aguenta picos 18h–20h no free tier |
| **Onboarding atletas** | Placeholders + convites QR/link | Treinador operacional dia 1 |
| **Menores** | Placeholder coach-managed | Sem papel Parent; sem login < 16 anos |
| **Frontend matrix** | PWA Next.js + teclado `MM'SS"CC` | UX crítica na piscina |
| **Formato tempo** | `MM'SS"CC` fixo, 2 dígitos/campo | Padding: min/seg esquerda; centésimos direita |
| **Churn sazonal** | Season Pause + Off-Season plan | Retém subscrições Jul-Ago |
| **Peak write queue** | Redis buffer quando pool > 80% | Evita 5xx em horário nobre |

---

## 4. Estratégia €0/mês (free tier)

### 4.1 Mapa de serviços gratuitos

| Serviço | Provider free tier | Limites | Uso no SwimAnalytics |
|---|---|---|---|
| **PostgreSQL** | Neon | 0.5 GB, 1 project | DB principal |
| **Redis** | Upstash | 10k cmds/dia, 256 MB | Sessions, rate limit, locks, ARQ |
| **Compute API** | Fly.io | 3 shared-cpu VMs | FastAPI + Worker |
| **CDN + WAF** | Cloudflare | Unlimited bandwidth | Edge, Turnstile, DNS |
| **Object Storage** | Cloudflare R2 | 10 GB | Exports GDPR |
| **Email** | Resend | 3 000 emails/mês | Transacional |
| **Errors** | Sentry | 5 000 events/mês | Exception tracking |
| **CI/CD** | GitHub Actions | 2 000 min/mês | Lint, test, security scan |
| **OAuth** | Google Cloud | Free | Google Sign-In |
| **Payments** | Stripe | €0 fixo (só % transacção) | Billing (só custo quando há receita) |
| **Secrets** | Doppler free / GitHub Secrets | 5 users | Env vars |
| **Uptime** | Better Stack free | 10 monitors | Health checks |
| **Local dev** | Docker Compose | Grátis | PG + Redis + Mailpit |

**Custo mensal estimado (fase inicial): €0**

### 4.2 Limites do free tier e mitigação

| Limite | Mitigação |
|---|---|
| Neon 0.5 GB | Índices optimizados; audit partitioning; cleanup jobs |
| Upstash 10k cmds/dia | Rate limit eficiente; TTL agressivo; batch Redis ops |
| Fly.io 3 VMs | API + Worker + staging numa VM inicialmente |
| Resend 3k emails/mês | Outbox batching; emails só acções críticas |
| Sentry 5k events | Sample rate 10% staging; filtrar health checks |
| **Neon max connections (~100)** | **PgBouncer local (Docker) → max 20 conn app; transaction pooling** |
| **Picos 18h–20h** | **Write coalescing client-side; sync queue offline reduz pressão; circuit breaker** |

### 4.3 Quando escalar (ver secção 17)

---

## 5. Arquitetura de alto nível

```
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE (Cloudflare Free)                      │
│           CDN · WAF · Turnstile · DNS · SSL · PWA cache         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              PWA Frontend (Next.js — repo separado)               │
│   IndexedDB · Service Worker · Sync Queue · Teclado Swim Custom  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ online: REST API  │ offline: queue local
┌──────────────────────────▼──────────────────────────────────────┐
│                   API (FastAPI Modular Monolith)                │
│  Auth · Orgs · Workouts · Matrix · Sync · Billing · GDPR       │
│  Middleware: Security · Rate Limit · Idempotency · RLS          │
│  Peak: PgBouncer · Circuit Breaker · Redis Write Buffer         │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌────▼────────────┐
│ PostgreSQL  │ │   Redis   │ │ ARQ Worker  │ │ External APIs  │
│ Neon+PgBouncer│ Upstash  │ │  + Outbox   │ │ Google·Stripe  │
│  + RLS      │ │ + Peak Q  │ │             │ │ Resend·R2    │
└─────────────┘ └───────────┘ └─────────────┘ └────────────────┘
```

### 5.1 Fluxo — Matrix Batch online (crítico)

```
Coach → POST /matrix-batch (ou sync queue drena offline)
  → Rate Limit (Redis, 120/min)
  → Idempotency (X-Idempotency-Key OU client_batch_id)
  → Auth + Permission
  → Validate (SwimTime, RPE, SanitizedStr)
  → Optimistic Lock (block.version — por bloco, não global)
  → Pool check: se > 80% → enqueue Redis peak_write_queue
  → PostgreSQL UPSERT (single round-trip)
  → Return response
  → Target: p99 < 50ms (online) | < 200ms (pico com queue)
```

### 5.2 Fluxo — Transactional Outbox

```
HTTP Request → DB Transaction
  ├── Business logic (e.g., approve athlete)
  └── INSERT outbox_event (same transaction)
→ Commit → Return 200

ARQ Worker:
  → SELECT pending FOR UPDATE SKIP LOCKED
  → Process → completed | retry 5x → dead letter
```

### 5.3 Fluxo — Offline-First Sync (R1)

```
┌──────────── PWA (Piscina — sem rede) ────────────┐
│ Treinador insere tempos → IndexedDB (imediato)   │
│ Teclado swim: MM'SS"CC (3 campos fixos)         │
│ UI: badge "12 pendentes · offline"               │
└────────────────────┬─────────────────────────────┘
                     │ rede detectada (Service Worker)
┌────────────────────▼─────────────────────────────┐
│ Sync Engine                                       │
│ 1. Lê queue IndexedDB (FIFO)                     │
│ 2. Agrupa entries por workout (coalescing)       │
│ 3. POST /matrix-sync-batch                       │
│    Headers: client_batch_id (UUID, idempotente)  │
│ 4. Sucesso → remove da queue                     │
│ 5. Falha → retry exponencial (max 10, backoff)   │
│ 6. Conflito 409 → merge local com server state   │
└──────────────────────────────────────────────────┘
```

**Regras offline:**
- Todos os writes vão primeiro para IndexedDB (nunca esperar rede).
- `client_batch_id` gerado no cliente — reenvio seguro após timeout.
- Backend trata `client_batch_id` como idempotency key adicional.
- Optimistic lock: se versão divergiu offline, server faz merge (last-write-wins por célula, audit log).
- Service Worker cacheia shell da app + dados do treino activo.

### 5.4 Arquitectura Peak-Resilient (R7)

```
Horário nobre (18h–20h):
  │
  ├─ Client: coalesce 500ms (agrupa keystrokes antes de enviar)
  │
  ├─ API: check pool utilization
  │    ├─ < 80% → UPSERT directo
  │    └─ ≥ 80% → LPUSH peak_write_queue (Redis)
  │              → worker consome em batches de 100
  │              → circuit breaker: 3 falhas → 503 + Retry-After
  │
  ├─ PgBouncer: transaction pooling (max 20 conn app → 100+ DB)
  │
  └─ Monitor: alert se p99 > 100ms ou queue depth > 50
```

**Free tier (€0):** PgBouncer corre no mesmo container Fly.io que a API. Escala para PgBouncer dedicado quando > 50 clubes activos.

---

## 6. Stack tecnológica endgame

### 6.1 Backend

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Python | 3.12+ |
| Framework | FastAPI | ≥ 0.115 |
| Validação | Pydantic | v2 |
| ORM | SQLAlchemy | 2.0 Async |
| Migrations | Alembic | ≥ 1.13 |
| DB Driver | asyncpg | latest |
| Cache/Locks | Redis (redis-py async) | 7+ |
| Queue | ARQ | latest |
| Auth JWT | PyJWT | latest |
| Password | argon2-cffi | latest |
| OAuth | authlib | latest |
| Payments | stripe-python | latest |
| Encryption | cryptography (Fernet) | latest |
| Sanitização | bleach | latest |
| i18n | babel | latest |
| Email | resend (prod) / Mailpit (dev) | — |
| Storage | aioboto3 (S3/R2) | latest |
| Observability | opentelemetry-sdk + structlog | latest |
| Testing | pytest + pytest-asyncio + httpx | latest |
| Linting | ruff | latest |
| Type checking | mypy | latest |
| Security scan | pip-audit + gitleaks | — |

### 6.2 Frontend (PWA — repo separado, co-desenvolvido)

| Camada | Tecnologia | Propósito |
|---|---|---|
| Framework | Next.js 15 App Router | SSR + PWA |
| Offline storage | IndexedDB via Dexie.js | Sync queue, cache treino activo |
| Service Worker | Workbox | Shell cache, background sync API |
| i18n | next-intl | pt-PT, pt-BR, en-US, es-ES |
| Matrix UI | Custom React component | Teclado swim, grid virtualizado |
| Auth client | HTTPOnly cookies (BFF) | Segurança tokens |
| Pagamentos UI | Stripe Elements / Checkout | Billing B2B clubes |
| State sync | TanStack Query + offline queue | Optimistic UI + retry |

### 6.3 Infraestrutura por fase

| Fase | Compute | DB | Redis | Storage | Email |
|---|---|---|---|---|---|
| **Dev local** | Docker Compose | PG 16 + Redis 7 + **PgBouncer** + Mailpit | filesystem | Mailpit |
| **Staging** | Fly.io free | Neon free (branch) | Upstash free | R2 free | Resend free |
| **Produção v1** | Fly.io free | Neon free | Upstash free | R2 free | Resend free |
| **Produção v2** | Fly.io paid / AWS | Neon paid / RDS | Upstash paid | R2 paid | Resend paid |
| **Multi-region** | Multi-region Fly/AWS | Read replicas | Redis Cluster | Multi-region R2 | Resend |

---

## 7. Multi-país e internacionalização

### 7.1 Locales suportados (launch)

| Locale | País | Moeda | Timezone default |
|---|---|---|---|
| `pt-PT` | Portugal | EUR | Europe/Lisbon |
| `pt-BR` | Brasil | BRL | America/Sao_Paulo |
| `en-US` | EUA / Internacional | USD | America/New_York |
| `es-ES` | Espanha | EUR | Europe/Madrid |

Extensível: `fr-FR`, `de-DE`, `it-IT` (Fase 10+).

### 7.2 Campos locale-aware

```python
# Organization
country_code: str          # ISO 3166-1 alpha-2
default_locale: str        # pt-PT, pt-BR, en-US, es-ES
default_timezone: str      # IANA timezone
default_currency: str      # EUR, BRL, USD
tax_id: str | None         # NIF, CNPJ, VAT

# User
preferred_locale: str
preferred_timezone: str
country_code: str

# Workout
workout_date: date         # data local da organização (sem conversão UTC)
```

### 7.3 Regras de timezone

| Tipo de dado | Armazenamento | Exibição |
|---|---|---|
| Timestamps (created_at, etc.) | UTC (`TIMESTAMPTZ`) | Convertido para timezone do user |
| Datas de treino | `DATE` local da org | Sem conversão |
| Relatórios/agregações | Timezone da org | Backend converte |

### 7.4 Formato de tempo `MM'SS"CC` (regra fixa)

**Notação visual:** `01'01"10` = 1 minuto, 1 segundo, 10 centésimos = **61,10 s** (6110 centiseconds na DB).

#### Estrutura

```
┌──────┐   ┌──────┐   ┌──────┐
│  MM  │ ´ │  SS  │ " │  CC  │
└──────┘   └──────┘   └──────┘
 minutos   segundos   centésimos
 máx 2     máx 2       máx 2
 dígitos   dígitos     dígitos
```

- **Sempre 3 campos** visíveis na UI (nunca formato livre tipo `1:05.42`).
- **Máximo 2 algarismos por campo** (0–99 minutos; 0–59 segundos validados; 0–99 centésimos).

#### Regras de padding (normalização)

| Campo | Regra | Exemplo input → output |
|---|---|---|
| **Minutos (MM)** | Pad **esquerda** com `0` até 2 dígitos | `1` → `01` |
| **Segundos (SS)** | Pad **esquerda** com `0` até 2 dígitos | `1` → `01` |
| **Centésimos (CC)** | Pad **direita** com `0` se só 1 dígito | `1` → `10` (não `01`) |

#### Exemplos completos

| Input utilizador | Normalizado | Segundos totais | Centiseconds DB |
|---|---|---|---|
| `1'01"1` | `01'01"10` | 61,10 s | 6110 |
| `0'45"3` | `00'45"30` | 45,30 s | 4530 |
| `2'05"0` | `02'05"00` | 125,00 s | 12500 |
| `''32"5` | `00'32"50` | 32,50 s | 3250 |
| `10'00"00` | `10'00"00` | 600,00 s | 60000 |

> **Regra chave:** `1'01"1` → `01'01"10`. O último dígito isolado nos centésimos assume **zero à direita**, não à esquerda.

#### Validação backend (Pydantic `SwimTime`)

```python
# Aceita: "01'01\"10", "1'01\"1" (normaliza), ou campos separados {mm, ss, cc}
# Rejeita: segundos > 59, campos com > 2 dígitos, caracteres inválidos
# Output interno: integer centiseconds (6110)
```

#### API — campos aceites

```json
{
  "time": "01'01\"10",
  "time_parts": { "mm": 1, "ss": 1, "cc": 1 }
}
```

Ambos normalizam para o mesmo valor. Preferir `time_parts` no sync offline (menos parsing ambíguo).

### 7.5 Expansão multi-região (roadmap infra)

| Fase | Regiões | Estratégia |
|---|---|---|
| Launch | EU (Frankfurt) | Single region, GDPR-native |
| Fase 2 | + US East | Read replica US |
| Fase 3 | + Brazil (São Paulo) | Replica LATAM, Stripe BR |
| Fase 4 | Active-active | Tenant routing por `country_code` |

---

## 8. Identidade, autenticação e autorização

### 8.1 Estratégia híbrida

- **Email + password** (argon2id)
- **Google OAuth 2.0** (PKCE) — login social (atletas ≥ 16 anos)
- **Convite por link/QR** — onboarding acelerado (placeholder → conta real)
- **Extensível:** Apple Sign-In (Fase 12+), Microsoft (Fase 12+)

### 8.2 Tabelas de identidade

```
users
├── id                  UUID v7 PK
├── email               VARCHAR UNIQUE (lowercase normalized)
├── password_hash       VARCHAR NULL (NULL for OAuth-only)
├── role                ENUM(admin, coach, swimmer)
├── is_active           BOOLEAN DEFAULT true
├── is_verified         BOOLEAN DEFAULT false
├── email_verified_at   TIMESTAMPTZ NULL
├── preferred_locale    VARCHAR DEFAULT 'pt-PT'
├── preferred_timezone  VARCHAR DEFAULT 'Europe/Lisbon'
├── country_code        VARCHAR(2)
├── last_login_at       TIMESTAMPTZ
├── failed_login_count  SMALLINT DEFAULT 0
├── locked_until        TIMESTAMPTZ NULL
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
└── deleted_at          TIMESTAMPTZ NULL (soft delete)

oauth_accounts
├── id                      UUID v7 PK
├── user_id                 UUID FK → users
├── provider                ENUM(google, apple, microsoft)
├── provider_account_id     VARCHAR (Google sub)
├── access_token_encrypted  TEXT NULL
├── refresh_token_encrypted TEXT NULL
├── created_at              TIMESTAMPTZ
├── updated_at              TIMESTAMPTZ
└── UNIQUE(provider, provider_account_id)

refresh_tokens
├── id           UUID v7 PK
├── user_id      UUID FK → users
├── token_hash   VARCHAR(64) (SHA-256)
├── family_id    UUID (rotation chain)
├── expires_at   TIMESTAMPTZ
├── revoked_at   TIMESTAMPTZ NULL
├── ip_address   INET
├── user_agent   TEXT
└── created_at   TIMESTAMPTZ

profiles
├── user_id           UUID PK FK → users
├── full_name         VARCHAR
├── date_of_birth     DATE NULL
├── primary_stroke    ENUM(free, back, breast, fly, im)
├── avatar_url        VARCHAR NULL
├── phone             VARCHAR NULL (E.164)
├── is_minor          BOOLEAN GENERATED (date_of_birth > now() - 16 years)
├── is_placeholder    BOOLEAN DEFAULT false
├── placeholder_token VARCHAR NULL UNIQUE
└── merged_into_user_id UUID NULL FK → users

athlete_invites
├── id              UUID v7 PK
├── team_id         UUID FK
├── invited_by      UUID FK → users (coach)
├── placeholder_id  UUID FK → users NULL
├── invite_token    VARCHAR UNIQUE (32 chars)
├── invite_method   ENUM(qr_code, link, email)
├── status          ENUM(sent, opened, completed, expired)
├── expires_at      TIMESTAMPTZ
└── created_at      TIMESTAMPTZ
```

### 8.3 Menores de idade (sem papel Parent)

- Registo self-service **bloqueado** se `date_of_birth` indica idade < 16 anos (EU).
- Treinador cria **placeholder** com nome + DOB → regista tempos na matriz.
- Quando atleta atinge idade ou clube valida offline, convite permite registo completo.
- Placeholder merge → conta atleta mantém histórico de `time_logs`.

### 8.4 Tokens e sessões

| Token | Duração | Storage | Claims |
|---|---|---|---|
| Access JWT | 15 min | Client memory | sub, role, org_id, team_ids[], locale |
| Refresh | 7 dias | HTTPOnly Secure SameSite=Strict cookie | — |
| Refresh hash | 7 dias | Redis + DB | Revogação instantânea |

**Rotação:** cada refresh gera novo token; reutilização de token antigo revoga toda a `family_id`.

### 8.5 Google OAuth — setup

1. Google Cloud Console → OAuth 2.0 Client ID (Web)
2. Redirect URI: `https://api.swimanalytics.com/api/v1/auth/google/callback`
3. Scopes: `openid email profile` (mínimos)
4. PKCE obrigatório
5. Account linking: email existente → confirmação antes de linkar

### 8.6 Autorização (RBAC + ABAC)

```
Roles:        admin | coach | swimmer

Permissions:  org:manage, team:read, team:write, workout:write,
              matrix:write, member:approve, billing:manage,
              gdpr:export, admin:metrics

ABAC:
  - coach → apenas teams/orgs onde é owner
  - swimmer → apenas own time_logs + allocated workouts
  - admin → audit_logs, metrics globais
  - billing:manage → apenas owner da organization
  - placeholder → time_logs writeable by coach; PII mínima (nome + DOB)
```

Implementação: `require_permission("matrix:write")` + query filters automáticos + RLS PostgreSQL.

---

## 9. Pagamentos, billing e GTM comercial

### 9.1 Planos B2B (clubes)

| Plano | Preço mensal | Preço anual | Limites |
|---|---|---|---|
| **Free** | €0 | €0 | 1 equipa, 15 atletas, 30 dias histórico |
| **Club** | €29 | €278 (–20%) | 3 equipas, 50 atletas, histórico ilimitado |
| **Pro** | €79 | €758 (–20%) | Equipas ilimitadas, 200 atletas, export CSV, API |
| **Enterprise** | Custom | Custom | SLA, SSO, multi-org, suporte dedicado |
| **Off-Season** | €9 | €86 (–20%) | Só leitura + export + análise época (Jul-Ago) |

Preços localizados via Stripe Price IDs por moeda (EUR, BRL, USD).

### 9.2 Mecanismos anti-churn (R5)

| Mecanismo | Implementação Stripe |
|---|---|
| **Season Pause** | `subscription.pause_collection` Jul-Ago; dados preservados |
| **Off-Season plan** | Downgrade automático sugerido em Junho; €9/mês |
| **Cobrança anual** | 20% desconto |
| **Win-back email** | Outbox: 30 dias após cancel → oferta 50% 3 meses |

### 9.3 Tabelas billing

```
organizations
├── id, name, slug (UNIQUE)
├── owner_user_id (FK → users)
├── country_code, default_locale, default_timezone, default_currency
├── stripe_customer_id (UNIQUE)
├── plan_tier          ENUM(free, club, pro, enterprise)
├── subscription_status ENUM(trialing, active, past_due, canceled)
├── trial_ends_at, current_period_end
├── settings           JSONB
├── created_at, updated_at, deleted_at

subscriptions
├── id, organization_id
├── stripe_subscription_id (UNIQUE)
├── stripe_price_id
├── status, current_period_start, current_period_end
├── cancel_at_period_end
└── metadata JSONB

invoices
├── id, organization_id
├── stripe_invoice_id (UNIQUE)
├── amount_cents, currency
├── status, pdf_url
└── created_at

payment_events (immutable audit trail)
├── id
├── stripe_event_id (UNIQUE — idempotency)
├── event_type, payload JSONB
├── processed_at, error
└── created_at
```

### 9.4 Webhooks Stripe

| Evento | Ação |
|---|---|
| `checkout.session.completed` | Ativar subscrição + outbox welcome |
| `customer.subscription.updated` | Sync plan_tier + limits |
| `customer.subscription.deleted` | Downgrade free + grace 7 dias |
| `invoice.payment_failed` | Email + status past_due |
| `invoice.paid` | Registar invoice + outbox receipt |

**Segurança:** verificar signature Stripe; idempotency via `stripe_event_id`; processar via outbox worker; nunca confiar no frontend.

### 9.5 Estratégia Go-To-Market (R4)

| Fase GTM | Acção | Objectivo |
|---|---|---|
| **Activación (M1-M3)** | Free generoso + placeholders + offline | Treinador usa no dia 1 sem pagar |
| **Piloto (M3-M6)** | 10 clubes early adopter: 3 meses Pro grátis | Case studies + feedback |
| **Conversão (M6-M12)** | PDF proposta junta + trial 90 dias + demo vídeo | Converter após aprovação orçamental |
| **Parcerias (M12+)** | Federações natação, associações treinadores | Canal de distribuição |

**KPIs GTM:**

| Métrica | Target M6 | Target M12 |
|---|---|---|
| Clubes activos (Free+) | 50 | 200 |
| Conversão Free → Paid | 15% | 25% |
| NPS treinadores | > 40 | > 50 |
| Churn mensal (excl. Jul-Ago) | < 5% | < 3% |

### 9.6 PCI-DSS

- Zero contacto com números de cartão — Stripe Checkout/Elements only
- Backend guarda apenas `stripe_customer_id` e metadados
- Scope: SAQ-A (questionário mais simples)

---

## 10. Modelo de dados completo

### 10.1 Diagrama ER

```
ORGANIZATION ──┬── TEAM ──┬── TEAM_MEMBER
               │          ├── SUBGROUP ── SUBGROUP_MEMBER
               │          └── WORKOUT ──┬── WORKOUT_BLOCK ── TIME_LOG
               │                        └── WORKOUT_ALLOCATION
               ├── SUBSCRIPTION
               ├── OUTBOX_EVENT
               └── AUDIT_LOG

USER ──┬── PROFILE (incl. is_placeholder)
       ├── OAUTH_ACCOUNT
       ├── REFRESH_TOKEN
       └── TEAM_MEMBER
```

### 10.2 Entidades de domínio

#### Teams

```
teams
├── id              UUID v7 PK
├── organization_id UUID FK
├── name            VARCHAR
├── join_code       VARCHAR(8) UNIQUE (alphanumeric)
├── coach_id        UUID FK → users
├── created_at, updated_at
```

#### Team Members

```
team_members
├── id           UUID v7 PK
├── team_id      UUID FK
├── user_id      UUID FK (nullable se placeholder ainda sem conta)
├── placeholder_profile_id UUID FK → profiles NULL  ← link placeholder
├── status       ENUM(pending, accepted, rejected, placeholder)
├── requested_at TIMESTAMPTZ
├── resolved_at  TIMESTAMPTZ NULL
├── resolved_by  UUID FK → users NULL
├── UNIQUE(team_id, user_id)
└── INDEX(team_id, status)
```

#### Workouts & Blocks

```
workouts
├── id                UUID v7 PK
├── team_id           UUID FK
├── title             VARCHAR
├── workout_date      DATE
├── shift             ENUM(morning, afternoon, evening)
├── total_distance_m  INTEGER
├── created_by        UUID FK → users
├── created_at, updated_at
└── INDEX(team_id, workout_date DESC)

workout_blocks
├── id                   UUID v7 PK
├── workout_id           UUID FK
├── block_order          SMALLINT
├── block_type           ENUM(warmup, main, recovery)
├── description          TEXT
├── repetitions          SMALLINT
├── distance_per_rep_m   INTEGER
├── target_rest_seconds  INTEGER
├── version              INTEGER DEFAULT 1  ← optimistic locking
├── created_at, updated_at

workout_allocations
├── id           UUID v7 PK
├── workout_id   UUID FK
├── target_type  ENUM(athlete, subgroup, team)
├── target_id    UUID (polymorphic)
└── INDEX(workout_id)
```

#### Time Logs (core performance)

```
time_logs
├── id                  UUID v7 PK
├── workout_block_id    UUID FK
├── athlete_id          UUID FK → users (NULLABLE after GDPR erasure)
├── rep_number          SMALLINT
├── time_centiseconds   INTEGER NOT NULL  ← 6542 = 65.42s
├── rpe                 SMALLINT NULL CHECK (1-10)
├── notes               TEXT NULL
├── recorded_by         UUID FK → users
├── recorded_at         TIMESTAMPTZ
├── UNIQUE(workout_block_id, athlete_id, rep_number)  ← UPSERT key
├── INDEX(athlete_id, workout_block_id)
└── INDEX(workout_block_id, athlete_id, rep_number)
```

#### Infraestrutura

```
idempotency_keys
├── key              VARCHAR PK
├── user_id          UUID FK
├── method           VARCHAR(10)
├── path             VARCHAR
├── request_hash     VARCHAR(64)
├── response_status  SMALLINT
├── response_body    JSONB
├── status           ENUM(processing, completed, failed)
├── expires_at       TIMESTAMPTZ
└── INDEX(expires_at)

outbox_events
├── id              UUID v7 PK
├── organization_id UUID FK
├── event_type      VARCHAR
├── payload         JSONB
├── status          ENUM(pending, processing, completed, dead)
├── attempts        SMALLINT DEFAULT 0
├── max_attempts    SMALLINT DEFAULT 5
├── next_retry_at   TIMESTAMPTZ
├── error_log       TEXT[]
├── created_at      TIMESTAMPTZ
├── processed_at    TIMESTAMPTZ NULL
└── INDEX(status, next_retry_at) WHERE status IN ('pending', 'processing')

audit_logs (PARTITION BY RANGE created_at, monthly)
├── id              UUID v7
├── organization_id UUID
├── user_id         UUID
├── action          VARCHAR
├── resource_type   VARCHAR
├── resource_id     UUID
├── ip_address      INET
├── user_agent      TEXT
├── request_id      VARCHAR
├── metadata        JSONB
├── created_at      TIMESTAMPTZ
├── INDEX(organization_id, created_at DESC)
└── INDEX(user_id, action)

sync_batches (offline idempotency)
├── client_batch_id  VARCHAR PK  ← UUID gerado no cliente
├── user_id          UUID FK
├── workout_id       UUID FK
├── entries_count    INTEGER
├── response_body    JSONB NULL
├── status           ENUM(processing, completed, failed)
├── created_at       TIMESTAMPTZ
├── completed_at     TIMESTAMPTZ NULL
└── INDEX(user_id, created_at DESC)
```

### 10.3 Row Level Security (PostgreSQL) — Fase 2

```sql
-- Activar RLS em tabelas sensíveis
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Política: atleta vê apenas os seus time_logs
CREATE POLICY swimmer_own_logs ON time_logs
  FOR SELECT USING (
    athlete_id = current_setting('app.current_user_id', true)::uuid
  );

-- Política: coach vê time_logs dos atletas aprovados nas suas equipas
CREATE POLICY coach_team_logs ON time_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_blocks wb
      JOIN workouts w ON w.id = wb.workout_id
      JOIN teams t ON t.id = w.team_id
      WHERE wb.id = time_logs.workout_block_id
        AND t.coach_id = current_setting('app.current_user_id', true)::uuid
    )
  );
```

API executa `SET LOCAL app.current_user_id = '<uuid>'` no início de cada transação.

### 10.4 Índices de performance

| Índice | Tabela | Colunas | Propósito |
|---|---|---|---|
| UPSERT key | time_logs | (workout_block_id, athlete_id, rep_number) UNIQUE | Matrix batch |
| Matrix query | time_logs | (workout_block_id, athlete_id, rep_number) | Leitura matriz |
| Team workouts | workouts | (team_id, workout_date DESC) | Listagem |
| Pending members | team_members | (team_id, status) | Fila aprovações |
| Outbox poll | outbox_events | (status, next_retry_at) partial | Worker |
| Idempotency cleanup | idempotency_keys | (expires_at) | Cron job |
| Sync batch lookup | sync_batches | (client_batch_id) PK | Idempotência offline |
| Peak queue depth | — | Redis LLEN peak_write_queue | Monitorização R7 |

---

## 11. API design

### 11.1 Convenções

| Aspecto | Padrão |
|---|---|
| Base path | `/api/v1/` |
| IDs | UUID v7 |
| Paginação | Cursor-based (`?cursor=xxx&limit=50`) |
| Sorting | `?sort=-created_at` |
| Filtering | `?status=pending&team_id=xxx` |
| Errors | RFC 7807 Problem Details |
| Idempotency | Header `X-Idempotency-Key` (POST/PUT/PATCH) |
| Correlation | Header `X-Request-ID` (auto-gerado se ausente) |
| Locale | Header `Accept-Language` |

### 11.2 Catálogo completo de endpoints

#### Auth

| Method | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Atleta self-register |
| POST | `/api/v1/auth/login` | Public | Email/password login |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Cookie | Revoke session |
| GET | `/api/v1/auth/google/login` | Public | Initiate Google OAuth |
| GET | `/api/v1/auth/google/callback` | Public | OAuth callback |
| POST | `/api/v1/auth/forgot-password` | Public | Send reset email |
| POST | `/api/v1/auth/reset-password` | Public | Reset with token |
| POST | `/api/v1/auth/verify-email` | Public | Verify email token |

#### Organizations & Teams

| Method | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/api/v1/organizations` | Coach | Create org (starts trial) |
| GET | `/api/v1/organizations/{id}` | Coach | Get org details |
| PATCH | `/api/v1/organizations/{id}` | Coach | Update org |
| POST | `/api/v1/organizations/{id}/teams` | Coach | Create team |
| GET | `/api/v1/organizations/{id}/teams` | Coach | List teams |
| POST | `/api/v1/teams/{id}/join-request` | Swimmer | Request to join |
| POST | `/api/v1/teams/{id}/placeholders` | Coach | **Criar atleta placeholder (R3)** |
| POST | `/api/v1/teams/{id}/invites` | Coach | **Gerar convite QR/link (R3)** |
| GET | `/api/v1/invites/{token}` | Public | Preview convite |
| POST | `/api/v1/invites/{token}/accept` | Auth | Atleta aceita convite |
| GET | `/api/v1/teams/{id}/members` | Coach | List members |
| PATCH | `/api/v1/teams/{id}/members/{uid}` | Coach | Approve/reject |
| POST | `/api/v1/teams/{id}/subgroups` | Coach | Create subgroup |
| GET | `/api/v1/teams/{id}/subgroups` | Coach | List subgroups |

#### Workouts & Matrix

| Method | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/api/v1/teams/{id}/workouts` | Coach | Create workout |
| GET | `/api/v1/teams/{id}/workouts` | Coach/Swimmer | List workouts |
| GET | `/api/v1/workouts/{id}` | Coach/Swimmer | Get workout |
| PATCH | `/api/v1/workouts/{id}` | Coach | Update workout |
| DELETE | `/api/v1/workouts/{id}` | Coach | Delete workout |
| POST | `/api/v1/workouts/{id}/blocks` | Coach | Add block |
| PATCH | `/api/v1/workouts/{id}/blocks/{bid}` | Coach | Update block |
| POST | `/api/v1/workouts/{id}/allocations` | Coach | Allocate athletes |
| GET | `/api/v1/workouts/{id}/matrix` | Coach/Swimmer | Read matrix |
| **POST** | **`/api/v1/workouts/{id}/matrix-batch`** | **Coach** | **Bulk UPSERT times ★** |
| **POST** | **`/api/v1/workouts/{id}/matrix-sync-batch`** | **Coach** | **Offline sync com client_batch_id ★** |
| GET | `/api/v1/workouts/{id}/matrix/delta` | Coach | **Delta desde timestamp (sync parcial)** |

#### Billing

| Method | Path | Auth | Descrição |
|---|---|---|---|
| GET | `/api/v1/billing/plans` | Public | Available plans (localized) |
| POST | `/api/v1/billing/checkout` | Coach | Stripe Checkout session (B2B) |
| POST | `/api/v1/billing/portal` | Coach | Stripe Customer Portal |
| POST | `/api/v1/billing/pause` | Coach | **Season Pause (R5)** |
| GET | `/api/v1/billing/subscription` | Coach | Current subscription |
| GET | `/api/v1/billing/invoices` | Coach | Invoice history |
| POST | `/api/v1/webhooks/stripe` | Stripe sig | Webhook handler |

#### GDPR & Users

| Method | Path | Auth | Descrição |
|---|---|---|---|
| GET | `/api/v1/users/me` | Auth | Get profile |
| PATCH | `/api/v1/users/me` | Auth | Update profile |
| GET | `/api/v1/users/me/export` | Auth | Async JSON export |
| DELETE | `/api/v1/users/me` | Auth | Right to erasure |

#### Admin & Health

| Method | Path | Auth | Descrição |
|---|---|---|---|
| GET | `/api/v1/admin/metrics` | Admin | Global KPIs |
| GET | `/api/v1/admin/audit-logs` | Admin | Audit trail |
| GET | `/api/v1/admin/organizations` | Admin | List all orgs |
| GET | `/api/v1/health` | Public | Liveness |
| GET | `/api/v1/health/ready` | Public | Readiness (DB + Redis) |

### 11.3 Matrix-batch — especificação detalhada

**Request:**

```http
POST /api/v1/workouts/{workout_id}/matrix-batch
Authorization: Bearer <access_token>
X-Idempotency-Key: <uuid>
X-Request-ID: <uuid>
Content-Type: application/json

{
  "block_version": 3,
  "entries": [
    {
      "athlete_id": "019xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "block_id": "019xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "rep_number": 1,
      "time": "01'01\"10",
      "time_parts": { "mm": 1, "ss": 1, "cc": 1 },
      "rpe": 7,
      "notes": "Bom split"
    }
  ]
}
```

**Backend flow:**

1. Rate limit: 120/min per user (Redis sliding window)
2. Idempotency check (Redis lock → DB lookup)
3. Validate coach permission + athlete allocation
4. Parse times → centiseconds via normalização `MM'SS"CC` (Pydantic `SwimTime`)
5. Check `block_version` matches DB (optimistic lock)
6. Single PostgreSQL UPSERT:

```sql
INSERT INTO time_logs (id, workout_block_id, athlete_id, rep_number,
                       time_centiseconds, rpe, notes, recorded_by, recorded_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
-- ... repeated for N entries
ON CONFLICT (workout_block_id, athlete_id, rep_number)
DO UPDATE SET
  time_centiseconds = EXCLUDED.time_centiseconds,
  rpe = EXCLUDED.rpe,
  notes = EXCLUDED.notes,
  recorded_by = EXCLUDED.recorded_by,
  recorded_at = EXCLUDED.recorded_at
RETURNING *;
```

7. Increment `workout_blocks.version`
8. Store idempotency response
9. Return updated entries + new version

**Target:** p99 < 50ms for 50 entries (online) | p99 < 200ms (horário nobre com peak queue).

### 11.4 Matrix-sync-batch — offline sync (R1)

**Request:**

```http
POST /api/v1/workouts/{workout_id}/matrix-sync-batch
Authorization: Bearer <access_token>
X-Client-Batch-Id: <uuid-v7-gerado-no-cliente>
Content-Type: application/json

{
  "client_created_at": "2026-08-16T18:45:00Z",
  "entries": [
    {
      "athlete_id": "uuid",
      "block_id": "uuid",
      "rep_number": 1,
      "time_parts": { "mm": 1, "ss": 1, "cc": 1 },
      "rpe": 7,
      "notes": null
    }
  ]
}
```

**Diferenças vs matrix-batch online:**
- Usa `X-Client-Batch-Id` em vez de (ou além de) `X-Idempotency-Key`
- Aceita `time` (`MM'SS"CC`) ou `time_parts` `{mm, ss, cc}` — preferir `time_parts` offline
- Normaliza: `1'01"1` → `01'01"10` → 6110 centiseconds
- **Não exige** `block_version` — merge last-write-wins por célula
- Regista em `sync_batches` para idempotência
- Reenvio seguro: mesmo `client_batch_id` → mesma resposta

---

## 12. Segurança, compliance, RGPD e menores

### 12.1 Rate limiting (Redis sliding window)

| Grupo | Limite | Chave |
|---|---|---|
| Auth login/register | 5/min | IP + email |
| Matrix batch | 120/min | user_id |
| Read API | 600/min | IP |
| Public register | 3/min | IP + Turnstile |
| Stripe webhooks | 100/min | Stripe signature |
| GDPR export | 1/hour | user_id |

### 12.2 Security headers (middleware obrigatório)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.stripe.com
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

### 12.3 Sanitização Pydantic v2

- **SanitizedStr:** NFC normalization → bleach HTML strip → control char removal → trim
- **SwimTime:** normaliza `MM'SS"CC` → centiseconds; pad min/seg à esquerda; pad centésimos à direita
- **Phone:** E.164 validation
- **Email:** lowercase normalization + DNS MX check (optional)

### 12.4 Compliance

| Regulamento | Requisito | Implementação |
|---|---|---|
| **GDPR** | Consentimento adultos | Checkbox registo + audit log |
| **GDPR** | Menores | Sem login < 16 anos; placeholder coach-managed |
| **GDPR** | Direito ao esquecimento | DELETE /users/me + anonimização time_logs |
| **GDPR** | Portabilidade | Export JSON async → R2 presigned URL |
| **GDPR** | Retenção | Audit 2 anos; time_logs anonimizados mantidos |
| **LGPD (BR)** | Menores | Placeholder; idade mínima configurável |
| **PCI-DSS** | SAQ-A | Stripe hosted checkout only |

### 12.5 Idempotência end-to-end

```
POST/PUT/PATCH request
  → Redis: SETNX idempotency:{key} "processing" EX 86400
  → If NX fails:
      → DB lookup: status=completed → return cached response
      → DB lookup: status=processing → 409 Conflict
  → Execute business logic in DB transaction
  → Store response in idempotency_keys table
  → Redis: DEL lock (or update to "completed")
  → Return response
TTL: 24 hours
```

---

## 13. Observabilidade e SLOs

### 13.1 SLOs

| Métrica | Target | Alerta | Notas |
|---|---|---|---|
| Matrix-batch p99 (online) | < 50ms | > 100ms | Condições normais |
| Matrix-batch p99 (pico 18h–20h) | < 100ms | > 200ms | Com peak queue activa |
| Offline sync success rate | > 99.5% | < 98% | Após regresso de rede |
| API availability | 99.9% | Health fail 2min | — |
| Auth login p99 | < 200ms | > 500ms | — |
| Outbox lag | < 30s | > 100 pending 10min | — |
| Error rate | < 0.1% | > 1% 5xx in 5min | — |
| Peak queue depth | < 50 | > 100 | Redis peak_write_queue |

### 13.2 Instrumentação

- **structlog:** JSON logs com request_id, user_id, duration_ms
- **OpenTelemetry:** spans para matrix_batch, outbox_process, stripe_webhook
- **Sentry:** exception tracking (free tier, sample 100% errors)
- **Better Stack:** uptime monitoring (free, 10 monitors)

### 13.3 Alertas

| Alerta | Condição | Canal |
|---|---|---|
| API down | health fail 2min | Email (Better Stack) |
| Error spike | > 1% 5xx in 5min | Sentry → Email |
| Outbox backlog | > 100 pending 10min | Sentry |
| Payment failures | > 3/hour | Email admin |
| DB pool exhaustion | > 80% | Sentry + activate peak queue |
| Peak queue backlog | > 100 items 5min | Slack — consider Neon upgrade |

---

## 14. Estrutura de projeto

```
vsc_app/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── redis.py
│   │   ├── idempotency.py
│   │   ├── rate_limit.py
│   │   ├── permissions.py
│   │   ├── peak_queue.py          ← R7: buffer writes horário nobre
│   │   ├── circuit_breaker.py
│   │   ├── middleware/
│   │   │   ├── security_headers.py
│   │   │   ├── request_id.py
│   │   │   ├── locale.py
│   │   │   └── timing.py
│   │   └── validators/
│   │       ├── swim_time.py
│   │       ├── sanitized_str.py
│   │       └── phone.py
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py
│   │   ├── dependencies.py
│   │   └── rls.py
│   ├── models/
│   │   ├── enums.py
│   │   ├── user.py
│   │   ├── oauth.py
│   │   ├── organization.py
│   │   ├── team.py
│   │   ├── workout.py
│   │   ├── time_log.py
│   │   ├── invite.py
│   │   ├── sync_batch.py
│   │   ├── billing.py
│   │   └── infra.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── organization.py
│   │   ├── team.py
│   │   ├── workout.py
│   │   ├── matrix.py
│   │   ├── billing.py
│   │   ├── gdpr.py
│   │   └── common.py
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── router.py
│   │       ├── auth.py
│   │       ├── organizations.py
│   │       ├── teams.py
│   │       ├── workouts.py
│   │       ├── matrix.py
│   │       ├── invites.py
│   │       ├── sync.py
│   │       ├── billing.py
│   │       ├── webhooks.py
│   │       ├── gdpr.py
│   │       ├── admin.py
│   │       └── health.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── oauth_service.py
│   │   ├── organization_service.py
│   │   ├── team_service.py
│   │   ├── workout_service.py
│   │   ├── matrix_service.py
│   │   ├── sync_service.py
│   │   ├── invite_service.py
│   │   ├── billing_service.py
│   │   ├── gdpr_service.py
│   │   ├── outbox_service.py
│   │   ├── audit_service.py
│   │   └── email_service.py
│   ├── workers/
│   │   ├── main.py
│   │   ├── settings.py
│   │   ├── outbox_processor.py
│   │   ├── email_handlers.py
│   │   ├── billing_handlers.py
│   │   ├── cleanup_handlers.py
│   │   └── peak_write_processor.py  ← R7
│   └── locales/
│       ├── pt-PT/
│       ├── pt-BR/
│       ├── en-US/
│       └── es-ES/
├── alembic/
│   ├── env.py
│   └── versions/
│       ├── 001_initial_schema.py
│       ├── 002_rls_policies.py
│       └── 003_audit_partitioning.py
├── tests/
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   │   ├── test_auth.py
│   │   ├── test_matrix_batch.py
│   │   ├── test_idempotency.py
│   │   ├── test_billing_webhooks.py
│   │   ├── test_gdpr.py
│   │   ├── test_offline_sync.py
│   │   ├── test_placeholders.py
│   │   └── test_peak_queue.py
│   └── performance/
│       └── test_matrix_latency.py
├── scripts/
│   ├── seed_dev.py
│   └── generate_keys.py
├── infra/
│   ├── docker-compose.yml           ← PG + Redis + PgBouncer + Mailpit
│   ├── docker-compose.prod.yml
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── terraform/
├── docs/
│   └── PLANO_MESTRE_SWIMANALYTICS.md  ← este documento
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
├── pyproject.toml
├── alembic.ini
├── .env.example
├── Makefile
└── README.md
```

---

## 15. Roadmap de implementação

### FASE 0 — Fundação (Semana 1)

> Esqueleto executável, zero features.

| ID | Tarefa | Done quando |
|---|---|---|
| 0.1 | `pyproject.toml` com deps pinadas | `pip install -e ".[dev]"` OK |
| 0.2 | `docker-compose.yml`: PG16 + Redis7 + **PgBouncer** + Mailpit | `docker compose up` OK |
| 0.3 | `app/core/config.py` — Pydantic Settings | `.env.example` completo |
| 0.4 | `app/db/` — AsyncEngine, sessionmaker, Base, mixins | Conexão async OK |
| 0.5 | Alembic async setup | `alembic upgrade head` OK |
| 0.6 | `app/main.py` — lifespan, CORS, middleware stack | `/health` → 200 |
| 0.7 | structlog + OpenTelemetry bootstrap | Logs JSON no stdout |
| 0.8 | Makefile: `dev`, `test`, `migrate`, `seed` | DX funcional |
| 0.9 | `.github/workflows/ci.yml` base | Push → lint + test pass |
| 0.10 | `.env.example` documentado | — |

### FASE 1 — Schema completo (Semana 1-2)

> Todas as tabelas, enums, índices, FKs.

| ID | Tarefa | Done quando |
|---|---|---|
| 1.1 | Enums (roles, statuses, block types, plan tiers) | `app/models/enums.py` |
| 1.2 | Models: User, Profile, OAuthAccount, RefreshToken | Unit tests |
| 1.3 | Models: Organization, Team, TeamMember, Subgroup | FK chain validada |
| 1.4 | Models: Workout, WorkoutBlock, WorkoutAllocation | Campo `version` |
| 1.5 | Models: TimeLog com UNIQUE constraint UPSERT | Constraint testada |
| 1.6 | Models: Subscription, Invoice, PaymentEvent | Stripe B2B |
| 1.7 | Models: AthleteInvite, SyncBatch | R3, R1 |
| 1.8 | Models: IdempotencyKey, OutboxEvent, AuditLog | Infra completa |
| 1.9 | Migration `001_initial_schema` | Todas as tabelas criadas |
| 1.10 | Índices compostos de performance | EXPLAIN confirma uso |
| 1.11 | Seed script dev (com placeholders) | `make seed` funciona |

### FASE 2 — Core transversal + RLS (Semana 2-3)

> Middlewares, validators, permissions, RLS.

| ID | Tarefa | Done quando |
|---|---|---|
| 2.1 | Security: argon2id hash, JWT access/refresh | Unit tests |
| 2.2 | Refresh token rotation + family revocation | Reuse → all revoked |
| 2.3 | Redis session store | Logout → token invalid |
| 2.4 | Idempotency middleware | Duplicate → cached response |
| 2.5 | Rate limiter sliding window | 6th login → 429 |
| 2.6 | Security headers middleware | All headers present |
| 2.7 | Request ID + Server-Timing middleware | Correlation nos logs |
| 2.8 | Pydantic validators: SwimTime, SanitizedStr, Phone | All formats parse |
| 2.9 | RBAC + ABAC permission engine | Coach ≠ other coach |
| 2.10 | RFC 7807 error responses | Consistent format |
| 2.11 | Locale middleware | Error messages i18n |
| 2.12 | Optimistic locking helper (por bloco) | Version mismatch → 409 |
| 2.13 | **Peak write queue + circuit breaker (R7)** | Pool > 80% → Redis queue |
| 2.14 | **PgBouncer config + pool tuning** | Max 20 conn app |
| 2.15 | Migration `002_rls_policies` | RLS activo |

### FASE 3 — Autenticação completa (Semana 3-4)

> Email/password + Google OAuth.

| ID | Tarefa | Done quando |
|---|---|---|
| 3.1 | POST /auth/register | Account + email sent |
| 3.2 | POST /auth/login + HTTPOnly cookie | JWT + cookie |
| 3.3 | POST /auth/refresh (rotation) | New tokens |
| 3.4 | POST /auth/logout | Cookie cleared |
| 3.5 | GET /auth/google/login (PKCE) | Redirect to Google |
| 3.6 | GET /auth/google/callback | User created/linked |
| 3.7 | POST /auth/forgot-password + reset | Email + token flow |
| 3.8 | POST /auth/verify-email | Account verified |
| 3.9 | Account linking (Google + existing email) | Confirmation required |
| 3.10 | get_current_user + role guards | All protected routes |
| 3.11 | Integration tests auth | 95%+ coverage |
| 3.12 | Bloqueio registo se idade < 16 anos | 403 + mensagem clara |

### FASE 4 — Organizations, Teams & Onboarding (Semana 4-5)

| ID | Tarefa | Done quando |
|---|---|---|
| 4.1 | POST /organizations (trial starts) | Org + Stripe customer |
| 4.2 | CRUD teams | Join code generated |
| 4.3 | POST /teams/{id}/join-request | Status = pending |
| 4.4 | PATCH /teams/{id}/members/{uid} | Outbox event emitted |
| 4.5 | Subgroups CRUD + members | — |
| 4.6 | Feature gating: athlete limit | 16th on free → 402 |
| 4.7 | Test: swimmer isolation | Unapproved → no data |
| 4.8 | Test: coach tenant isolation | Other org → 403 |

### FASE 4b — Placeholders & Convites (Semana 5) — **R3**

| ID | Tarefa | Done quando |
|---|---|---|
| 4b.1 | POST /teams/{id}/placeholders | Atleta placeholder criado |
| 4b.2 | Placeholder visível na matriz imediatamente | Coach regista tempos |
| 4b.3 | POST /teams/{id}/invites (QR/link/email) | Convite gerado |
| 4b.4 | POST /invites/{token}/accept | Merge placeholder → conta real |
| 4b.5 | Test: coach operacional em < 5 min | Zero atletas registados |
| 4b.6 | Test: merge preserva time_logs | Histórico intacto |

### FASE 5 — Workouts & Matrix (Semana 5-7)

> Core de negócio.

| ID | Tarefa | Done quando |
|---|---|---|
| 5.1 | Workout CRUD with blocks | Multi-block workout |
| 5.2 | Workout allocations | Targeting works |
| 5.3 | GET /workouts/{id}/matrix | Role-filtered |
| 5.4 | **POST /workouts/{id}/matrix-batch** | 50 entries, single query |
| 5.5 | Optimistic lock on block version | Concurrent → 409 |
| 5.6 | Performance test: p99 < 50ms | Benchmark passes |
| 5.7 | Idempotency on matrix-batch | Duplicate → same response |
| 5.8 | Rate limit 120/min | 121st → 429 |
| 5.9 | Integration tests matrix | UPSERT, conflict, isolation |

### FASE 5b — Offline Sync API (Semana 7) — **R1**

| ID | Tarefa | Done quando |
|---|---|---|
| 5b.1 | POST /matrix-sync-batch com client_batch_id | Idempotência offline |
| 5b.2 | Parser `time_parts` {mm, ss, cc} + normalização | `1'01"1` → 6110 cs |
| 5b.3 | Merge last-write-wins (sem block_version) | Conflito offline resolvido |
| 5b.4 | GET /matrix/delta?since=timestamp | Sync parcial |
| 5b.5 | sync_batches table + cleanup job | TTL 7 dias |
| 5b.6 | Test: reenvio client_batch_id → mesma resposta | Idempotente |
| 5b.7 | Test: 8h offline simulado → zero perda | Integridade |

### FASE 5c — PWA Frontend Matrix (Semana 7-9) — **R1 + R2**

| ID | Tarefa | Done quando |
|---|---|---|
| 5c.1 | PWA shell + Service Worker (Workbox) | App instalável |
| 5c.2 | IndexedDB sync queue (Dexie.js) | Writes offline persistem |
| 5c.3 | **Teclado `MM'SS"CC`** (Apêndice C) | 3 campos fixos; pad CC à direita |
| 5c.4 | Grid matriz virtualizado | 50+ atletas fluido |
| 5c.5 | Badge "X pendentes · offline" | UX clara |
| 5c.6 | Sync engine (retry + coalescing) | Auto-sync quando online |
| 5c.7 | Test utilizador: 20 tempos < 60s | Benchmark UX |

### FASE 6 — Billing & Stripe (Semana 8-9)

| ID | Tarefa | Done quando |
|---|---|---|
| 6.1 | Stripe customer on org signup | customer_id stored |
| 6.2 | GET /billing/plans | EUR + BRL prices |
| 6.3 | POST /billing/checkout | Checkout Session URL |
| 6.4 | POST /billing/portal | Portal URL |
| 6.5 | POST /webhooks/stripe | 200 + outbox queued |
| 6.6 | Handler: checkout.session.completed | Subscription active |
| 6.7 | Handler: subscription.updated/deleted | Plan synced |
| 6.8 | Handler: invoice.payment_failed | Email + past_due |
| 6.9 | Feature gating middleware | Limits enforced |
| 6.10 | Test: webhook idempotency | No double processing |
| 6.11 | Test: downgrade grace period | Limits after grace |
| 6.12 | **POST /billing/pause (Season Pause — R5)** | Subscrição pausada Jul-Ago |
| 6.13 | Plano Off-Season €9/mês | Stripe price configurado |
| 6.14 | Facturação anual -20% | Checkout anual funcional |
| 6.15 | PDF proposta clube (template) | Download para junta |

### FASE 7 — Outbox, Workers & Email (Semana 9)

| ID | Tarefa | Done quando |
|---|---|---|
| 7.1 | Outbox service (same DB transaction) | Atomic persist |
| 7.2 | ARQ worker setup | Worker connects Redis |
| 7.3 | Outbox processor | Events < 30s lag |
| 7.4 | Retry 5x → dead letter | DLQ populated |
| 7.5 | Email handlers (Resend/Mailpit) | Welcome, approved, payment |
| 7.6 | Cleanup jobs (idempotency, tokens) | Cron hourly |
| 7.7 | Test: SMTP failure → pending | No data loss |
| 7.8 | Test: retry on 3rd attempt | Success |
| 7.9 | **peak_write_processor worker (R7)** | Queue drenada < 30s |

### FASE 8 — GDPR & Admin (Semana 10)

| ID | Tarefa | Done quando |
|---|---|---|
| 8.1 | GET /users/me/export → R2 presigned URL | Complete JSON |
| 8.2 | DELETE /users/me (anonymize time_logs) | athlete_id → NULL |
| 8.3 | Audit log on PII reads/exports | IP + user_agent logged |
| 8.4 | Admin metrics endpoint | Orgs, MRR, users |
| 8.5 | Admin audit log viewer | Paginated |
| 8.6 | Migration `003_audit_partitioning` | Monthly partitions |
| 8.7 | Test: erasure preserves stats | PII gone, stats remain |
| 8.8 | Test: export completeness | All user data included |

### FASE 9 — Hardening & Launch (Semana 11-12)

| ID | Tarefa | Done quando |
|---|---|---|
| 9.1 | Load test matrix-batch (k6) — **50 clubes simultâneos 18h-20h** | p99 < 100ms |
| 9.2 | OWASP top 10 checklist | All addressed |
| 9.3 | CI/CD deploy staging (Fly.io) | Auto-deploy on merge |
| 9.4 | CI/CD deploy production | Manual approval gate |
| 9.5 | Sentry + Better Stack dashboards | SLOs visible |
| 9.6 | Runbook (incident response) | Documented |
| 9.7 | README setup guide | Dev productive in 15min |
| 9.8 | pip-audit + gitleaks in CI | Zero vulns/secrets |
| 9.9 | Backup strategy (Neon auto + R2) | Documented |
| 9.10 | Cloudflare DNS + SSL + Turnstile | Edge configured |
| 9.11 | Política privacidade menores + termos | Legal review |
| 9.12 | Test offline 8h + sync + peak load | R1 + R7 validated |

### FASE 10 — Off-Season Analytics (Semana 13-14) — **R5**

| ID | Tarefa | Done quando |
|---|---|---|
| 10.1 | Dashboard análise de época (treinador) | Volume, PBs, progressão |
| 10.2 | Relatório PDF época exportável | Download |
| 10.3 | Email win-back cancelamentos | Outbox trigger 30 dias |
| 10.4 | Sugestão auto Off-Season em Junho | In-app banner |

### FASE 11 — Escala infra (quando > 50 clubes) — **R7**

| ID | Tarefa | Done quando |
|---|---|---|
| 11.1 | Neon Launch upgrade + PgBouncer dedicado | Pool estável pico |
| 11.2 | Upstash upgrade | Redis headroom |
| 11.3 | Fly.io scale-to-multiple instances | HA |
| 11.4 | Read replica Neon (relatórios) | Queries read offloaded |

### Timeline visual

```
Semana  1      ██████████ Fase 0 + Fase 1 (fundação + schema)
Semana  2-3    ██████████ Fase 2 (core + RLS + peak queue)
Semana  3-4    ██████████ Fase 3 (auth + Google OAuth + idade mínima)
Semana  4-5    ██████████ Fase 4 (orgs + teams)
Semana  5      ██████████ Fase 4b (placeholders + convites ★)
Semana  5-7    ██████████ Fase 5 (workouts + matrix ★)
Semana  7      ██████████ Fase 5b (offline sync API ★)
Semana  7-9    ██████████ Fase 5c (PWA + teclado MM'SS"CC ★)
Semana  8-9    ██████████ Fase 6 (Stripe + Season Pause)
Semana  9      ██████████ Fase 7 (outbox + peak worker)
Semana  10     ██████████ Fase 8 (GDPR + admin)
Semana  11-12  ██████████ Fase 9 (hardening + LAUNCH)
Semana  13-14  ██████████ Fase 10 (off-season analytics)
Quando > 50    ██████████ Fase 11 (escala infra)
─────────────────────────────────────────────────────
MVP Launch: ~12 semanas
Custo infra MVP: €0/mês (free tiers)
```

---

## 16. Variáveis de ambiente

Ver ficheiro `.env.example` (a criar na Fase 0). Resumo:

```env
# App
APP_NAME=SwimAnalytics
APP_ENV=development
APP_DEBUG=true
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
SECRET_KEY=

# Database
DATABASE_URL=postgresql+asyncpg://swim:swim@localhost:5432/swimanalytics
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=
JWT_REFRESH_SECRET_KEY=
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CLUB_EUR=price_...
STRIPE_PRICE_PRO_EUR=price_...
STRIPE_PRICE_CLUB_BRL=price_...
STRIPE_PRICE_PRO_BRL=price_...

# Email
EMAIL_PROVIDER=mailpit
RESEND_API_KEY=
EMAIL_FROM=noreply@swimanalytics.com

# Storage
S3_ENDPOINT=
S3_BUCKET=swimanalytics-exports
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=auto

# Security
ENCRYPTION_KEY=
TURNSTILE_SECRET_KEY=
CORS_ORIGINS=["http://localhost:3000"]

# Observability
SENTRY_DSN=
LOG_LEVEL=INFO

# Worker
ARQ_MAX_JOBS=10
ARQ_JOB_TIMEOUT=300
```

---

## 17. Critérios de escalada (quando sair do free tier)

| Trigger | Acção | Custo estimado |
|---|---|---|
| > 400 MB DB (Neon 0.5 GB) | Upgrade Neon Launch ($19/mo) | ~€19/mo |
| > 8k Redis cmds/dia | Upgrade Upstash ($10/mo) | ~€10/mo |
| > 2 500 emails/mês | Upgrade Resend ($20/mo) | ~€20/mo |
| > 100 orgs activas | Fly.io paid ($5-15/mo) | ~€10/mo |
| > 5k Sentry events/mo | Upgrade Sentry ($26/mo) | ~€26/mo |
| **Pool > 80% em pico (18h-20h)** | **PgBouncer dedicado + Neon Launch** | ~€19/mo |
| **Peak queue depth > 50 regularmente** | **Fly.io 2.ª instância API** | ~€5/mo |
| **> 20 clubes activos simultâneos** | **Neon Launch + Upstash Pro** | ~€29/mo |
| Receita > €500/mo | Justifica investimento total | ~€85/mo |
| Expansão US/BR | Neon read replica + Fly.io region | ~€50/mo extra |
| > 10k atletas | AWS RDS + ElastiCache + ECS | ~€200/mo |

**Princípio:** escalar apenas quando métricas o exigem. Com PgBouncer + peak queue, free tier aguenta ~20-30 clubes no horário nobre. Para 50+ clubes, budget ~€30/mo.

---

## Apêndice A — Testes obrigatórios (CI gate)

| Categoria | Testes | Bloqueia merge |
|---|---|---|
| Idempotência | Duplicate key → cached; processing → 409 | Sim |
| Matrix batch | UPSERT integrity; 50 entries; p99 < 50ms | Sim |
| **Offline sync** | client_batch_id idempotente; 8h offline zero perda | Sim |
| **Placeholders** | Coach day-1; merge preserva time_logs | Sim |
| **SwimTime format** | `1'01"1` → `01'01"10` → 6110 cs | Sim |
| **Peak load** | 50 clubes simultâneos; p99 < 100ms | Sim |
| Isolamento | Swimmer A ≠ B; coach ≠ other org; RLS | Sim |
| Auth | Login, refresh rotation, OAuth, logout | Sim |
| Billing | Webhook idempotency; Season Pause; downgrade | Sim |
| Outbox | SMTP fail → retained; retry succeeds | Sim |
| GDPR | Erasure anonymizes; export complete | Sim |
| Security | pip-audit clean; gitleaks clean | Sim |

## Apêndice B — Checklist pré-launch

- [ ] Fases 0-9 completas (incl. 4b, 5b, 5c)
- [ ] Formato tempo `MM'SS"CC` validado (padding centésimos à direita)
- [ ] Offline sync validado em piscina (teste real)
- [ ] Load test horário nobre (50 clubes) passa
- [ ] SLOs validados em staging
- [ ] Cloudflare DNS + SSL + Turnstile configurados
- [ ] Stripe webhooks apontados para produção
- [ ] Google OAuth redirect URIs de produção
- [ ] `.env` produção via Doppler/Fly secrets
- [ ] Backup Neon verificado (restore test)
- [ ] Runbook de incidentes documentado
- [ ] Política de privacidade + termos de serviço
- [ ] DPO contact definido
- [ ] PDF proposta clube pronto para GTM

## Apêndice C — Especificação Teclado Swim `MM'SS"CC` (R2)

Teclado numérico custom para inserção de tempos. **Sempre 3 campos visíveis**, 2 dígitos máx. cada.

### Layout visual

```
┌─────────────────────────────────┐
│      01 ´ 01 " 10               │  ← Display (sempre 3 grupos)
├─────────────────────────────────┤
│  ┌──┐ ┌──┐   ┌──┐ ┌──┐   ┌──┐ ┌──┐
│  │ 0│1│ │ 2│   │ 4│5│   │ 7│8│ │ 9│  ← dígitos (exemplo agrupado)
│  └──┘ └──┘   └──┘ └──┘   └──┘ └──┘
│     MM          SS           CC
├─────────────────────────────────┤
│   1     2     3                 │
│   4     5     6                 │
│   7     8     9                 │
│   ⌫     0     ✓                 │
└─────────────────────────────────┘
```

### Comportamento de input

1. **Cursor avança dígito a dígito** dentro de cada campo (MM → SS → CC).
2. **Máximo 2 dígitos por campo** — terceiro dígito no mesmo campo é ignorado ou avança.
3. **Ao confirmar (✓)** ou sair da célula: normalizar padding.

### Regras de normalização (obrigatórias)

| Campo | Padding | Direcção |
|---|---|---|
| Minutos | `1` → `01` | Esquerda |
| Segundos | `1` → `01` | Esquerda |
| Centésimos | `1` → `10` | **Direita** (zero à direita) |

### Exemplos

| Durante input | Após normalizar | Centiseconds |
|---|---|---|
| `1´01"1` | `01´01"10` | 6110 |
| `_´32"5` | `00´32"50` | 3250 |
| `_´_5"0` | `00´05"00` | 500 |
| `10´00"00` | `10´00"00` | 60000 |

> **`1´01"1` = `01´01"10`** — o `1` isolado nos centésimos torna-se `10`, não `01`.

### Regras UX

1. **Teclado nativo nunca aparece** — `inputmode="none"`, eventos touch.
2. **Enter (✓)** — confirma, normaliza, avança para próxima célula da matriz.
3. **Swipe** — navega entre células (horizontal: reps; vertical: atletas).
4. **Feedback háptico** — vibração curta em confirmação.
5. **Display sempre mostra 3 grupos** — campos vazios como `_` ou `0` conforme estado de edição.

### Métricas alvo

| Métrica | Target |
|---|---|
| Tempo inserção 1 tempo | < 3 segundos |
| 20 tempos consecutivos | < 60 segundos |

## Apêndice D — Resumo executivo para investidores

### Problema
Treinadores de natação perdem dados por registo em papel/planilhas, especialmente em piscinas sem rede.

### Solução
Matriz de Velocidade offline-first com formato de tempo padronizado `MM'SS"CC`, sync automático e onboarding sem fricção (placeholders).

### Diferenciação
1. **Offline-first** — zero perda na piscina.
2. **Teclado `MM'SS"CC`** — 3 campos fixos, input rápido e sem ambiguidade.
3. **Day-1 activation** — placeholders; treinador opera sem atletas registados.
4. **Dois actores** — treinador escreve; atleta lê (modelo simples).

### Mercado
- ~500 clubes competição em PT; expansão ES, BR, FR.
- TAM B2B SaaS clubes: ~€15M/ano EU.

### Riscos mitigados
7 riscos identificados com mitigação concreta (secção 2).

### Timeline
- MVP Launch: 12 semanas
- Infra MVP: €0/mês

---

*Documento vivo v3.1.0 — actualizar a cada fase concluída.*
