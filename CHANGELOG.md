# Registo de alterações

## [Por lançar]

### Erros do browser nos logs (custo 0 €)
- Erros de JavaScript da web vão para os logs da API (`POST /api/v1/client-errors`): só rota, mensagem e stack
  curtos, sem dados pessoais, com CSRF e limite de 10/min.
- Sem alertas automáticos (os do Cloud Monitoring passam a ser pagos em 2027). Runbook: secção "Monitorização e
  alertas", com onde ver os logs e o que verificar depois de cada deploy.

### RGPD: menores, termos, retenção e direitos do titular
- Atletas com menos de 13 anos (Lei 58/2019, art. 16.º): o registo, a escolha de perfil e o convite pedem a data de
  nascimento e, abaixo dos 13, o email de um responsável parental, que recebe um link assinado (7 dias) para
  autorizar ou recusar. Até lá, a API não guarda sono, RPE, recuperação nem frequência cardíaca (bem-estar, upload
  de FC e Polar respondem 403 com uma mensagem clara). Retirar a autorização apaga esses dados. Migração 017
  (`parental_consents`, com RLS).
- Termos e condições novos (`/termos`) e política de privacidade revista (`/privacidade`), em PT e EN, marcados
  para revisão jurídica; o registo exige aceitar os termos e guarda a versão e a data.
- Exportar os meus dados (JSON) nas definições; eliminar conta já existia (o texto passa a dizer que apaga tudo).
- Retenção: as contas inativas há 3 anos são apagadas, com aviso por email 30 dias antes
  (`POST /api/v1/auth/internal/retention`, chamado pelo Cloud Scheduler).
- Auditoria #15: o registo responde sempre o mesmo; o dono de uma conta existente recebe um email a avisar.
- Modelo de acordo de tratamento de dados para clubes em `docs/legal/`. Licença: titular "Tomás Sousa".

### Deploy pelo GitHub
- Workflow `Deploy` (`.github/workflows/deploy.yml`): arranca à mão em `main` com o CI verde, publica só as partes
  que mudaram (API no Cloud Run, site e Worker de IA na Cloudflare) e verifica cada uma no site (commit servido,
  `/api/v1/health`, `/entrar`). Se falhar, diz como reverter. Sem marcar "Publicar" é um ensaio (build e
  `--dry-run`). Autenticação sem chaves longas: Workload Identity Federation no GCP e um token Cloudflare só com
  Workers Scripts:Edit. Guia em `docs/runbooks.md`; o deploy manual a partir do PC fica como alternativa.
- Testes E2E dos tempos explicados: chips do treino (caixa por teclado e por toque), cartão da semana no perfil e
  "o que a prova diz do treino" na competição.

### Tempos explicados: treino e competição
- Treino: cada tempo é um chip nos três estados (mais rápido do que costuma, normal ou mais lento), com até 3
  motivos ao tocar, a curva da série numa frase e "Esta vez vs a última". As séries deixam de usar "provavelmente",
  "quase de certeza" e "devia".
- Perfil do atleta: cartão da semana com os motivos, a época semana a semana e frases do que costuma coincidir com
  os tempos e com as melhores provas.
- Competição: cada prova abre "o que a prova diz do treino" (resultado, como chegou, treino vs prova, parciais e o
  que foi diferente do recorde).
- Associações, nunca causas; o dia da semana não é motivo. O modelo v1.0 só é exposto, sem alterações.
  Documentação em `docs/natacao/tempos-explicados.md`.

### Segurança: auditoria de 17/10/2026
- RLS: só o treinador escreve treinos, provas, épocas, presenças e a equipa (migração 015, aplicada em produção).
- O proxy da web deixa de inventar o `Origin`; a API volta a recusar mutações sem Origin nem Referer.
- Lockout por IP e por conta, cooldown no "esqueci-me da palavra-passe", hostname validado no Turnstile e
  Turnstile ligado em produção.
- O access token deixa de valer depois do logout, da mudança ou reposição da palavra-passe (`token_version`,
  migração 016). A API recusa arrancar em produção se não conseguir confirmar a role da BD (3 tentativas). Os
  resultados live ligam-se ao IP verificado (DNS rebinding).
- Leitor de IA dos resultados live: o lugar deixa de ser confundido com a pista. Relatório em
  `docs/security/auditoria-2026-10-17.md`.

### Época no telemóvel, testes E2E, CSP com nonces, Turnstile e custo
- Época: no telemóvel, um cartão por semana com os 7 dias lado a lado (km por dia, competições a vermelho, hoje
  marcado); a tabela fica para ecrãs largos.
- Testes E2E (Playwright, viewport de telemóvel) contra a demo sintética, também no CI: cronometrar, resumo do
  atleta, análise de prova, relatório do treino, vista do atleta e CSP sem violações.
- CSP com nonce por pedido e `'strict-dynamic'` (sem `unsafe-inline` nos scripts); `worker-src` para o modelo.
- Cloudflare Turnstile no login e no registo, verificado na edge; desligado até haver chaves.
- Custo: orçamento GCP de 1 € com alertas; Cloud Run e Neon confirmados a escalar a zero.

