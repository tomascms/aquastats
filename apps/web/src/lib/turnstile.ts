const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Sign-in and sign-up: the endpoints a bot would hammer. */
export const TURNSTILE_PATHS = new Set(["auth/login", "auth/register"]);

/**
 * Checks a Turnstile token with Cloudflare. Fails closed: no token, a network error or a bad answer all
 * mean "not verified".
 */
export async function verifyTurnstile(
  secret: string,
  token: string | null,
  ip: string | null,
  fetcher: typeof fetch = fetch,
  hostnames: string[] = [],
): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetcher(SITEVERIFY, { method: "POST", body });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean; hostname?: string; metadata?: { result_with_testing_key?: boolean } };
    if (data.success !== true) return false;
    // A token solved on another site that shares the sitekey doesn't count. Cloudflare's test keys answer "example.com".
    if (hostnames.length && !data.metadata?.result_with_testing_key && !hostnames.includes(data.hostname || "")) return false;
    return true;
  } catch {
    return false;
  }
}
