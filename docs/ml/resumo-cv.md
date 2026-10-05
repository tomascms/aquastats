# Resumo para CV (10 linhas)

1. Desenhei e implementei de raiz um modelo que prevê cada repetição de treino de natação e os tempos de prova, com incerteza calibrada (TypeScript, corre no browser).
2. Modelo de espaço de estados hierárquico: priors fisiológicos (velocidade crítica/Riegel, idade, sexo, estilo principal), partilha parcial com a equipa e filtro de Kalman robusto com forma multi-escala e défice de regresso após pausas.
3. Fadiga individual dentro da série (reserva anaeróbia W′ com "precipício", posterior bayesiana em grelha, com censura) e resultados de provas como observações do mesmo motor.
4. Intervalos por conformal adaptativo com caudas Student-t; deteção automática de erros de digitação antes de o modelo aprender.
5. Protocolo pré-registado: gerador sintético fisiológico (atletas heterogéneos, dados em falta, erros), sementes de ajuste/desenvolvimento/confirmação, bootstrap emparelhado, Bonferroni/Holm sobre 15 experiências, testes de fuga temporal e critério de paragem.
6. 12 experiências registadas, incluindo as falhadas (5 aceites, 7 rejeitadas ou abandonadas); na confirmação única, em sementes nunca vistas: −0,16 pp de erro (IC 95 % −0,21 a −0,11) face ao modelo anterior, cobertura a 80 % calibrada e nenhum subgrupo pior; face ao modelo em produção, −0,54 pp e 100 % das reps previstas (contra 24–77 %).
7. Ciclo de aprendizagem contínua: registo imutável de previsões (Postgres com RLS), reconciliação, atribuição de causas, alertas de deriva e calibração, campeão/desafiante em sombra com interruptor em tempo de execução.
8. Engenharia: estado incremental exato (checkpoint/resume testado bit a bit, 3,4× mais rápido em equipas grandes), degradação sem falhas, testes de propriedades (monotonia, invariância, sondas contrafactuais).
9. Honesto sobre os limites: validado só em dados sintéticos; a base de produção ainda não tem tempos, por isso o modelo corre em sombra até ganhar nos dados reais (≥ 200 reps em ≥ 6 semanas).
10. Stack: TypeScript / Next.js 16 em Cloudflare Workers, FastAPI + PostgreSQL (Neon) com RLS, node:test, pytest.
