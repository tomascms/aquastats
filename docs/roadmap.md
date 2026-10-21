# Aquastats — Plano de implementação (set. 2026)

Objetivo: no fim deste plano a Aquastats é, para um treinador de natação em Portugal, melhor do que o
SchoolFish.ai — que hoje é sobretudo promessa (closed alpha com 5 clubes, pago a partir do "Open Adoption").

## Princípio que manda em tudo

**Na piscina: rápido. Em casa: rigoroso. Sempre: limpo.**

- **Modo piscina** (telemóvel, mãos molhadas, 30 segundos entre séries): só o que é preciso *agora*.
  Botões grandes, 1 toque por ação, nada de menus fundos, funciona com rede fraca.
- **Modo casa** (portátil, com tempo): planear, analisar, comparar, adicionar informação às provas.
  Aqui pode haver densidade — tabelas, gráficos, atalhos de teclado.
- Cada funcionalidade nova tem de responder: *onde vive (piscina ou casa)?* e *o que tira do ecrã?*
  Se não couber, fica atrás de um "mais detalhes" ou de uma opção desligada por defeito.
- "Encontrar tudo": qualquer atleta, prova, treino ou competição a no máximo 2 toques, ou via pesquisa.

- **Zero burocracia**: nenhuma integração que exija candidatura, aprovação ou contrato com uma marca.
  Nível profissional máximo, mas só com o que se pode ligar diretamente.

Fora do âmbito (decidido): relatórios para pais, funcionalidades de proteção de menores, ficha radar
de avaliação do treinador, Garmin API (exige aprovação). Vídeo com anotações fica para depois.

---

## Ponto de partida (o que já existe)

| Área | Estado |
|---|---|
| Treinos: construtor por blocos/segmentos, intensidades, material, parciais marcados | ✅ |
| Registo de tempos por série/atleta com parciais (`time_logs`) | ✅ |
| Competições, inscrições, resultados com parciais, recordes pessoais | ✅ (entrada manual) |
| Análise de prova detalhada (`race_sessions`): reação, voo, subaquático (tempo, distância, pernadas), tempos aos 10/15/25/35/45/50, últimos 5 m, frequência e nº de braçadas por troço | ✅ backend + UI em `/coach/provas/nova` |
| Painel, estatísticas, progresso, comparar, zonas, what-if, treino | ✅ |
| Presenças com volume | ✅ |
| Plano de época (`season_plans`: macro, meso, competições, testes, volumes semanais) | ⚠️ só backend, **sem UI** |
| Importação de resultados oficiais | ❌ |
| Objetivos | ❌ |
| Wearables / FC | ❌ |
| Grupos por nível | ❌ |

A análise detalhada de provas — "a informação pela qual tanto lutaste" — **já tem modelo de dados**.
O trabalho é torná-la rápida de preencher, ligada aos resultados oficiais e muito mais útil na análise.

---

## Fase 0 — Fundações de UX (antes de somar funcionalidades)

0. ✅ **Idioma PT ⇄ EN** (feito a 2026-09-27 — `src/i18n/`): interruptor na barra lateral (treinador e atleta) e no ecrã de entrada.
   - Hoje todo o texto está escrito diretamente em português em ~130 ficheiros (~14k linhas) — é
     preciso extraí-lo para dicionários `src/i18n/pt.ts` e `src/i18n/en.ts` (o `pt` é a fonte; o
     TypeScript obriga o `en` a ter as mesmas chaves, assim nunca falta uma tradução).
   - Hook `useT()` + `LocaleProvider`; escolha guardada num cookie (e na conta, em `users.settings`)
     para o servidor já renderizar no idioma certo, sem piscar. `<html lang>` acompanha.
   - Datas, números e tempos formatados com `Intl` no idioma ativo (hoje `utils.ts` força `pt-PT`).
   - Mensagens de erro da API: o backend já tem `core/i18n.py` — passa a respeitar o idioma do
     pedido (`Accept-Language`/cookie).
   - Termos técnicos com tradução fixa e revista (ex.: "subaquático" → "underwater",
     "partida" → "send-off", "piscina curta" → "SCM").
   - A partir daqui, **todo o texto novo** entra já nos dois dicionários.

1. **Navegação**: manter 5 separadores (Calendário, Equipa, Competição, Análise, Definições) e
   acrescentar **"Época"** só quando a Fase 3 existir. Nada de separadores novos para objetivos ou
   wearables — vivem dentro da ficha do atleta.
