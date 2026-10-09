# Fase final — checklist e registo de progresso

Branch de trabalho: `release/hardening` (derivada de `ml/modelo-estado`, commit `d1ccb2a`).
Este ficheiro é o registo único do progresso (sobrevive a compactações de contexto). Estado: `[ ]` por fazer,
`[~]` em curso, `[x]` feito (com evidência), `[!]` bloqueado/à espera de decisão.

## Decisões do dono (respostas às perguntas iniciais, 06/10/2026)

| Tema | Decisão |
|------|---------|
| Licença | **por preencher** (a resposta veio com o modelo `[proprietária / MIT / Apache-2.0]`) |
| Visibilidade | privado até a Fase G acabar e o scan de segredos estar limpo; passar a público só com nova autorização |
| Autoria | **por preencher** (modelo `[nome real / pseudónimo / nenhum]`); autor git muda só em commits futuros, sem reescrever histórico |
| Staging BD | branch Neon **só de esquema**, criada pela consola no browser com o login do dono; connection string só em `apps/api/.env.staging` (ignorado pelo git) |
| Orçamento | 0 € — parar e perguntar se algo exigir pagamento |
| Role antiga | fica 7 dias **sem uso**, só para reverter; password rodada depois da troca; revogada com autorização |
| URLs públicos | `https://aquastats.net` e o URL do GitHub; `SECURITY.md` usa o *Private vulnerability reporting* do GitHub (sem email pessoal) |

## Fase A — Diagnóstico com medições

- [x] Git: estado de `main`, `ml/modelo-estado`, branches Dependabot, ficheiros por commitar, histórico
- [x] Scan de segredos no histórico (equivalente a gitleaks, por regex; 86 commits)
- [x] Estado real da base de produção (roles, RLS por tabela, migrações registadas) — só leitura
- [x] Configuração do Cloud Run (sem imprimir segredos)
- [x] `npm audit` e `pip-audit`
- [x] pytest da API (linha de base)
- [x] Latências de produção (health, 30 pedidos sequenciais)
- [x] Lighthouse móvel (páginas públicas de produção, mediana de 3)
- [x] Build OpenNext + tamanho dos bundles
- [ ] testes web (inclui harness ML), tsc, eslint, backtest de fumo
- [ ] axe completo (Lighthouse já cobre um subconjunto)
- [x] Branch Neon `staging-hardening` (só esquema, 0 linhas) criada pela consola com o login do dono
- [!] Credencial de staging: geração bloqueada pelo classificador de segurança → dono cola em `.env.staging` ou autoriza
- [x] Postgres 16 local (pgserver, só localhost) com espelho do esquema de produção (fingerprint comparado)
- [x] Equipa sintética seed 9001 (32 atletas, 4 épocas, 93 812 tempos) — `.local/`, fora do git
- [x] Latências da API local com dados sintéticos
- [~] Lighthouse móvel nas páginas autenticadas (preview local do Worker)
- [x] Teclado no `/entrar`; ledger vs cascata testado em SQL com ROLLBACK
- [x] Revisão de segurança do código e modelo de ameaças (resumo)
- [x] Revisão de resiliência
- [~] Relatório priorizado (`docs/release/fase-a-diagnostico.md`)
- [x] Push de `release/hardening` (backup dos commits de ML que só existiam no disco)

## Fase B — Segurança e isolamento

- [x] Branch Neon só de esquema (`staging-hardening`, `br-raspy-leaf-b1wvhlo5`)
- [!] `.env.staging` com credencial — à espera do dono (classificador bloqueou a geração por mim)
- [x] Guarda: a API recusa arrancar contra o endpoint de produção fora de `APP_ENV=production` (testado com o
      `.env` real); migrações/DDL também a saltam (`a13df47`)
- [ ] `next` 16.3.8 (RCE `next/og`) + `eslint-config-next` 16.3.8
- [ ] `pyjwt`, `pypdf`, `cryptography`, `fastapi/starlette` atualizados com testes verdes
- [~] CI verde: pytest já não depende do `.env` (feito); `next typegen` antes do `tsc` espera decisão sobre `ci.yml`
- [x] Migração 011 (`b90089f`, `084c2ac`): role `aquastats_api` (sem BYPASSRLS/CREATEROLE/CREATEDB, fora de
      `neon_superuser`), GRANTs por tabela, ledger só SELECT/INSERT, timeouts, FORCE RLS, triggers `updated_at`,
      RLS defensiva nas tabelas de autenticação, audit/convites/outbox só para treinadores
