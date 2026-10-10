# Deteção de tempos suspeitos (sementes de teste)

| Cenário | Reps | Erros materiais | Assinalados | Precisão | Recall | Falsos alarmes / 1000 reps limpas | Sugestão certa |
|---|---|---|---|---|---|---|---|
| arranque | 7565 | 45 | 45 | 100% | 100% | 0.00 | 93% |
| esparso | 7614 | 52 | 42 | 98% | 79% | 0.13 | 90% |
| tipico | 54105 | 264 | 225 | 92% | 78% | 0.33 | 93% |
| denso | 105308 | 426 | 396 | 92% | 86% | 0.29 | 94% |
| multiano | 79125 | 424 | 358 | 94% | 79% | 0.28 | 91% |

Por tipo de erro (todas as células):

| Erro | Materiais | Recall | Sugestão certa |
|---|---|---|---|
| digits | 223 | 96% | 94% |
| minute | 441 | 100% | 93% |
| swap | 508 | 59% | 96% |
| split | 39 | 97% | 39% |
