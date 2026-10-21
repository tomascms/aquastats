# Estado final (21/10/2026, versão 1.1)

## Em produção

| Parte | Onde | Versão |
|---|---|---|
| API | Cloud Run `aquastats-api` (`europe-west3`) | revisão `aquastats-api-00045-vsz` (código `6e7ee49`) |
| Site | Worker Cloudflare `aquastats-web` (`aquastats.net`) | versão `9f446eb7` (tag `6e7ee493d40d`) |
| Worker de IA | Worker Cloudflare `aquastats-ai` | versão `c1761fd3` (tag `6e7ee493d40d`) |
| Base de dados | Neon `polished-fog-70080186`, branch `production` | migrações até à 017 |
| Retenção | Cloud Scheduler `aquastats-retencao`, todos os dias às 04:00 (Lisboa) | segredo `aquastats-cron-secret` |

A API corre com as roles `aquastats_api` e `aquastats_auth` (RLS ativa, sem BYPASSRLS). A role antiga `aquastats_app`
já não existe e a password de `neondb_owner` foi rodada a 21/10. Custo: 0 € (orçamento GCP de 1 € com alertas por email).

## Como operar

Tudo em [`runbooks.md`](runbooks.md). Resumo:

- **Publicar:** Actions → Deploy → Run workflow em `main`, com **Publicar** marcado (o arranque manual é a
  aprovação do dono). Só arranca com o CI verde, publica só as partes que mudaram (API, site, Worker de IA) e
  verifica cada uma no fim. O deploy a partir do PC fica como alternativa (secção "Deploy manual").
- **Depois de cada deploy:** a lista de 5 minutos em "Monitorização e alertas" (health, logs sem 5xx nem
  `aquastats.client_error` novos).
- **Retenção:** ensaio sem efeitos com `?dry=1` (ver runbook); os resultados de cada dia ficam nos logs da API.
- **Reverter, restaurar, migrar:** secções "Reversão", "Restauro (PITR)" e "Migrações" do runbook.

## Por decisão do dono

- Sem alertas automáticos pagos; a vigilância é manual, pelos logs.
- Orçamento 0 €; qualquer custo novo para e pergunta primeiro.
- Produção só com "autorizo" explícito.
- Sem *Environment* com revisor no GitHub (o plano gratuito não o tem em repositórios privados): o arranque manual do
  workflow é a aprovação.
- PR do Dependabot da web (#48) fechado: o `@opennextjs/cloudflare` ≥ 1.20.10 traz um `glob` vulnerável; o
  Dependabot volta a propor quando houver correção.
- Orçamentos de $0 no GitHub (Actions, Codespaces, Packages, Git LFS, IA) com uso bloqueado: nunca há cobrança;
  se os 3 000 min grátis do Actions acabarem, o CI para até ao mês seguinte.

## Trabalho futuro

Lista completa em [`roadmap.md`](roadmap.md) ("Melhorias futuras"). Fora deste fecho: revisão jurídica dos textos
RGPD, revisão metodológica por um treinador de alto nível ou pela FPN, piloto com clubes reais, alertas pagos,
inglês e espanhol, integrações (Garmin, Apple, FORM).
