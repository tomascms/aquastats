/**
 * Aquastats' own document reader, on Workers AI in our Cloudflare account.
 *
 * POST / with header `x-aquastats-key` and JSON { pdf: base64, system: string, schema: JSONSchema }.
 * The PDF is converted to Markdown (tables kept), then an open model fills the schema.
 * Returns { markdown, data } — the API checks every value against the Markdown.
 */

interface Env {
  AI: Ai;
  AI_KEY: string;
}

const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/openai/gpt-oss-120b"] as const;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_MARKDOWN = 60_000;

function same(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parse(output: unknown): Record<string, unknown> | null {
  // Workers AI models answer either { response } or the OpenAI shape { choices: [{ message: { content } }] }.
  const openai = (output as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  const raw = openai ?? (output as { response?: unknown })?.response ?? output;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return match ? (JSON.parse(match[0]) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    if (!same((request.headers.get("x-aquastats-key") ?? "").trim(), (env.AI_KEY ?? "").trim())) return new Response("Forbidden", { status: 403 });

    let body: { pdf?: string; text?: string; system?: string; schema?: unknown; models?: string[] };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }
    if (!body.pdf || !body.system || !body.schema) return Response.json({ error: "missing fields" }, { status: 400 });
    const bytes = Uint8Array.from(atob(body.pdf), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_PDF_BYTES) return Response.json({ error: "too large" }, { status: 413 });

    const converted = await env.AI.toMarkdown([{ name: "regulamento.pdf", blob: new Blob([bytes], { type: "application/pdf" }) }]);
    const first = Array.isArray(converted) ? converted[0] : converted;
    const markdown = first && "data" in first && typeof first.data === "string" ? first.data.slice(0, MAX_MARKDOWN) : "";
    // The Markdown keeps tables but can miss whole pages; the caller's plain extraction has every word.
    const plain = (body.text ?? "").slice(0, MAX_MARKDOWN);
    if (!markdown.trim() && !plain.trim()) return Response.json({ error: "no text" }, { status: 422 });

    const models = body.models?.length ? body.models.filter((m) => m.startsWith("@cf/")).slice(0, 3) : [...MODELS];
    for (const model of models) {
      try {
        const output = await env.AI.run(model, {
          messages: [
            { role: "system", content: body.system },
            {
              role: "user",
              content:
                "Fill EVERY field of this JSON schema that the regulation states (null only when it truly does not say):\n" +
                JSON.stringify((body.schema as { schema?: unknown }).schema ?? body.schema) +
                `\n\nRegulation, reading 1 (PDF to Markdown, keeps tables, may miss pages):\n\n${markdown}` +
                `\n\nRegulation, reading 2 (plain text of every page, tables flattened):\n\n${plain}\n\nAnswer with the JSON object only.`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 2000,
        } as never);
        const data = parse(output);
        if (data) return Response.json({ model, markdown, data });
      } catch (error) {
        console.warn(`${model} failed`, String(error).slice(0, 200));
      }
    }
    return Response.json({ error: "models failed", markdown }, { status: 502 });
  },
} satisfies ExportedHandler<Env>;
