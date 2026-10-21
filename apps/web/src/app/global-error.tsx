"use client";

import { useEffect } from "react";
import { reportError } from "@/components/error-reporter";
import { isLocale, LOCALE_COOKIE, translate, type Locale } from "@/i18n";

// Replaces the root layout, so there is no LocaleProvider here: read the saved choice directly.
function savedLocale(): Locale {
  if (typeof document === "undefined") return "pt";
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  return match && isLocale(match[1]) ? match[1] : "pt";
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, error.digest), [error]);
  const locale = savedLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-[#061018] px-5 py-16 text-[#d7ece8]">
        <p className="text-sm tracking-[0.22em] text-[#ff6b6b]">{t("Erro")}</p>
        <h1 className="mt-3 font-sans text-3xl font-bold">{t("A app não conseguiu carregar")}</h1>
        <p className="mt-3 max-w-md text-sm text-[#7f9aa6]">{t("Tenta recarregar. Os teus dados não são mostrados neste ecrã.")}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 h-12 rounded-2xl bg-[#3dffe8] px-6 text-sm font-bold text-[#061018]"
        >
          {t("Recarregar")}
        </button>
      </body>
    </html>
  );
}
