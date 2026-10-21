"use client";

import { useCallback } from "react";
import { INTL_LOCALE, type MessageVars } from "@/i18n";
import { useLocale, useT } from "@/i18n/provider";
import type { Msg } from "@/lib/coach-analysis";
import type { Verdict } from "@/lib/coach-verdict";

/** Turns a coach-analysis sentence into text: numbers in the reader's locale, nested sentences translated too. */
export function useSay() {
  const t = useT();
  const locale = INTL_LOCALE[useLocale()];
  return useCallback(
    (msg: Msg): string => {
      const render = (m: Msg): string => {
        const vars: MessageVars | undefined = m.vars
          ? Object.fromEntries(
              Object.entries(m.vars).map(([k, v]) => [k, typeof v === "number" ? v.toLocaleString(locale, { maximumFractionDigits: 2 }) : typeof v === "string" ? v : render(v)]),
            )
          : undefined;
        return t(m.key, vars);
      };
      return render(msg);
    },
    [t, locale],
  );
}

/** Training clock, tenths (hand-timed): 30.5 → "0:30,5"; 75.24 → "1:15,2". */
export function swimClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(1).padStart(4, "0").replace(".", ",");
  return `${m}:${s}`;
}

/** Race clock, hundredths (electronic): 66.42 → "1:06,42". */
export function raceClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(2).padStart(5, "0").replace(".", ",");
  return `${m}:${s}`;
}

/** Unsigned seconds for a difference whose direction is shown by an icon and colour: "1,2 s". */
export function diffS(diff: number, digits = 1): string {
  return `${Math.abs(diff).toFixed(digits).replace(".", ",")} s`;
}

/** Signed seconds where the sign is the message (e.g. "+0,6 s por rep"). */
export function signedS(diff: number): string {
  const shown = Math.abs(diff).toFixed(1);
  return `${shown === "0.0" ? "" : diff > 0 ? "+" : "−"}${shown.replace(".", ",")} s`;
}

/** Where one time fell against its target: icon, colour and a word — never colour alone (WCAG 1.4.1). */
export const POSITION = {
  faster: { icon: "▲", className: "text-faster", word: "mais rápido" },
  same: { icon: "✓", className: "text-good", word: "dentro do habitual" },
  slower: { icon: "▼", className: "text-slower", word: "mais lento" },
} as const;

/** A verdict chip in the three states of "tempos explicados": ▲ mais rápido do que costuma · ● dentro do habitual · ▼ mais lento
 *  do que costuma; ○ ainda não dá para dizer when there is too little history. The certainty is never said. */
export function VerdictTag({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "xs" }) {
  const t = useT();
  const text = size === "xs" ? "text-xs" : "text-sm";
  if (verdict.dir === "unclear")
    return (
      <span className={`inline-flex items-center gap-1 ${text} text-mute`}>
        <span aria-hidden>○</span>
        {t("ainda não dá para dizer")}
        {verdict.reason ? <span className="text-xs">({t(verdict.reason === "poucos-dados" ? "poucas vezes feita" : "os tempos variam muito")})</span> : null}
      </span>
    );
  if (verdict.dir === "same")
    return (
      <span className={`inline-flex items-center gap-1 ${text} font-semibold text-mist`}>
        <span aria-hidden>●</span>
        {t("dentro do habitual")}
      </span>
    );
  const pos = POSITION[verdict.dir];
  return (
    <span className={`inline-flex items-center gap-1 ${text} font-semibold ${pos.className}`}>
      <span aria-hidden>{pos.icon}</span>
      {t(verdict.dir === "faster" ? "mais rápido do que costuma" : "mais lento do que costuma")}
    </span>
  );
}

/** Legend for rep tables and strips. */
export function PositionLegend() {
  const t = useT();
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute">
      {(["faster", "same", "slower"] as const).map((key) => (
        <span key={key} className={POSITION[key].className}>
          <span aria-hidden>{POSITION[key].icon}</span> {t(POSITION[key].word)}
        </span>
      ))}
      <span>{t("face ao que costuma fazer")}</span>
    </p>
  );
}
