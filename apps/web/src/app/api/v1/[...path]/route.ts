import { NextRequest, NextResponse } from "next/server";

import { forwardCookies } from "@/lib/forward-cookies";

const apiOrigin = (process.env.API_URL || "").replace(/\/$/, "");
const edgeAuthToken = process.env.EDGE_AUTH_TOKEN || "";

const REQUEST_HEADERS = [
  "accept",
  "content-type",
  "cookie",
  "idempotency-key",
  "origin",
  "referer",
  "x-request-id",
  "access-control-request-method",
  "access-control-request-headers",
] as const;

const RESPONSE_HEADERS = [
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "content-type",
  "location",
  "retry-after",
  "vary",
  "x-request-id",
] as const;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!apiOrigin) {
    return NextResponse.json({ detail: "API_URL não configurado no deploy." }, { status: 503 });
  }

  const { path } = await context.params;
  const target = `${apiOrigin}/api/v1/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("origin")) {
    const origin = process.env.APP_URL || request.nextUrl.origin;
    if (origin) headers.set("origin", origin);
  }
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS" && !headers.has("idempotency-key")) {
    headers.set("idempotency-key", crypto.randomUUID());
  }
  if (edgeAuthToken) headers.set("x-edge-auth", edgeAuthToken);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ detail: "API indisponível." }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  forwardCookies(upstream, response);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
