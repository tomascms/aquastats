# Worker de IA

Cloudflare Worker que lê documentos de competição (regulamentos e listas em PDF) com Workers AI.
`POST /` com o cabeçalho `x-aquastats-key` e `{ pdf, system, schema }`: converte o PDF em Markdown e um
modelo aberto preenche o esquema. Devolve `{ markdown, data }`; a API valida cada valor contra o Markdown.

```bash
npx wrangler deploy      # a partir desta pasta; o segredo AI_KEY vai por `wrangler secret put AI_KEY`
```
