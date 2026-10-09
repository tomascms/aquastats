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
- [x] testes web (78, inclui harness ML), tsc, eslint
- [~] axe completo: ver Fase D
- [x] Branch Neon `staging-hardening` (só esquema, 0 linhas) criada pela consola com o login do dono
- [!] Credencial de staging: geração bloqueada pelo classificador de segurança → dono cola em `.env.staging` ou autoriza
- [x] Postgres 16 local (pgserver, só localhost) com espelho do esquema de produção (fingerprint comparado)
- [x] Equipa sintética seed 9001 (32 atletas, 4 épocas, 93 812 tempos) — `.local/`, fora do git
- [x] Latências da API local com dados sintéticos
- [x] Lighthouse móvel nas páginas autenticadas (preview local do Worker)
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
- [x] `next` 16.3.8 (GHSA-vcvr-r3jv-pc5j) + `eslint-config-next` 16.3.8 — PR #14
- [x] `pyjwt`, `pypdf`, `cryptography`, `fastapi/starlette` atualizados com testes verdes — PR #14; wrangler 4.149.0
      (CVE-2026-96889 do `sharp`, publicado a 09/10)
- [x] CI verde (PR #14): typegen, tsc, lint, testes, build, Postgres 18, pip-audit, npm audit, gitleaks
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
- [x] Mesma suite no CI com `postgres:18`
- [x] Role `aquastats_auth` separada (migração 012): a role da API já não contorna a RLS mesmo com a flag
- [x] Login: mensagens uniformes (sem enumeração), password mínima 12
- [x] `next=` rejeita caracteres de controlo; `X-Request-Id` validado; limpeza do `_hits` do rate limit
- [x] Dependabot: triagem em `dependabot.md` (7 substituídos pelo #14; 3 majors abertos com razão)
- [x] `docs/security/` (modelo de ameaças, matriz RLS, controlos e limites)

## Fase C — Resiliência, concorrência, escalabilidade

- [x] `PUT /times`: upsert `ON CONFLICT` ordenado por `clientUpdatedAt` (migração 013); antigo: 5/8 gravações
      simultâneas rebentavam e um reenvio atrasado sobrescrevia; chave de idempotência inclui a hora da edição
      (corrige a perda silenciosa 31,40→31,20→31,40)
- [x] Testes de corrida contra Postgres (8 gravações simultâneas, reenvio atrasado, apagar antigo, relógio adiantado,
      6 abas a gravar previsões)
- [x] Seed sintético sem dados futuros (havia 22 210 tempos depois de hoje; números anteriores marcados como tal)
- [x] `/snapshot` (sintético 32×4, RLS ativa): treinador p50 4965→1867 ms, atleta 2689→681 ms; gzip 42,6→4,0 MB;
      janela de 120 dias primeiro (604 ms / 1,28 MB) e histórico depois
- [x] Modelo ML num Web Worker (resultados idênticos, testado); matriz TBT 10 331→610 ms, LCP 21,8→10,0 s
- [x] Ledger: `ON CONFLICT DO NOTHING`
- [x] Resultados ao vivo: 10 s por ficheiro, 25 s por execução, tudo ou nada; timeout Worker→API 30 s (120 s
      uploads) → 504 verificado
- [x] 10 índices duplicados removidos (migração 014)
- [x] Logs JSON em produção + uma linha por pedido (sem query string)
- [x] Ensaio de restauro PITR no staging (09/10): linha apagada recuperada numa branch no instante 11:01:35Z;
      branch pronta em < 10 s, dados verificados 48 s após o pedido (runbooks.md)
- [ ] Arranque a frio: otimizar arranque (gratuito)
- [x] Teste de carga local (`apps/api/scripts/load_test.py`): `PUT /times` p95 375 → 121 ms com leituras pesadas
      (desempenho.md); staging sem Cloud Run nem dados → não medido em staging
- [ ] 013/014 no staging Neon
- [x] Histórico pedido 2 s depois da primeira pintura; janela inicial de 42 dias pedida no `<head>`; matriz LCP
      5,6 → 3,8 s, TBT 662 → 40 ms (dados corrigidos; desempenho.md)

## Fase D — Velocidade e acessibilidade

- [x] Logótipos WebP à medida (135+88 → 25+6 KB), sem imagem escondida com prioridade, cache; `_next/image` desligado
- [x] Alvos de toque 44 px no login, contraste do texto pequeno, nome acessível dos links, sem prefetch de 32 atletas
- [x] Movimento reduzido já global; #418 não reproduzido no código atual
- [~] axe-core 4.13 completo (30 páginas × 390/1280 px): 10 regras, 166 nós → em correção; leitor de ecrã = teste manual

- [x] Auditoria de alegações (README, resumos CV, ficha ML): "validado em dados sintéticos, em validação em modo
      sombra"; previsão de provas qualificada; 3,4× sem fonte removido; capturas só com dados sintéticos
- [x] Relatórios de segurança fora de documentos públicos: o resumo CV deixou de descrever a falha ainda aberta em
      produção; `docs/security/` só no repositório privado (rever antes de publicar, ADR 0001)

## Fase E — Dashboards

- [x] "Hoje" do treinador (carga A:C, falta de tempos, bem-estar, ação sugerida, desde o último treino, semana vs anterior)
- [x] Nota de privacidade do atleta; tabelas alternativas nos gráficos de forma e de acerto
- [ ] Roadmap: previsão de provas futuras (exige v1.1 do modelo), comparação por escalão, capacidade vs esperado

## Fase F — Repositório e README

- [x] README, arquitetura, ADRs 0001–0003, runbooks, CONTRIBUTING, CHANGELOG, SECURITY, templates, LICENSE, resumo CV
- [x] Código e documentos mortos removidos; descrição e tópicos do repositório
- [x] CI: Postgres 18, pip-audit, npm audit, gitleaks (PR #14 verde); CodeQL indisponível em repositório privado gratuito

## Fase G — Produção (só com "autorizo o passo N")

- [ ] (nada executado)