2. **Ficha do atleta 360°** (`/coach/team/[id]`) como centro de tudo sobre um atleta, com secções:
   Resumo · Objetivos · Recordes · Provas (oficiais + informação adicionada) · Treino · Presenças.
   Cada funcionalidade nova liga-se aqui em vez de criar páginas soltas.
3. **Pesquisa global** (Ctrl+K no portátil, ícone de lupa no telemóvel): atletas, competições,
   treinos, provas. Endpoint `GET /api/v1/search?q=` sobre o snapshot da equipa (pode ser filtrado
   no cliente no início — o snapshot já vem todo).
4. **Componentes partilhados**: `TimeInput` (mm:ss.cc com teclado numérico), `DataTable` editável
   com navegação por teclado (Tab/Enter/setas, colar do Excel), `EmptyState`, `Sheet` (painel
   inferior no telemóvel, lateral no portátil). Tudo o resto usa estes.
5. **Migrações**: cada fase adiciona SQL em `apps/api/db/migrations/` e atualiza `schema.sql`;
   testes em `apps/api/tests/` por endpoint novo.

Esforço: ~1 semana + idioma PT/EN ~1–1,5 semanas.

---

## Fase 1 — Provas: oficiais + análise detalhada (prioridade máxima)

### 1A. Adicionar informação (modo casa)

O treinador vê o vídeo várias vezes e vai preenchendo; os eventos do início (reação → voo →
subaquático → 15 m) são demasiado seguidos para toques, por isso **é uma tabela**.

- **Layout**: linhas = pontos de controlo, colunas = métricas. Gerado a partir de prova + piscina:
  - Cabeçalho: Reação · Voo · Entrada (m) · Tempo oficial.
  - Uma linha por comprimento: Subaquático (s) · Dist. sub (m) · Pernadas · 5/10/15/25/35/45/50 m ·
    Nº braçadas · Frequência · Tempo de viragem (entrada 5 m → saída 10 m) · Últimos 5 m.
  - Colunas que não se aplicam à distância/piscina ficam escondidas (ex.: 50 livres em piscina de 50 m
    não tem viragem).
- **Preenchimento em várias passagens**: nada é obrigatório. Guarda automaticamente a cada célula
  (debounce + chave de idempotência já existente). Indicador de **completude** por prova
  (ex.: "18/24 campos") e realce das células vazias.
- **Teclado primeiro**: Tab/Enter avançam, `1234` → 12.34 s, colar uma coluna do Excel/Dartfish.
- **Validação suave**: avisa (não bloqueia) se os tempos não forem crescentes, se a soma não bater com
  o tempo oficial (diferença mostrada), ou se a frequência for implausível.
- **Métricas derivadas automáticas**: velocidade por troço, distância por braçada (DPS = velocidade /
  frequência × 60), índice de braçada (velocidade × DPS), tempo de viragem, % de tempo em
  subaquático, perda de velocidade nos últimos 5/15 m, tempo "start" (0–15 m) vs "nado livre".
- **Modelos**: o treinador escolhe que colunas usa normalmente (por equipa) — quem não mede pernadas
  não vê a coluna.

Backend: estender `_laps`/`RaceLap` com `turnIn5`, `turnOut10`, `entryDistM` e `notes`; guardar
`completeness` calculado. Ecrã: substituir o formulário atual de `/coach/provas/nova` pela tabela
(mantendo o que já funciona).

### 1B. Análise que ninguém tem

- **Comparar provas lado a lado** (já existe base em `/coach/provas/comparar`): sobrepor 2–4 provas
  (mesmo atleta em datas diferentes, ou atletas diferentes) troço a troço, com diferenças a verde/vermelho.
- **"Onde se ganhou / perdeu tempo"**: decomposição start / nado / viragens / chegada vs melhor prova.
- **Evolução de cada componente** ao longo da época (reação, 15 m, DPS...), não só do tempo final.
- **Ligação ao what-if/previsão existente**: "se o 15 m for igual ao melhor, o tempo previsto é X".

### 1C. Importação Lenex (.lxf / .lef)

- Upload na página da competição → o backend descompacta (`.lxf` é ZIP com XML) e lê
  `MEETS/SESSIONS/EVENTS/CLUBS/ATHLETES/RESULTS/SPLITS`.
- Filtra pelo clube do treinador (nome/código configurável nas Definições da equipa).
- **Emparelhamento de atletas**: por número de licença FPN (novo campo `license_id` em `athletes`),
  depois nome + ano de nascimento; ecrã de confirmação para casos duvidosos — nunca cria atletas
  silenciosamente.
