import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE = ["/coach", "/swimmer", "/escolher"];
const PROBES = [
  "/.env",
  "/.git",
  "/.htaccess",
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/administrator",
  "/backup.sql",
  "/config.php",
];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-DNS-Prefetch-Control": "off",
};

// Auth: restrito o suficiente contra brute-force, mas refresh/me/logout não podem bloquear sessão activa.
const AUTH_LIMITS: Record<string, { limit: number; windowSec: number }> = {
  "/api/v1/auth/join/": { limit: 30, windowSec: 60 },
  "/api/v1/auth/register": { limit: 12, windowSec: 60 },
  "/api/v1/auth/login": { limit: 30, windowSec: 60 },
  "/api/v1/auth/resend-confirmation": { limit: 5, windowSec: 300 },
  "/api/v1/auth/forgot": { limit: 8, windowSec: 300 },
  "/api/v1/auth/refresh": { limit: 120, windowSec: 60 },
  "/api/v1/auth": { limit: 80, windowSec: 60 },
};

// Writes: matriz de tempos pode gerar muitos PUT/min (1 por dígito); limites altos para uso real de piscina.
const WRITE_LIMITS: Record<string, { limit: number; windowSec: number }> = {
  "/api/v1/times": { limit: 720, windowSec: 60 },
  "/api/v1/": { limit: 360, windowSec: 60 },
};

async function edgeRateLimit(request: NextRequest, limit: number, windowSec: number): Promise<boolean> {
  if (typeof caches === "undefined" || !("default" in caches)) return true;
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const path = request.nextUrl.pathname;
  const bucket = `${ip}:${path.split("/").slice(0, 5).join("/")}`;
  type EdgeCache = { match: (key: Request) => Promise<Response | undefined>; put: (key: Request, value: Response) => Promise<void> };
  const cache = caches.default as unknown as EdgeCache;
  const cacheKey = new Request(`https://rate-limit.aquastats.internal/${encodeURIComponent(bucket)}`, { method: "GET" });
  const now = Date.now();
  let count = 0;
  let reset = now + windowSec * 1000;
  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      const data = (await cached.json()) as { count: number; reset: number };
      if (data.reset > now) {
        count = data.count;
        reset = data.reset;
      }
    } catch {
      count = 0;
    }
  }
  count += 1;
  if (count > limit) return false;
  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ count, reset }), {
      headers: { "Cache-Control": `max-age=${windowSec}` },
    }),
  );
  return true;
}

function authLimitFor(path: string): { limit: number; windowSec: number } | null {
  if (!path.startsWith("/api/v1/auth")) return null;
  for (const [prefix, rule] of Object.entries(AUTH_LIMITS)) {
    if (prefix !== "/api/v1/auth" && path.startsWith(prefix)) return rule;
  }
  return AUTH_LIMITS["/api/v1/auth"];
}

function writeLimitFor(path: string, method: string): { limit: number; windowSec: number } | null {
  if (!path.startsWith("/api/v1/") || method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }
  if (path.startsWith("/api/v1/auth")) return null;
  for (const [prefix, rule] of Object.entries(WRITE_LIMITS)) {
    if (prefix !== "/api/v1/" && path.startsWith(prefix)) return rule;
  }
  return WRITE_LIMITS["/api/v1/"];
}

function withSecurityHeaders(response: NextResponse, path: string) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  if (PRIVATE.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const lower = path.toLowerCase();
  if (PROBES.some((item) => lower === item || lower.startsWith(`${item}/`) || lower.startsWith(`${item}.`))) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (lower.endsWith(".env") || lower.includes("/.git/") || lower.endsWith(".sql.gz")) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (path === "/") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/entrar", request.url), 307), path);
  }

  const authRule = authLimitFor(path);
  const writeRule = writeLimitFor(path, request.method);
  const rateRule = authRule ?? writeRule;
  if (rateRule) {
    const allowed = await edgeRateLimit(request, rateRule.limit, rateRule.windowSec);
    if (!allowed) {
      return withSecurityHeaders(
        NextResponse.json({ detail: "Demasiados pedidos. Espera um pouco." }, { status: 429 }),
        path,
      );
    }
  }

  if (PRIVATE.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    const hasSession = request.cookies.has("sa_refresh") || request.cookies.has("sa_access");
    if (!hasSession) {
      const login = new URL("/entrar", request.url);
      login.searchParams.set("next", path);
      return withSecurityHeaders(NextResponse.redirect(login), path);
    }
  }

  return withSecurityHeaders(NextResponse.next(), path);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
