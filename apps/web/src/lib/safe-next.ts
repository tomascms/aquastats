export function safeNext(path: string, fallback = "/"): string {
  const value = (path || "").trim();
  // Browsers drop tabs/newlines inside URLs, so "/\t/evil.com" would become "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