- Cria/atualiza competição, inscrições, resultados e parciais oficiais, recalcula recordes pessoais.
- Cada resultado importado fica com botão **"Adicionar informação"** que abre a tabela 1A já preenchida com
  os parciais oficiais — é aqui que oficial e detalhe se juntam.
- Idempotente: reimportar o mesmo ficheiro não duplica nada.
- Segurança: limite de tamanho, parser XML sem entidades externas (`defusedxml`), validação de tudo.

### 1D. Integração SwimRankings (histórico e recordes)

- O SwimRankings **não tem API pública**. Antes de implementar: ler os termos de uso e o `robots.txt`;
  se não for permitido, contactar-os a pedir acesso ou usar só a alternativa abaixo.
- Se permitido: campo `swimrankings_id` no atleta; botão "Sincronizar histórico" (manual, não
  automático) que o backend usa para ler a página pública de recordes/resultados do atleta, com
  cache, limite de pedidos e host na lista SSRF permitida (`core/ssrf.py`).
- Importa: recordes pessoais por prova/piscina e histórico de resultados (marcados `source = "swimrankings"`).
- Alternativa sempre disponível: o SwimRankings e a FPN publicam resultados em Lenex — a 1C cobre.

Esforço: 1A+1B ~2–3 semanas · 1C ~1–2 semanas · 1D ~1 semana (depende dos termos).

---

## Fase 2 — Objetivos nos dois sentidos

Modelo `goals`: `athlete_id`, `author` (`coach` | `athlete`), `kind` (`time` | `technical` | `other`),
`stroke`, `distance_m`, `course`, `target_time`, `target_date` (ou competição alvo), `text`,
`status` (`active` | `achieved` | `dropped`), `achieved_at`, comentários curtos.

- **Treinador → atleta**: "o que espero de ti" (ex.: 100 livres abaixo de 58.5 no Nacional; reação < 0.65).
- **Atleta → treinador**: "o que quero alcançar", visível ao treinador, que pode comentar.
- Objetivos de tempo ligam-se automaticamente aos resultados: barra de progresso (atual vs alvo),
  marcados como atingidos sozinhos quando um resultado/recorde bate o alvo.
- Objetivos técnicos podem ligar-se a uma métrica da análise de provas (ex.: 15 m, DPS) — isto é
  o que o SchoolFish não tem.
- Onde aparecem: ficha do atleta (treinador), página inicial do atleta, e no ecrã da competição
  ("objetivos para esta prova").

Esforço: ~1–1,5 semanas.

---

## Fase 3 — Plano de época (feito como deve ser)

O backend já existe (`season_plans`); falta UI e ligação aos treinos.

- **Vista cronograma** (modo casa): linha do tempo da época com camadas — macrociclos, mesociclos,
  microciclos (semanas), competições (A/B/C), testes, taper. Arrastar para mudar datas.
- **Por semana**: volume planeado, distribuição por zonas de intensidade, nº de sessões, foco.
- **Planeado vs realizado**: o volume e as zonas realizados vêm dos treinos e presenças já
  registados → gráfico semanal lado a lado, com desvio destacado.
- **Carga**: carga semanal (volume × intensidade; mais tarde FC dos wearables), relação aguda:crónica
  para alertar subidas bruscas.
- **Taper**: modelo com redução de volume configurável (% por semana) antes da competição A.
- **Ligação ao calendário**: ao criar um treino, o treinador vê em que meso/semana está e o que o plano
  pede; pode gerar a estrutura da semana a partir do plano.
- Vários grupos → vários planos (um por grupo), com modelo reutilizável na época seguinte.
- Novo separador "Época" na navegação.

Esforço: ~2–3 semanas.

---

## Fase 4 — Grupos por nível (sem ruído)

- Os atletas da equipa têm um nível opcional (A/B/C ou nome livre) — `groupName` já existe.
- No construtor de treinos, cada segmento continua a ter **uma** partida. Um interruptor por segmento,
  **desligado por defeito**, "Partidas por nível" revela uma linha extra com partida (e opcionalmente
  distância/repetições) por nível.
- No modo piscina, cada atleta vê/regista apenas a versão do seu nível; o treinador vê o nível como
  uma etiqueta pequena, não como colunas extra.
- Volume e cargas calculados com a versão do nível de cada atleta.

Esforço: ~1 semana.

---

## Fase 5 — Frequência cardíaca no treino (Polar, Whoop, ficheiros .FIT)

