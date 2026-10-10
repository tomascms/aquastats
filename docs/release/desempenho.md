# Desempenho — medições (antes/depois)

Todas as medições usam **dados sintéticos** (equipa de demonstração, seed 9001: 32 atletas, 4 épocas, 71 636
tempos até à data da medição) e correm **localmente**: API em `uvicorn` (1 processo), Postgres 16 local com as
migrações 001–014 e RLS ativa (roles `aquastats_api`/`aquastats_auth`), site no Worker local (`wrangler dev`).
O gerador de carga corre na mesma máquina que a API e a base, o que soma ruído (±30 ms no p95 entre corridas).

**Staging:** não foi possível medir em staging. Não existe serviço Cloud Run de staging, e a branch Neon
`staging-hardening` não tem dados. A credencial da role de staging continua por aplicar (item 5). Os números
abaixo são locais.

## Correção da linha de base (09/10/2026)

O gerador simula épocas inteiras e a exportação incluía **22 210 tempos com data futura** (até 07/2027). A "janela
de 120 dias" medida antes (604 ms, 1,28 MB) transportava, na prática, cerca de 10 meses de dados. A exportação
(`apps/web/scripts/export-synthetic.ts`) passou a cortar tudo o que é posterior ao dia de hoje. Os números
anteriores a esta data, em `fase-a-diagnostico.md` e no ADR 0003, foram medidos com o conjunto antigo. A linha de
base abaixo foi **medida de novo** com o código anterior e os dados corrigidos.

## Gravações de tempos sob leituras pesadas

Comando: `python apps/api/scripts/load_test.py <API> <dias>`. São 20 treinadores durante 60 s, com 70 % de
`PUT /times`, 10 % de `GET /snapshot` e 20 % de `GET /auth/me`.

| Medida | Antes (código anterior) | Depois |
|---|---:|---:|
| `PUT /times` p95, mistura com snapshot de 120 dias | 375 ms | **121 ms** |
| `PUT /times` p50, mesma mistura | 81 ms | 51 ms |
| `GET /snapshot` 120 dias p50 / p95 | 325 / 719 ms | 143 / 277 ms |
| `PUT /times` p95, janela que o site passa a pedir (42 dias) | — | **110 ms** |
| `PUT /times` p95, sem snapshots (piso) | 72 ms | — |

Causas e correções, por ordem de efeito medido:

1. O gzip de respostas de vários MB corria no *event loop* (`GZipMiddleware`) e parava todos os pedidos. Passou
   para a thread do snapshot; o zlib liberta o GIL.
2. Os recordes pessoais obrigavam a ler e hidratar em Python todas as inscrições e resultados de todas as épocas.
   Passaram a uma consulta `DISTINCT ON` no Postgres. O resultado é igual ao anterior: 128 recordes, os mesmos
   tempos, verificado contra o código antigo.
3. As competições, inscrições e resultados seguem a janela `since`/`before`, como os treinos.
4. Treinos, inscrições e resultados são lidos como linhas simples, não como objetos ORM.
5. Há no máximo 1 snapshot em construção por instância (era 2).
6. O pedido de histórico (`before`) devolve só o que o site junta.

Tentado e retirado: encurtar o *switch interval* do GIL (1 ms) não teve efeito mensurável (375 → 345 ms, dentro do
ruído).

## Primeira pintura (Lighthouse móvel, 4G simulado, CPU 4×)

Os valores são a mediana de 3 execuções, no Worker local, com as contas sintéticas. A coluna "antes" corresponde
ao site anterior com os dados corrigidos.

| Página | LCP antes | LCP depois | TBT antes | TBT depois | Bytes antes | Bytes depois |
|---|---:|---:|---:|---:|---:|---:|
| Matriz de cronometragem | 5,6 s | **3,8 s** | 662 ms | 40 ms | 3 218 KB | 409 KB |
| `/coach` | 5,4 s | **3,6 s** | 922 ms | 51 ms | 3 187 KB | 437 KB |
| `/swimmer` | 3,8 s | 3,4 s | 66 ms | 55 ms | 499 KB | 375 KB |

O LCP observado (sem simulação) já era de 0,68 s. O LCP simulado dependia de tudo o que estava no caminho até à
primeira pintura. As alterações foram:

- O snapshot da janela começa num script inline no `<head>`, em paralelo com o JavaScript. Antes, só começava
  depois do JavaScript e de `/auth/me`.
- A janela inicial passou de 120 para 42 dias (64 KB gzip). A carga crónica de 28 dias pesa menos de 5 % para lá
  das 6 semanas, e o histórico completo chega 2 s depois.
- O histórico (cerca de 2,5 MB gzip) só começa 2 s depois da primeira pintura.
- Foram retirados os *preloads* de 4 ficheiros de fonte (Barlow Condensed e Geist Mono). Continuam a carregar
  quando são usados, com `font-display: swap`. CLS medido: 0,0008.
- Um treino mais antigo do que a janela mostra "A carregar…" até o histórico chegar, em vez de "Treino não
  encontrado". Verificado no browser.

## Limites conhecidos

- São medições locais, numa só máquina. Em produção, a base (Neon) e a API (Cloud Run) estão em máquinas
  separadas, e a rede real entre o Worker, a API e o Neon soma latência que aqui não existe. A confirmação com
  tráfego real é feita na vigilância da Fase G (passo 8): logs `aquastats.request`, `PUT /times`.
- O passo seguinte, se for preciso, é a sincronização incremental com cache no dispositivo (ADR 0003).
