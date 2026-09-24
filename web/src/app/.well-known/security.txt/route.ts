import { publicOrigin, securityEmail } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const origin = publicOrigin();
  const mail = securityEmail();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const contact = mail ? `mailto:${mail}` : `${origin}/seguranca`;
  const body = [
    `Contact: ${contact}`,
    "Preferred-Languages: pt, en",
    `Canonical: ${origin}/.well-known/security.txt`,
    `Policy: ${origin}/seguranca`,
    `Expires: ${expires.toISOString()}`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
