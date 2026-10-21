# Estado final (21/10/2026, versão 1.1)

## Em produção

| Parte | Onde | Versão |
|---|---|---|
| API | Cloud Run `aquastats-api` (`europe-west3`) | revisão `aquastats-api-00044-9gp` (código `bcd7fca` + `CRON_SECRET`) |
| Site | Worker Cloudflare `aquastats-web` (`aquastats.net`) | versão `341d97f0` (código `bcd7fca`) |
| Base de dados | Neon `polished-fog-70080186`, branch `production` | migrações até à 017 |
| Retenção | Cloud Scheduler `aquastats-retencao`, todos os dias às 04:00 (Lisboa) | segredo `aquastats-cron-secret` |

A API corre com as roles `aquastats_api` e `aquastats_auth` (RLS ativa, sem BYPASSRLS). A role antiga `aquastats_app`
já não existe e a password de `neondb_owner` foi rodada a 21/10. Custo: 0 € (orçamento GCP de 1 € com alertas por email).

## Como operar

Tudo em [`runbooks.md`](runbooks.md). Resumo:

- **Publicar a API:** Actions → Deploy → Run workflow em `main`, com **Publicar** marcado (o arranque manual é a
  aprovação do dono). Só arranca com o CI verde e verifica a revisão e o `/api/v1/health` no fim.
- **Publicar o site e o Worker de IA:** a partir do PC, com `opennextjs-cloudflare` e `wrangler` (secção "Deploy
  manual"). O workflow não os publica enquanto não houver `CLOUDFLARE_API_TOKEN` no GitHub.
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
- Sem token da Cloudflare no GitHub, por agora (opcional; ver runbook).
- PR do Dependabot da web (#48) por rever quando houver minutos do Actions.

## Trabalho futuro

Lista completa em [`roadmap.md`](roadmap.md) ("Melhorias futuras"). Fora deste fecho: revisão jurídica dos textos
RGPD, revisão metodológica por um treinador de alto nível ou pela FPN, piloto com clubes reais, alertas pagos,
inglês e espanhol, integrações (Garmin, Apple, FORM).
