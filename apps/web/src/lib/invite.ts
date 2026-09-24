export const INVITE_COOKIE = "sa_invite";

export function normalizeInvite(value: string | null | undefined): string {
  return (value || "").trim().toUpperCase();
}

export function readInviteCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )sa_invite=([^;]*)/);
  return normalizeInvite(match ? decodeURIComponent(match[1]) : "");
}

export function writeInviteCookie(code: string) {
  const token = normalizeInvite(code);
  if (!token || typeof document === "undefined") return;
  document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=3600; SameSite=Lax`;
}

export function clearInviteCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${INVITE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
