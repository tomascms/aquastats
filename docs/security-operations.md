# Segurança e regras de operação — Aquastats

Este documento estabelece a regra de ouro para tudo o que for feito a partir deste ponto:

1. Nenhum segredo em Git, em URLs, em query strings, em logs, em páginas públicas ou em ficheiros do repositório.
2. Qualquer token, password, secret, chave OAuth ou credential só vive em ambiente de hosting/secret manager e nunca em código-fonte.
3. A API só aceita pedidos vindos da origin autorizada e com o header secreto entre Worker e API quando a aplicação estiver em produção.
4. Nenhuma operação que altere acesso, senha, permissões, roles, cookies, conectividade ou dados sensíveis pode ser feita sem revisão do impacto de segurança.
5. Se uma variável de ambiente for necessária, ela deve ser injetada pelo hosting, não embebida em ficheiros locais ou em commits.
6. Qualquer nova feature deve respeitar: validação, isolamento por equipa, RLS, rate limiting, cookies seguros, headers de segurança e registos mínimos.

## Regra de origem

- O Worker e a API partilham um `EDGE_AUTH_TOKEN` secreto.
- A API valida `X-Edge-Auth` e rejeita chamadas diretas sem esse token.
- Em produção, `APP_URL` deve ser HTTPS e a origem do browser deve estar na allowlist do backend.
- Nenhuma URL pública deve conter tokens, codes de sessão ou secrets.

## Regra de exposição

- Não publicar links de admin, endpoints internos, dashboards, backups, credenciais, storage, logs ou consoles em páginas públicas.
- Não abrir diretamente portas da API para o mundo; manter o acesso via Cloudflare/Worker ou via endpoint restrito.
- Se um ficheiro local tiver variáveis sensíveis, nunca se deve fazer commit ou partilhar.
- Se um link “não acessível” for descoberto por alguém, não pode ser usado para causar maldade porque o backend deve rejeitar qualquer acesso sem autenticação e sem header correto.

## Regra para tudo o que vier depois

Antes de qualquer alteração, verificar:

- há token secreto em ambiente seguro;
- não há valor sensível em código;
- a origem é validada;
- a operação não expõe por URL ou no front-end;
- o endpoint novo segue as regras de RLS/role e autenticação;
- o deploy foi validado com smoke test do comportamento real.

## Checklist do deploy

- Secret manager ou variáveis do provedor de hosting apenas.
- `APP_URL` HTTPS em produção.
- `DATABASE_URL` em role limitada do Neon com RLS ativo quando aplicável.
- `EDGE_AUTH_TOKEN` igual no Worker e na API.
- Cookies HttpOnly, Secure, SameSite.
- Headers de segurança ativos.
- 401/403 em acesso não autorizado.
- Smoke test em produção concluído.

## Garantia prática

Mesmo que alguém descubra um URL não visível ou um endpoint não público, a aplicação não pode ser usada para “maldades” por causa disso, porque:

- a API só aceita chamadas com origem autorizada e, quando configurado, com header secreto;
- os dados ficam protegidos por autenticação e by design de RLS/isolamento da base de dados;
- as portas e origens críticas não são expostas publicamente em páginas, robots, sitemaps ou anúncios;
- os dados sensíveis permanecem fora do repositório e fora do front-end.

Se o alvo for a produção, qualquer acesso direto fora do fluxo permitido deve ser bloqueado por 403, 401 ou 404, não convertido em funcionalidade pública.