### Revisão do treinador e repositório para portefólio
- "Hoje" conta o volume dos grupos em paralelo uma vez por turno, como o calendário (antes 29 km contra 17 km).
- Um só formato de tempo em toda a app: `1:06,42` (decisão D7); antes os recordes usavam `01'06"42`.
- Análise de prova: com mais volume antes da prova diz "Sem polimento: o volume subiu X %" (antes "só desceu
  -52 %"); reação de 0,10 s já conta; "Chegou mais rápido" só quando a semana não está "no devido".
- Relatório do treino e Evolução: "mais rápido/mais lento que o habitual" em vez de "acima/abaixo"; as séries que
  mudaram aparecem primeiro; "Suave" em vez de "SUAVE".
- Equipa e listas de atletas por ordem natural em português (2 antes de 10, acentos no sítio certo).
- Competições e recordes mostram "A carregar…" enquanto chega o histórico, em vez de "Ainda não há".
- Matriz: cada sessão paralela mostra o volume, para distinguir os grupos.
- Atleta: "Tempos neste treino" quando o último treino não é de hoje.
- Pontos "World Aquatics" em vez de "FINA"; texto do SwimRankings sem atalhos de teclado.
- README em inglês com galeria (WebP), README.pt.md, SECURITY e CONTRIBUTING em inglês, índice de `docs/` e
  dos resultados do modelo; títulos dos treinos sintéticos em português.

### Visualização para o treinador (PR #28)
- Treino "Como correu o treino?": frase de conclusão, "Correu bem / A melhorar" com o dado, o que coincidiu e uma
  opção para a próxima; cartão por série; cada atleta comparado com o seu erro típico, certeza em palavras.
- Análise › Treino: "Evolução" por tipo de série substitui "Modelo".
- "Carga" substitui "Carga A:C"; análise de prova contra o recorde pessoal (reação, parciais, ritmo, polimento).
- Atleta: "O teu último treino" e provas escritas para o nadador.
- Removidos: "Quem merece atenção", "Como se calculou", plano de prova, "Planeado vs feito", CSS e aderência de
  intensidade por ritmo /100 m, prova mais forte e mais fraca.
- Navegação abaixo de 300 ms (Atleta 1,9 s → 0,14 s; Treino 1,0 s → 0,08 s).
- Repositório público: README com resumo em inglês, exemplos dos parsers com nomes inventados (ADR 0001).

### Produto para o treinador
- Perfil do atleta "Que nadador é e o que treinar agora?": nível por pontos WA, CSS, zonas pessoais, aderência de
  intensidade, queda de ritmo e sinais de treino com dado, razão, incerteza e alternativa (ADR 0004).
- Época: distribuição de zonas da equipa vs referência indicativa da fase.
- Fiabilidade do modelo passa para "Como se calculou".
- `lib/indicators.ts` com testes; documentação em `docs/natacao/` (referências com fontes, gerador, indicadores,
  produto, guia do treinador).

### Dados sintéticos
- Gerador 4.0: 6 níveis (iniciação a elite) ancorados em pontos World Aquatics, razões de distância e estilo dos
  recordes mundiais, zonas na CSS 200/400, todas as reps dos presentes cronometradas, faltas registadas, parciais e
  reação, grupos de treino por nível, teste CSS de 7 em 7 semanas; invariantes G1–G8 no CI.
- Corrige: blocos com vários segmentos só simulavam o 1.º.

### Modelo
- v1.0.1: corrige uma fuga (o prior de fadiga de um atleta novo usava séries de colegas do mesmo dia).

## [1.0.0] — 2026-10-11

### Segurança
- Roles `aquastats_api` (sem BYPASSRLS) e `aquastats_auth` (só autenticação); RLS por equipa e por papel; o atleta
  só vê os seus dados; a API recusa roles que contornem a RLS (migrações 011–012).
- Next.js 16.3.8 (GHSA-vcvr-r3jv-pc5j), starlette 1.7.0, PyJWT 2.15.1, cryptography 50.0.2, pypdf 6.19.0.
- Login sem enumeração, passwords novas com 12+ caracteres, `next=` sem caracteres de controlo, IPs validados.
- A API recusa arrancar contra a base de produção fora de `APP_ENV=production`.

### Fiabilidade
- Gravação de tempos num só upsert ordenado pela hora da edição (migração 013); previsões sem duplicados.
- Timeouts Worker→API (504), orçamento de 25 s nos resultados ao vivo, bulkhead nos snapshots, logs JSON.

### Desempenho
- Snapshot em janela (42 dias primeiro, pedidos no `<head>`; competições incluídas), gzip fora do *event loop*,
  recordes em SQL; modelo num Web Worker; índices duplicados removidos (migração 014); logótipos WebP.
  Medido localmente, com dados sintéticos: matriz com LCP de 5,6 → 3,8 s e `PUT /times` p95 com leituras
  pesadas de 375 → 121 ms (`docs/release/desempenho.md`).
- Etiqueta "Volume total" no atleta: o valor é o de todas as épocas, não o do treino do dia.

### Produto
- Fase E: carga A:C ao longo do tempo, mesociclos, comparação de períodos, planeado vs. feito, semana do atleta.
- "Hoje": quem merece atenção e a ação sugerida; nota de privacidade do atleta; tabelas alternativas aos gráficos;
  alvos de toque de 44 px no login.

### Modelo
- Modelo de estado v1.0 em sombra, ledger imutável de previsões (migração 010), backtest e ficha do modelo.