A FC pertence **ao treino**, não à ficha do atleta: vê-se no treino, por atleta e por série.

- **Sem aprovações de marcas**: só integrações com acesso de programador aberto.
  - **Polar AccessLink** e **Whoop API**: registo de programador self-service. O atleta liga a conta
    dele uma vez (OAuth); tokens cifrados na base de dados; sincronização pelo outbox existente.
  - **Upload de ficheiro .FIT/.TCX**: cobre qualquer relógio (Garmin, Coros, Suunto, Apple via
    exportação) sem API nem contrato. O atleta exporta a atividade e carrega-a — ou arrasta vários de uma vez.
  - Garmin API: **não** (exige candidatura).
- **Associação automática** da atividade do relógio ao treino Aquastats por data/hora do turno.
- **No ecrã do treino**: FC média/máx. por série e por atleta ao lado dos tempos já registados
  (quando o relógio grava voltas, cada volta ↔ repetição); zonas de FC da sessão; FC de
  recuperação entre séries. Tudo numa coluna/linha discreta, que só aparece se houver dados.
- **Na análise de treino** (`/coach/provas/treino`): relação tempo × FC ao longo da época
  (mesmo ritmo com FC mais baixa = evolução).
- **No plano de época**: a carga passa a usar FC quando existe (TRIMP), senão volume × intensidade.
- Extra do Whoop/Polar (HRV, recuperação, sono) preenche automaticamente o `wellness` que já existe.

Esforço: .FIT ~1 sem. · Polar + Whoop ~1,5–2 sem.

---
## Fase 6 — Acabamento: modo piscina impecável

- **PWA com funcionamento offline**: registar tempos sem rede e sincronizar depois (fila local +
  chaves de idempotência já existentes no backend).
- Ecrã de treino ao vivo revisto com a regra "1 toque por ação"; testes num telemóvel real à beira da piscina.
- Tempos de carregamento < 1 s nas páginas principais; auditoria de acessibilidade (contraste, tamanho de toque).
- Exportar para PDF/Excel: treino do dia, análise de prova, plano de época.

Esforço: ~1–2 semanas.

---

## Ordem e calendário indicativo

| # | Fase | Esforço |
|---|---|---|
| 0 | Fundações de UX (ficha 360°, pesquisa, componentes) | 1 sem. |
| 1 | Provas: adicionar informação, análise, Lenex, SwimRankings | 4–6 sem. |
| 2 | Objetivos nos dois sentidos | 1–1,5 sem. |
| 3 | Plano de época | 2–3 sem. |
| 4 | Grupos por nível | 1 sem. |
| 5 | Wearables (FC no treino) | 2–3 sem. |
| 6 | Modo piscina offline e acabamento | 1–2 sem. |

Cada fase termina com: testes do backend, verificação no browser (telemóvel e portátil), e uso real
pelo treinador durante pelo menos uma semana antes de avançar.

---

## Resultado final vs SchoolFish

| | SchoolFish (prometido) | Aquastats no fim do plano |
|---|---|---|
| Disponível hoje | Closed alpha, 5 clubes por convite | Em produção |
| Preço | Pioneer grátis (50 vagas); depois 500–2000 $ por clube + atletas pagam | Grátis / barato para clubes pequenos |
| Língua e contexto | Inglês, genérico | Português, FPN, Lenex, SwimRankings |
| Construtor de treinos e registo de tempos | Prometido | ✅ |
| Análise detalhada de prova (reação, voo, sub, 15 m, parciais 5/10 m, FR, DPS, viragens) | Parciais, frequência e braçadas | ✅ mais completa + tabela "Adicionar informação" + decomposição de tempo ganho/perdido |
| Resultados oficiais (Lenex) | Prometido | ✅ + ligação direta a "Adicionar informação" |
| Histórico SwimRankings | ❌ | ✅ (se os termos permitirem) |
| Objetivos | Treinador define | ✅ nos dois sentidos + ligados a métricas técnicas |
| Plano de época / taper / carga | Prometido | ✅ com planeado vs realizado |
| Grupos por nível | Prometido | ✅ |
| Wearables | Polar, Firstbeat | ✅ Polar, Whoop, .FIT (qualquer relógio, incl. Garmin) — FC dentro do treino |
| Offline na piscina | ? | ✅ |
| Rede social / IA entre clubes | Prometido (visão de longo prazo) | Não para já — precisa de escala |

---

## Melhorias futuras (revisto a 21/10/2026)

