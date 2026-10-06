# Segurança do Aquastats

> **Auditoria própria, não substitui um pentest.** Estes documentos descrevem o que foi revisto e testado
> pelo próprio projeto (código, configuração, testes automáticos). Não houve teste de intrusão independente.
> Documentos internos: o repositório é privado (ADR 0001); rever antes de qualquer publicação.

| Documento | Conteúdo |
|-----------|----------|
| [modelo-de-ameacas.md](modelo-de-ameacas.md) | Ativos, atores, entradas, ameaças priorizadas e o que as trava |
| [rls.md](rls.md) | Roles da base, matriz de isolamento por tabela e papel, exceções, como é testado |
| [controlos.md](controlos.md) | Controlos em vigor (autenticação, sessões, cabeçalhos, limites, segredos, dependências) e limites conhecidos |
| [`../release/fase-a-diagnostico.md`](../release/fase-a-diagnostico.md) | Linha de base medida (06/10/2026) |
| [`../release/fase-g-plano.md`](../release/fase-g-plano.md) | O que ainda falta aplicar em produção |

Estado em 06/10/2026: as correções estão nas branches `release/hardening` e `hotfix/security-deps` (PR #14).
**Em produção ainda nada mudou** — a role com BYPASSRLS continua ativa até ao passo 5 da Fase G.

Relatar uma vulnerabilidade: ver [`SECURITY.md`](../../SECURITY.md).
