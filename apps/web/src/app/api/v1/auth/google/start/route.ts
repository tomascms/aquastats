import { NextRequest, NextResponse } from "next/server";

import { forwardCookies } from "@/lib/forward-cookies";

const apiOrigin = (process.env.API_URL || "").replace(/\/$/, "");
const edgeAuthToken = process.env.EDGE_AUTH_TOKEN || "";

export async function GET(request: NextRequest) {
  if (!apiOrigin) {
    return NextResponse.json({ detail: "API_URL não configurado no deploy." }, { status: 503 });
  }
  const target = `${apiOrigin}/api/v1/auth/google/start${request.nextUrl.search}`;
  const upstream = await fetch(target, {
    redirect: "manual",
    headers: {
      cookie: request.headers.get("cookie") || "",
      ...(edgeAuthToken ? { "x-edge-auth": edgeAuthToken } : {}),
    },
  });

  const location = upstream.headers.get("location");
  if (location && upstream.status >= 300 && upstream.status < 400) {
    const response = NextResponse.redirect(location, upstream.status);
    forwardCookies(upstream, response);
    return response;
  }

  return NextResponse.json({ detail: "Não foi possível iniciar login Google." }, { status: 502 });
}
