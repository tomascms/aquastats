"use client";

import { LOCALE_NAME, LOCALES } from "@/i18n";
import { useLocale, useSetLocale, useT } from "@/i18n/provider";

/**
 * Two-segment PT | EN control, styled like a timing-board toggle.
 * `tone="dark"` for the navy sidebar, `tone="light"` for white headers and the sign-in screen.
 */
export function LanguageSwitch({
  tone = "light",
  compact = false,
  className = "",
}: {
  tone?: "dark" | "light";
  /** Narrow segments for crowded mobile headers. */
  compact?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();
  const dark = tone === "dark";

  return (
    <div
      role="radiogroup"
      aria-label={t("Idioma")}
      className={`inline-flex shrink-0 items-center rounded-lg p-0.5 ${
        dark ? "bg-white/10 ring-1 ring-inset ring-white/15" : "bg-panel-2 ring-1 ring-inset ring-line"
      } ${className}`}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={code}
            title={LOCALE_NAME[code]}
            onClick={() => setLocale(code)}
            className={`${compact ? "min-h-8 min-w-8 px-1.5" : "min-h-8 min-w-10 px-2.5"} rounded-md font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${
              active
                ? dark
                  ? "bg-white text-aqua shadow-sm"
                  : "bg-aqua text-white shadow-sm"
                : dark
                  ? "text-white/65 hover:text-white"
                  : "text-mute hover:text-mist"
            } ${dark ? "focus-visible:outline-white" : "focus-visible:outline-pool"}`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
