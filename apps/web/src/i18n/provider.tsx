"use client";

import { useRouter } from "next/navigation";
import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  LOCALE_COOKIE,
  setActiveLocale,
  translate,
  translateDynamic,
  type Locale,
  type MessageKey,
  type MessageVars,
} from ".";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep lib-level formatters in step with React before any child renders (also during SSR,
  // so labels rendered on the server match what the browser hydrates).
  setActiveLocale(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${
        window.location.protocol === "https:" ? "; Secure" : ""
      }`;
      document.documentElement.lang = next;
      setActiveLocale(next);
      setLocaleState(next);
      // Server components (legal pages, metadata) render with the cookie on refresh.
      router.refresh();
    },
    [locale, router],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {/* Remount on switch so every label — including ones computed outside React — re-renders. */}
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

function useLocaleContext(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>.");
  return value;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useSetLocale(): (next: Locale) => void {
  return useLocaleContext().setLocale;
}

export function useT() {
  const { locale } = useLocaleContext();
  return useCallback((key: MessageKey, vars?: MessageVars) => translate(locale, key, vars), [locale]);
}

/** Translator for runtime text such as API error details. */
export function useTDynamic() {
  const { locale } = useLocaleContext();
  return useCallback((text: string, vars?: MessageVars) => translateDynamic(locale, text, vars), [locale]);
}
