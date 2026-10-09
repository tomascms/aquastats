# Aquastats — resumo para CV

- Construí e opero uma plataforma de gestão de equipas de natação (Next.js 16 em Cloudflare Workers, FastAPI em
  Cloud Run, PostgreSQL/Neon), usada no telemóvel à beira da piscina, em PT e EN.
- Encontrei e corrigi a falha de isolamento entre equipas: a role da API contornava a RLS; desenhei duas roles de
  menor privilégio e provei o isolamento com 40+ testes contra Postgres real (matriz por tabela e papel).
- Tornei a cronometragem segura em concorrência (upsert ordenado pela hora da edição): de 5 falhas em 8 gravações
  simultâneas para 0, medido.
- Reduzi o carregamento da equipa de 4,97 s para 1,87 s (0,60 s na janela recente) e o bloqueio do ecrã de
  cronometragem de 10,3 s para 0,6 s num telemóvel simulado, com dados sintéticos de 94 mil tempos.
- Modelo de previsão de tempos com intervalos calibrados e ledger imutável de previsões, validado com backtest
  cronológico pré-registado em dados sintéticos e em sombra em produção.
- CI com testes, Postgres, auditorias de dependências e deteção de segredos; hotfix de uma RCE crítica do Next.js.

## Limites conhecidos

O modelo só foi validado em dados sintéticos (a produção ainda tem poucos dados reais). Medições de desempenho
locais, com uma equipa sintética; os números de produção chegam depois do deploy. Auditoria de segurança própria,
sem pentest independente.