O estado em 21/10/2026 (versão 1.1, projeto fechado; ver [`estado-final.md`](estado-final.md)): estão em produção a
auditoria de segurança de 17/10, os tempos explicados no treino e na competição
([`natacao/tempos-explicados.md`](natacao/tempos-explicados.md)), o RGPD e a retenção automática. A lista segue por
ordem de impacto e é trabalho futuro.

### 1. Provar com dados reais (prioridade máxima)
- **Piloto com 2 ou 3 clubes durante uma época.** O modelo v1.0 e os tempos explicados só foram validados com a
  demo sintética. Medir o acerto com o `prediction_ledger`, que já guarda cada previsão.
- **Opinião do treinador em cada explicação:** um toque "útil / não bate certo". Diz quais os motivos que coincidem
  com o que se vê na piscina e serve de base para a v1.1.
- **Registo mais rápido no cais:** testar num telemóvel real, com as mãos molhadas, e um modo offline com
  sincronização (as piscinas têm má rede).

### 2. Tempos explicados: próximos passos
- ~~**Linguagem igual em toda a app.**~~ Feito (21/10): os ecrãs anteriores usam os três estados.
- **"O treino batia com a prova?"** Escolher as séries pelo ritmo-alvo da prova em causa, não só pela zona.
  Distinguir um 400 de um 50.
- **Versão para o atleta:** os mesmos chips com frases escritas para o nadador, sem críticas à carga.
- **Novos motivos quando houver dados:** frequência cardíaca no treino (Polar), técnica (frequência e distância por
  braçada) e viragens.
- **Relatório semanal automático para o treinador:** um email curto com as semanas fora do costume.
- **Exportar a análise de uma prova** (PDF de uma página) para reuniões com o atleta ou os pais.
- **Previsão de provas futuras** (modelo v1.1), só depois de validada com dados reais.
- **Comparação por escalão** só contra a média do próprio clube, para não desmotivar os mais novos.

### 3. Confiança
- ~~**RGPD com dados de menores**~~ Feito (consentimento parental, termos, exportação, retenção automática de 3 anos,
  modelo de acordo com os clubes). Falta a **revisão jurídica** dos textos.
- ~~**Backups:**~~ Feito a 09/10 (repetir a cada trimestre): um teste de restauro real (restauro de um momento no Neon para um branch) documentado em
  [`runbooks.md`](runbooks.md), repetido a cada trimestre.
- **Monitorização com alertas:** os erros do browser já chegam aos logs; os alertas automáticos ficam de fora por
  decisão do dono (pagos a partir de 2027). A vigilância é manual ([`runbooks.md`](runbooks.md)).
- ~~**Fecho da Fase G**~~ Feito (21/10): `aquastats_app` já não existe; password de `neondb_owner` rodada.
- ~~**Falhas da auditoria abertas por decisão**~~ Corrigidas a 20/10 (#10, #15, #16 e #17).
- **Testes de isolamento entre rotas** em falta (meet-results, season-plans, attendance, hr, predictions), já
  listados como risco residual.

### 4. Credibilidade desportiva
- **Revisão da metodologia** (indicadores, zonas, tempos explicados) por um treinador de alto nível ou pela FPN, e
  publicação dessa revisão em `docs/natacao/`.
- **Alertas pagos**, se um dia o orçamento deixar de ser 0 €.

### 5. Abrir ao mundo
- Interface completa em inglês (o `en.ts` já existe) e depois em espanhol; piscinas em jardas.
- Importação LENEX e Meet Manager de outros países (a base já existe).
- Integrações com Garmin, Apple Watch e FORM.

### 6. Engenharia
- ~~Builds automáticos ligados ao git, sem perder a autorização manual para produção.~~ Feito: workflow `Deploy`
  no GitHub Actions, arrancado à mão pelo dono (no GitHub Free não há *required reviewers* em repositórios
  privados), com verificação no site e reversão documentada em [`runbooks.md`](runbooks.md).
- ~~Testes E2E para os chips, os cartões e a análise da prova.~~ Feito (`apps/web/e2e/tempos.spec.ts`).
- Os 3 ficheiros só com CRLF: resolvido. No repositório estão em LF e o `.gitattributes` (`* text=auto eol=lf`)
  impede que voltem; o CRLF era só da cópia local (`core.autocrlf`).
- ~~Decidir a licença e o nome do autor.~~ Feito: licença proprietária, titular Tomás Sousa.
- ~~Token da Cloudflare no GitHub.~~ Feito (21/10): o workflow publica as três partes.
