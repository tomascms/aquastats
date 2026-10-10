# Acessibilidade — axe-core e o que fica para teste manual

## Automático (10/10/2026)

O axe-core 4.13 correu com as regras WCAG 2.0/2.1/2.2 A e AA e as *best-practice*. Foi aplicado a 30 páginas, em
390 px e em 1280 px, no Worker local, com as contas sintéticas: páginas públicas, treinador e atleta (matriz,
construtor de treinos, competições, resultados, época, provas, equipa, definições).

| | Antes | Depois |
|---|---:|---:|
| Regras violadas | 10 | 1 |
| Nós | 166 | 1 |

Corrigido:

- Nomes acessíveis nos campos e seletores do construtor de treinos e nos campos de resultados de prova (críticos).
- Contraste dos tokens `good` (#117a59, 4,66:1 no fundo suave) e `coral` (#c03528, 4,82:1).
- Um `<main>` por página.
- `<h1>` na matriz e na edição de resultados, e a ordem dos títulos corrigida.
- Zonas com scroll focáveis por teclado.
- Barra lateral com nome próprio.
- Texto para leitores de ecrã nos cabeçalhos de tabela vazios.

Restante: um chip de dia em `/coach`, a 390 px (texto #56697f sobre #0b2545). O mesmo chip passa a 1280 px. O
contraste baixo só existe durante a transição de cor (150 ms) quando o dia selecionado muda: em repouso, um chip
não selecionado tem fundo claro.

## Só um teste manual com leitor de ecrã pode validar

O axe verifica a estrutura, não a experiência. Estes pontos precisam de NVDA ou JAWS no Windows, de VoiceOver no
iOS e de TalkBack no Android:

1. **Matriz de cronometragem:** se a ordem de leitura e o anúncio da célula ativa fazem sentido (atleta,
   repetição, tempo). Também o teclado numérico próprio com o leitor ativo, os gestos do VoiceOver e do TalkBack
   em vez de toques diretos, e se "guardado" e "pendente offline" são anunciados (`aria-live`).
2. **Mensagens que aparecem sozinhas:** se os toasts, os erros de gravação, a sincronização offline e o "A
   carregar…" são lidos no momento certo, sem interromper nem repetir.
3. **Gráficos:** se as tabelas alternativas chegam e se o leitor não lê o SVG ponto a ponto.
4. **Diálogos e menus:** foco preso dentro do diálogo, regresso do foco ao fechar, e Escape.
5. **Construtor de treinos:** se os nomes dados aos campos ("Séries", "Repetições", "Distância", "Intensidade",
   "Saída") chegam para perceber a que bloco pertence cada campo quando há vários blocos.
6. **Zoom a 200 % e texto grande do sistema:** sem cortes nem scroll horizontal fora das tabelas.
7. **Nomes de atletas truncados** na matriz: se o leitor lê o nome completo.
8. **Mudança de idioma PT/EN:** se o `lang` da página muda e a pronúncia acompanha.