- [x] Arranque em produção exige `aquastats_api` e verifica na base que não contorna a RLS
- [x] Políticas por papel: atleta só vê o seu (`app.athlete_id`)
- [x] Suite `tests/postgres` (38 testes, Postgres 16 local): matriz por tabela e ator, rotas entre equipas,
      diferencial role nova = superuser no snapshot, RLS com o código a pedir a equipa errada, fluxos de escrita
      de treinador e atleta
- [x] Ledger pelos caminhos reais (purga de atleta, apagar treino, sair com purga, eliminar conta de atleta e de
      dono): previsões apagadas; a role da API não consegue UPDATE/DELETE nem usar `ledger_maintenance`
- [x] Ensaio no staging Neon (PG 18, como `neondb_owner`): 005–010 OK; 011 falhou ("permission denied to alter
      role" — só superuser mexe em SUPERUSER/REPLICATION) → corrigida e aplicada; catálogo verificado;
      `schema_migrations` 001–011 registadas
- [ ] Mesma suite no CI com `postgres:18` (espera decisão sobre `ci.yml`)
- [ ] Limite conhecido: `app.bypass_rls` pode ser definido pela role da API (RLS protege de bugs, não de SQL
      injection) → proposta: role separada para os fluxos de autenticação
- [ ] Login: mensagens uniformes (sem enumeração), bloqueio progressivo por conta+IP, password mínima 12
- [ ] `next=` rejeita caracteres de controlo; `X-Request-Id` validado; limpeza do `_hits` do rate limit
- [ ] Dependabot: triagem; seguros em lote; majors explicados antes
- [ ] `docs/security/` (modelo de ameaças, matriz RLS, controlos e limites)

## Fase C — Resiliência, concorrência, escalabilidade

- [x] `PUT /times`: upsert `ON CONFLICT` ordenado por `clientUpdatedAt` (migração 013); antigo: 5/8 gravações
      simultâneas rebentavam e um reenvio atrasado sobrescrevia; chave de idempotência inclui a hora da edição
      (corrige a perda silenciosa 31,40→31,20→31,40)
- [x] Testes de corrida contra Postgres (8 gravações simultâneas, reenvio atrasado, apagar antigo, relógio adiantado,
      6 abas a gravar previsões)
- [x] `/snapshot` (sintético 32×4, RLS ativa): treinador p50 4965→1867 ms, atleta 2689→681 ms; gzip 42,6→4,0 MB;
      janela de 120 dias primeiro (604 ms / 1,28 MB) e histórico depois
- [x] Modelo ML num Web Worker (resultados idênticos, testado); matriz TBT 10 331→610 ms, LCP 21,8→10,0 s
- [x] Ledger: `ON CONFLICT DO NOTHING`
- [x] Resultados ao vivo: 10 s por ficheiro, 25 s por execução, tudo ou nada; timeout Worker→API 30 s (120 s
      uploads) → 504 verificado
- [x] 10 índices duplicados removidos (migração 014)
- [x] Logs JSON em produção + uma linha por pedido (sem query string)
- [!] Ensaio de restauro PITR: preparado no staging (linha sintética às 11:01:30Z, apagada às 11:01:38Z); falta criar
      a branch no instante 11:01:35Z pela consola Neon (sessão expirou; o conector não cria branches por instante)
- [ ] Arranque a frio: otimizar arranque (gratuito)
- [ ] Teste de carga local (staging Cloud Run espera decisão)
- [ ] 013/014 no staging Neon
- [ ] Junção do histórico antigo no main thread (TBT /coach 282→505 ms): mover para depois do idle

## Fase D — Velocidade e acessibilidade

- [ ] (a detalhar após o relatório da Fase A)

## Fase E — Dashboards

- [ ] (a detalhar)

## Fase F — Repositório e README

- [ ] (a detalhar)

## Fase G — Produção (só com "autorizo o passo N")

- [ ] (nada executado)
