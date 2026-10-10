# Como correr o harness e o gerador

Tudo corre em `apps/web` com Node (sem base de dados, sem rede). Dados **sintéticos** apenas: IDs
`syn-`, nunca misturados com dados reais.

```bash
cd apps/web
npm install
npm test                       # testes unitários, de propriedades, de fuga e o "golden" do v1.0
```

## Gerador sintético (`src/lib/ml/synthetic.ts`, versão 3.0, congelada)

```ts
import { generateDataset } from "./src/lib/ml/synthetic";
const dataset = generateDataset("tipico", 3001);            // cenário, semente
const outro = generateDataset("esparso", 7, { data: "completos", meters: "alto", context: "bem-estar" });
```

- **Cenários**: `arranque` (6 semanas), `esparso` (12 semanas, pouca cronometragem), `tipico`
  (26 semanas), `denso` (40 semanas), `multiano` (4 épocas), `regresso-curta` / `-longa` /
  `-tardia` (regresso de agosto).
- **Variantes**: dados `completos` | `em-falta`; metros `baixo` | `base` | `alto`; contexto
  `nenhum` | `basico` | `carga` | `bem-estar` (só esta tem sono/ginásio/recuperação).
- **Verdade** por rep em `dataset.truth` (tempo esperado, melhor previsão possível na véspera,
  capacidade, precipício, erro de digitação) e provas em `dataset.races` (com o tempo esperado).
- Hipóteses do gerador e onde o modelo as pode estar a aproveitar: `experiments.md` §2.6.

## Backtest e comparações (`scripts/ml-backtest.ts`)

```bash
# Relatório de vários preditores (todas as métricas, por cenário)
npx tsx scripts/ml-backtest.ts --predictors "mediana,modelo atual,v1.0 + qualidade + conformal" --seeds dev --save nome

# Desafiante vs campeão, com as regras R1–R10 (e R7/R8, e C1–C5 nas sementes de confirmação)
npx tsx scripts/ml-backtest.ts --compare "campeão" "desafiante" --seeds tune|dev|fatigue|confirm \
  [--cells decision|regime|matrix|decision,regime|all] [--decide-on day|rep] [--primary mape|crps] [--save nome]
```

| `--seeds` | Sementes | Para quê |
|---|---|---|
| `tune` | 1–5 | Desenho e afinação |
| `test` | 1001–1015 | Antigas de teste (já vistas: só desenho) |
| `dev` | 3001–3015 | Decisão de cada experiência |
| `fatigue` | 2001–2015 | A tentativa única da fadiga |
| `confirm` | 4001–4015 | **Uma única vez** (já usada no v1.0) |

Os nomes dos preditores estão em `src/lib/ml/registry.ts`. Resultados gravados em `docs/ml/results/`.

## Outros scripts

| Script | O que faz |
|---|---|
| `ml-error-sources.ts` | Decompõe o erro do campeão em irredutível (oráculo) e redutível, por fonte |
| `ml-tune.ts` | Afinação nas sementes de ajuste (`--grid opção=a,b,c` ou `--search a,b --objective mape|loglik`) |
| `ml-races.ts` | Previsão de tempos de prova (E13) vs referência, cobertura |
| `ml-fatigue-recovery.ts` | Recuperação dos parâmetros de fadiga (W′, τ, volume) vs verdade |
| `ml-perf.ts` | Tempo e memória de um passe completo e do pipeline incremental |
| `ml-quality.ts` | Deteção de tempos suspeitos (precisão, recall) |
| `ml-active.ts` | Aprendizagem ativa: que série cronometrar |

## Dados reais (só leitura)

`--real ficheiro.json` corre os preditores sobre uma exportação (atletas, treinos, tempos) no
formato do site. Nunca escreve nada. Em 2026-10-05 a base de produção tinha 0 tempos.
