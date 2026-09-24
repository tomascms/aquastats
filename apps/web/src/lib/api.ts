export type ApiError = { status: number; detail: string; requestId?: string };

let refreshPromise: Promise<boolean> | null = null;

function idempotencyKey(seed?: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    if (!seed || seed.length > 120) return crypto.randomUUID();
    return seed;
  }
  if (seed && seed.length <= 120) return seed;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function parseError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get("x-request-id") ?? undefined;
  try {
    const body = (await res.json()) as { detail?: string; requestId?: string };
    const detail = body.detail || res.statusText;
    return { status: res.status, detail, requestId: body.requestId ?? requestId };
  } catch {
    return { status: res.status, detail: res.statusText, requestId };
  }
}

export function formatApiError(error: ApiError): string {
  if (error.requestId) return `${error.detail} (ref. ${error.requestId.slice(0, 12)})`;
  return error.detail;
}

export function isRetryableError(error: ApiError): boolean {
  return error.status === 429 || error.status >= 500 || error.status === 0;
}

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function api<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("X-Request-Id", crypto.randomUUID?.() ?? `${Date.now()}`);
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !path.startsWith("/api/v1/auth/")) {
    headers.set("Idempotency-Key", init.idempotencyKey || headers.get("Idempotency-Key") || idempotencyKey());
  }

  const send = () =>
    fetch(path, {
      ...init,
      headers,
      credentials: "include",
    });

  let res: Response;
  try {
    res = await send();
  } catch {
    throw { status: 0, detail: "Sem ligação à internet." } satisfies ApiError;
  }

  if (res.status === 401 && !path.startsWith("/api/v1/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) {
      try {
        res = await send();
      } catch {
        throw { status: 0, detail: "Sem ligação à internet." } satisfies ApiError;
      }
    }
  }
  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
