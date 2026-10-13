import { NextRequest, NextResponse } from "next/server";

import { forwardCookies } from "@/lib/forward-cookies";

const apiOrigin = (process.env.API_URL || "").replace(/\/$/, "");
const edgeAuthToken = process.env.EDGE_AUTH_TOKEN || "";

export async function GET(request: NextRequest) {
  if (!apiOrigin) {
    return NextResponse.json({ detail: "API_URL não configurado no deploy." }, { status: 503 });
  }
  const target = `${apiOrigin}/api/v1/auth/google/callback${request.nextUrl.search}`;
  const upstream = await fetch(target, {
    redirect: "manual",
    headers: {
      cookie: request.headers.get("cookie") || "",
      ...(edgeAuthToken ? { "x-edge-auth": edgeAuthToken } : {}),
    },
  });

  const location = upstream.headers.get("location");
  if (location && upstream.status >= 300 && upstream.status < 400) {
    const redirectUrl =
      location.startsWith("http://") || location.startsWith("https://")
        ? location
        : new URL(location, request.url).toString();
    const response = NextResponse.redirect(redirectUrl, upstream.status);
    forwardCookies(upstream, response);
    return response;
  }

  if (!upstream.ok) {
    let detail = "Google recusou o login. Tenta outra vez.";
    try {
      const body = (await upstream.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // ignore
    }
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(detail)}`, request.url));
  }

  return NextResponse.json({ detail: "Resposta Google inválida." }, { status: 502 });
}
