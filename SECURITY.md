# Política de segurança

## Relatar uma vulnerabilidade

Usa o **relato privado de vulnerabilidades do GitHub**: separador *Security* → *Report a vulnerability*.
O relato fica visível só para quem mantém o projeto. Não abras uma *issue* pública nem publiques detalhes antes
de haver correção.

Enquanto o repositório for privado (ver `docs/adr/0001-licenca-e-autoria.md`), quem tem acesso pode abrir um
*security advisory* em rascunho no mesmo separador.

Indica, se possível: o que encontraste, como reproduzir, o impacto e a versão/commit.

## O que esperar

- Confirmação da receção em até 5 dias úteis.
- Avaliação e plano de correção, com prazo, depois da confirmação.
- Crédito no registo de alterações, se quiseres.

## Âmbito

`aquastats.net`, a API (`apps/api`), o site (`apps/web`) e o Worker de IA (`apps/ai-worker`). Testes que
afetem dados de outros utilizadores, a disponibilidade do serviço ou que usem engenharia social **não** estão
autorizados. Usa contas e dados teus.

## Versões suportadas

Só a versão em produção (ramo `main`).
