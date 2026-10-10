# Aquastats — resumo para CV

- Construí e opero uma plataforma de gestão de equipas de natação (Next.js 16 em Cloudflare Workers, FastAPI em
  Cloud Run, PostgreSQL/Neon), feita para o telemóvel à beira da piscina, em PT e EN.
- Desenhei o isolamento entre equipas na base de dados (RLS por equipa e por papel, duas roles de menor
  privilégio) e verifiquei-o com 49 testes contra Postgres real (matriz por tabela e papel).
- Tornei a cronometragem segura em concorrência (upsert ordenado pela hora da edição): de 5 falhas em 8 gravações
  simultâneas para 0, medido.
- Num telemóvel simulado (Lighthouse, 4G) e com uma equipa sintética: tirei o modelo do main thread (bloqueio do
  ecrã de cronometragem de 10,3 s para 0,6 s) e depois encurtei o caminho até ao conteúdo principal (LCP de 5,6 s
  para 3,8 s). Com 20 treinadores e leituras pesadas, baixei o p95 das gravações de tempos de 375 ms para
  121 ms (local, `scripts/load_test.py`).
- Modelo de previsão de tempos de treino com intervalos e ledger imutável de previsões: validado em dados
  sintéticos (backtest cronológico pré-registado), em validação em modo sombra.
- CI com testes, Postgres, auditorias de dependências e deteção de segredos; correção de uma RCE crítica do
  Next.js (GHSA-vcvr-r3jv-pc5j).

## Limites conhecidos

O modelo só foi validado em dados sintéticos (a produção ainda tem poucos dados reais). Medições de desempenho
locais, com uma equipa sintética; os números de produção chegam depois do deploy. Auditoria de segurança própria,
sem pentest independente.
