"use client";

import { useEffect } from "react";

// Sends JavaScript errors to the API logs in Cloud Logging (POST /api/v1/client-errors).
// Only the page path, the message and a short stack: never who is signed in. The API masks the rest.
const MAX_PER_PAGE_LOAD = 5;
const seen = new Set<string>();

export function reportError(error: unknown, digest?: string) {
  if (typeof window === "undefined" || seen.size >= MAX_PER_PAGE_LOAD) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const message = `${err.message}${digest ? ` (digest ${digest})` : ""}`.slice(0, 500);
  if (seen.has(message)) return;
  seen.add(message);
  void fetch("/api/v1/client-errors", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route: window.location.pathname, message, stack: (err.stack ?? "").slice(0, 4000) }),
  }).catch(() => {});
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
