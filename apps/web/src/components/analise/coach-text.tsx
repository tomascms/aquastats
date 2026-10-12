"use client";

import { useCallback } from "react";
import { INTL_LOCALE } from "@/i18n";
import { useLocale, useT } from "@/i18n/provider";
import type { Msg } from "@/lib/coach-analysis";

/** Turns a coach-analysis sentence into text, numbers in the reader's locale. */
export function useSay() {
  const t = useT();
  const locale = INTL_LOCALE[useLocale()];
  return useCallback(
    (msg: Msg) =>
      t(
        msg.key,
        msg.vars && Object.fromEntries(Object.entries(msg.vars).map(([k, v]) => [k, typeof v === "number" ? v.toLocaleString(locale, { maximumFractionDigits: 2 }) : v])),
      ),
    [t, locale],
  );
}

/** Pool clock: 30,5 → "0:30,5"; 75.2 → "1:15,2". */
export function swimClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(1).padStart(4, "0").replace(".", ",");
  return `${m}:${s}`;
}

/** Signed seconds: "+1,2 s" / "−0,4 s". */
export function signedS(diff: number): string {
  const shown = Math.abs(diff).toFixed(1);
  return `${shown === "0.0" ? "" : diff > 0 ? "+" : "−"}${shown.replace(".", ",")} s`;
}

export const VERDICT_CLASS = { alvo: "text-good", rapido: "text-amber-600 dark:text-amber-400", lento: "text-coral" } as const;
