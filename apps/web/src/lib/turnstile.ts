const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Sign-in and sign-up: the endpoints a bot would hammer. */
export const TURNSTILE_PATHS = new Set(["auth/login", "auth/register"]);

/**
 * Checks a Turnstile token with Cloudflare. Fails closed: no token, a network error or a bad answer all
 * mean "not verified".
 */
export async function verifyTurnstile(secret: string, token: string | null, ip: string | null, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetcher(SITEVERIFY, { method: "POST", body });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
