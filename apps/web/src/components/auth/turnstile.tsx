"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile (usually invisible to people). Renders nothing without a site key. A new `round`
 * renders a fresh widget: each token works once.
 */
export function Turnstile({ siteKey, round, onToken }: { siteKey: string; round: number; onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let widget = "";
    let cancelled = false;
    const mount = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget = window.turnstile.render(box.current, {
        sitekey: siteKey,
        size: "flexible",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    if (window.turnstile) mount();
    else {
      // Inserted by our own (nonce-trusted) code, so the strict CSP lets it run.
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount, { once: true });
    }
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, round, onToken]);

  return siteKey ? <div ref={box} className="min-h-[65px]" /> : null;
}
