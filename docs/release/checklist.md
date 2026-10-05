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
- [~] Lighthouse móvel (páginas públicas de produção)
- [ ] testes web, tsc, eslint, build OpenNext, tamanho dos bundles
- [ ] axe (páginas públicas; páginas autenticadas só em staging com dados sintéticos)
- [!] Lighthouse/latências/planos das páginas autenticadas — precisa da branch de staging (login do dono na consola Neon)
- [~] Revisão de segurança do código e modelo de ameaças
- [~] Revisão de resiliência
- [ ] Relatório priorizado (`docs/release/fase-a-diagnostico.md`)

## Fase B — Segurança e isolamento

- [ ] Branch Neon só de esquema + `.env.staging`
- [ ] Role nova sem BYPASSRLS, permissões mínimas tabela a tabela
- [ ] Matriz de testes RLS (equipas, papéis, todas as tabelas e rotas) contra Postgres real
- [ ] Exceções `app.bypass_rls` documentadas
- [ ] Trigger do ledger vs apagamento em cascata (conta, atleta, equipa, saída com purga) — testes com rollback
- [ ] Cabeçalhos, cookies, rate limits, validação, enumeração/brute force, segredos
- [ ] Dependabot: triagem; seguros em lote; majors explicados antes
- [ ] `docs/security/` (modelo de ameaças, matriz RLS, controlos e limites)

## Fase C — Resiliência, concorrência, escalabilidade

- [ ] (a detalhar após o relatório da Fase A)

## Fase D — Velocidade e acessibilidade

- [ ] (a detalhar após o relatório da Fase A)

## Fase E — Dashboards

- [ ] (a detalhar)

## Fase F — Repositório e README

- [ ] (a detalhar)

## Fase G — Produção (só com "autorizo o passo N")

- [ ] (nada executado)
