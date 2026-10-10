# ADR 0001 — Licença, visibilidade e autoria

- Estado: aceite
- Data: 06/10/2026
- Decisor: dono do projeto (decisão delegada ao agente e registada aqui)

## Contexto

O repositório não tinha licença. Sem licença, ninguém tem direito de uso, mas também não fica claro para
quem o lê. O dono quer o repositório privado até nova ordem e pediu uma decisão sobre licença e autoria.

## Decisão

1. **Licença proprietária: "Copyright (c) 2026 tomás castro mendes de sousa. Todos os direitos reservados."**
   Ficheiro `LICENSE` na raiz; `"license": "UNLICENSED"` no `package.json` do site.
2. **Repositório privado** até o dono decidir o contrário. Tornar público exige: Fase G concluída, scan de
   segredos limpo em todo o histórico e revisão dos documentos de segurança (ver "Consequências").
3. **Autoria:** o nome da conta GitHub (`tomás castro mendes de sousa`). Os commits futuros usam o email
   *noreply* do GitHub (`265628403+tomascms@users.noreply.github.com`) para o email pessoal não ficar no
   histórico. O histórico existente não é reescrito.

## Alternativas consideradas

- **MIT / Apache-2.0:** permitiriam reutilização por terceiros. Rejeitadas por agora: o projeto tem valor
  comercial potencial e dados de utilizadores reais; abrir o código pode ser decidido mais tarde sem custo.
- **Sem licença:** juridicamente equivalente a "todos os direitos reservados", mas ambíguo para quem lê.

## Consequências

- Contribuições externas não são aceites sem acordo escrito (ver `CONTRIBUTING.md`).
- Antes de qualquer mudança para público: `docs/security/` (modelo de ameaças, matriz RLS, relatórios de
  auditoria) e `docs/release/` contêm detalhes operacionais (ids de endpoints, configuração). Têm de ser
  revistos ou movidos para fora do repositório público nesse momento. Enquanto o repositório é privado,
  ficam aqui por serem úteis para operar o serviço.
- Os *badges* e o `SECURITY.md` (relato privado de vulnerabilidades do GitHub) só funcionam plenamente com o
  repositório público; o `SECURITY.md` explica o canal alternativo enquanto for privado.
