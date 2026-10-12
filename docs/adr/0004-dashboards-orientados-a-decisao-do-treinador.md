# ADR 0004 — Dashboards orientados à decisão do treinador

- Estado: aceite
- Data: 12/10/2026

## Contexto

Críticas de um treinador: os tempos sintéticos não eram realistas; faltavam tempos em muitos treinos; os
ecrãs mostravam sobretudo que o modelo era bom (MAPE, cobertura) em vez de ajudar a perceber o treino, o
atleta e o que treinar a seguir.

## Decisão

1. **O produto mostra natação, não o modelo.** Cada ecrã responde a uma pergunta do treinador escrita no
   título ([`../natacao/produto-treinador.md`](../natacao/produto-treinador.md)). A fiabilidade do modelo fica atrás de "Como se calculou"
   (`treino-dashboard.tsx`); o único número do modelo à vista é o intervalo de uma previsão.
2. **Indicadores só de tempos registados** (`lib/indicators.ts`): CSS, zonas por atleta, aderência de intensidade,
   queda de ritmo, pontos World Aquatics, nível, distribuição por zona vs fase. Fórmulas e fontes em
   [`../natacao/indicadores.md`](../natacao/indicadores.md).
3. **Sinais de treino substituem a regra "sem prescrições"**, com limites: cada sinal mostra dado, razão,
   incerteza e alternativa; o treinador decide; sem probabilidades, sem risco de lesão (ACWR só descritivo),
   sem conselho médico; só regras que a evidência suporta ([`../natacao/referencias.md`](../natacao/referencias.md) §5).
4. **Zonas ancoradas na CSS 200/400** sem correção; os desvios por zona são estimativas documentadas.
5. **Distribuição por fase é "referência indicativa"**: não há fonte verificada para os intervalos, por isso
   fora do intervalo nunca aparece como erro.
6. **Gerador 4.0** representa a natação real (6 níveis, referências citadas) e é congelado antes de medir o
   modelo; o modelo é que tem de o acompanhar ([`../natacao/gerador.md`](../natacao/gerador.md)).

## Alternativas

- **Recomendações automáticas de treino** ("faz 6×200 A3"): rejeitadas; a evidência não suporta prescrição
  individual a partir destes dados e o treinador perderia a decisão.
- **Manter as métricas do modelo à vista**: rejeitado; não respondem a nenhuma pergunta do treinador.
- **ACWR com zona "segura" 0,8–1,3**: rejeitado (Impellizzeri 2020; Lolli 2019).

## Consequências

- O "Hoje" junta `whoNeedsAttention` e "Que treino a evidência sugere hoje?" (sinais de quem treinou nos últimos
  14 dias, até 8 atletas). Calcula-se no browser só com as últimas 26 semanas (o
  máximo que a CSS e os sinais usam): 32 atletas, ~60 000 tempos em ~0,6 s num portátil; falta medir num telemóvel.
- Zonas em % da velocidade CSS (não desvios em segundos): a referência dá as duas formas e só a % é coerente em
  CSS rápidas e lentas. Ritmos de 25 m convertidos para 50 m (× 1,03).
- A CSS só existe para atletas com 200 e 400 livres registados; sem eles o perfil diz-o e não inventa.
- RPE da sessão e testes CSS dedicados ainda não são recolhidos; ver produto-treinador.md "Recolha de dados".
