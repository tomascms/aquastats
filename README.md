# Aquastats

[![CI](https://github.com/tomascms/aquastats/actions/workflows/ci.yml/badge.svg)](https://github.com/tomascms/aquastats/actions/workflows/ci.yml)

Gestão de uma equipa de natação para o treinador e os atletas: construtor de treinos, cronometragem em matriz
na beira da piscina, competições e análise de prova, época e carga, objetivos, bem-estar, frequência cardíaca,
recordes e um modelo de previsão de tempos. Feito para o telemóvel, em português europeu com inglês completo.

Site: <https://aquastats.net> · Código proprietário, repositório privado ([ADR 0001](docs/adr/0001-licenca-e-autoria.md)).

| Treinador: "quem merece atenção hoje" | Cronometragem | Atleta |
|---|---|---|
| ![Vista da manhã do treinador](docs/img/coach-home-360.png) | ![Matriz de cronometragem](docs/img/matrix-360.png) | ![Página do atleta](docs/img/swimmer-360.png) |

Capturas de um ambiente local com uma **equipa sintética** (nomes "Sintético N"), nunca dados reais.

## O problema e para quem

Um treinador cronometra dezenas de repetições por treino, com o telemóvel numa mão e o cronómetro na outra, e
depois quer saber quem está em forma, quem está sobrecarregado e o que esperar na próxima prova. Os atletas
querem ver a sua evolução e os objetivos sem expor os dados aos colegas.

## O que faz

- **Treinos e cronometragem:** séries por bloco, grupos, cronometragem tecla a tecla com fila offline; cada
  gravação é idempotente e ordenada pela hora da edição no dispositivo (sem corridas entre dois treinadores).
- **Competições:** inscrições, resultados, ficheiros oficiais (Lenex/PDF, leitura assistida por IA) e
  resultados ao vivo; análise de prova (parciais, frequência, distância por braçada).
- **Época e carga:** macrociclos, carga aguda:crónica (EWMA), simulação de taper.
- **Treinador, "Hoje":** quem merece atenção e porquê (carga, falta de tempos, bem-estar) com a ação sugerida.
- **Atleta:** evolução, objetivos com progresso, recordes, bem-estar, e uma nota clara sobre o que o treinador vê.
- **Modelo de previsão (v1.0, em sombra):** ver abaixo.

## Arquitetura

```mermaid
flowchart LR
  P[Telemóvel / browser] -->|HTTPS| W[Cloudflare Worker<br/>Next.js 16 via OpenNext]
  W -->|/api/v1/* proxy, X-Edge-Auth| A[Cloud Run<br/>FastAPI · europe-west3]
  A -->|aquastats_api · RLS| D[(Neon Postgres 18<br/>eu-central-1)]
  A -->|aquastats_auth · só autenticação| D
  A --> G[Gemini / Worker de IA<br/>leitura de documentos]
  A --> X[Polar · Google OAuth · Resend]
  W -.->|Web Worker no browser| M[Modelo ML v1.0]
```

Detalhe, modelo de dados e decisões: [docs/arquitetura.md](docs/arquitetura.md) e [docs/adr/](docs/adr/).

## Modelo de previsão (resumo honesto)

Modelo de estado hierárquico (v1.0) que prevê o tempo de cada repetição e de provas, com intervalos calibrados.
**Validado só em dados sintéticos:** em todos os cenários do gerador erra ~0,16 pontos percentuais menos do que o
modelo anterior e prevê 100 % das repetições (o anterior cobria 24–77 %). A produção ainda não tem dados reais
suficientes para o confirmar; por isso corre **em sombra** (grava previsões num ledger imutável e o treinador
continua a ver o modelo anterior). Não mostra probabilidades de quebra de série nem "saída recomendada".
Ficha completa: [docs/ml/README.md](docs/ml/README.md).

## Segurança e privacidade

- Isolamento na base de dados (RLS) com uma role sem BYPASSRLS para os pedidos de equipa e outra só para a
  autenticação; o atleta só vê os seus dados. Provado por 40+ testes contra Postgres real.
- Apagar um atleta ou uma conta apaga tudo o que lhe pertence, previsões incluídas.
- Sessões HttpOnly/Secure/SameSite, CSRF por origem, argon2id, mensagens de login sem enumeração, rate limit.
- Detalhe e limites conhecidos: [docs/security/](docs/security/). Auditoria própria, não substitui um pentest.

## Desempenho e resiliência (medidos)

Equipa sintética de 32 atletas × 4 épocas (93 813 tempos), API local com a RLS ativa, telemóvel simulado pelo
Lighthouse. Linha de base completa em [docs/release/fase-a-diagnostico.md](docs/release/fase-a-diagnostico.md).

| Medida | Antes | Depois |
|---|---:|---:|
| `GET /snapshot` do treinador (p50) | 4 965 ms | 1 867 ms (janela de 120 dias: 604 ms) |
| `GET /snapshot` do atleta (p50) | 2 689 ms | 681 ms |
| Snapshot transferido | 39–43 MB | 4,0 MB (janela: 1,3 MB) |
| Matriz de cronometragem: bloqueio do ecrã (TBT) | 10 331 ms | 610 ms |
| Matriz de cronometragem: LCP | 21,8 s | 10,0 s |
| 8 gravações simultâneas da mesma célula | 5 falhavam | 0 falham |
| Carga local (20 treinadores, 60 s): `PUT /times` p95 | — | 708 ms com leituras pesadas, 102 ms sem |

## Correr localmente

```bash
# API (Python 3.12) — usa uma base local; o arranque recusa a base de produção
cd apps/api
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
cp .env.example .env          # DATABASE_URL de uma base local ou de staging
PYTHONPATH=src .venv/Scripts/uvicorn app.main:app --reload --port 8000

# Dados sintéticos para demonstração
cd ../web && npx tsx scripts/export-synthetic.ts --athletes 30 --seasons 4 --seed 9001 --out ../../.local/synthetic.json
cd ../api && DATABASE_URL=postgresql://postgres@127.0.0.1:5432/aquastats .venv/Scripts/python scripts/seed_synthetic.py ../../.local/synthetic.json

# Site (Next.js 16)
cd ../web && npm ci && npm run dev    # http://localhost:3000
```

## Testes

| Comando | O quê |
|---|---|
| `cd apps/api && pytest` | API; com `TEST_ADMIN_DATABASE_URL` (Postgres local) corre também a suite de RLS, cascatas e corridas |
| `cd apps/web && npm test` | Lógica do site, harness e *golden* do modelo |
| `npx next typegen && npx tsc --noEmit`, `npm run lint` | Tipos e lint |
| `npx tsx scripts/ml-backtest.ts --seeds tune …` | Backtest do modelo (ver [docs/ml/harness.md](docs/ml/harness.md)) |

O CI corre tudo isto com Postgres 18, `pip-audit`, `npm audit` e gitleaks em todo o histórico.

## Deploy e operação

Comandos oficiais (`gcloud`, `wrangler`), reversão, restauro e incidentes: [docs/runbooks.md](docs/runbooks.md).
Plano de produção desta versão: [docs/release/fase-g-plano.md](docs/release/fase-g-plano.md).

## Roadmap

Previsão de provas futuras com intervalo (modelo v1.1), comparação por escalão, resumo semanal, Turnstile no
login, segredos no Secret Manager, CSP com nonces, tarefa agendada para os resultados ao vivo. Avaliar o modelo
desafiante com dados reais logo que haja algumas semanas de tempos cronometrados.
