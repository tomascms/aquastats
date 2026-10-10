# Dependabot — triagem (09/10/2026)

## Substituídos pelo PR #14 (hotfix de segurança)

Ficam cobertos pelo #14, com versões iguais ou mais recentes e o CI verde. Fecham depois do merge do #14 em
`main`.

| PR | Pacote | Versão no #14 |
|---|---|---|
| #1 | pytest 9.1.1 | 9.1.1 |
| #7 / #8 | react-dom / react 19.3.0 | 19.3.0 |
| #10 | wrangler 4.136.1 | 4.149.0 (corrige o CVE-2026-96889 do `sharp`, via miniflare) |
| #11 | cryptography 50.0.1 | 50.0.2 |
| #12 | fastapi 0.141.1 | 0.142.2 |
| #13 | pytest-cov 7.1.0 | 7.1.0 |

## Majors deixados abertos, de propósito

Nenhum dos três corrige uma vulnerabilidade conhecida (`npm audit` e `pip-audit` limpos sem eles). Cada um muda
comportamento e precisa do seu próprio PR e de testes. Não entram nesta release.

| PR | Pacote | Razão para esperar |
|---|---|---|
| #3 | eslint 9 → 10 | Major com regras e configuração novas, e o CI do próprio PR falha (09/10/2026). Exige migrar a configuração num PR dedicado, com o lint verde. |
| #9 | @types/node 20 → 26 | Os tipos devem seguir o Node de execução. O CI e o build usam o Node 24, e os tipos ficam em `^24`. O 26 descreveria APIs que o runtime não tem. |
| #2 | redis (Python) 5 → 8 | A API só usa Redis se `REDIS_URL` estiver definido; sem ele, o rate limit fica em memória (o arranque regista `redis=False`). Um major numa dependência opcional não traz ganho nesta release e arrisca mudanças de API. Rever quando o Redis for ativado. |
