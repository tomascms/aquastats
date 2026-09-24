export function safeNext(path: string, fallback = "/"): string {
  const value = (path || "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
