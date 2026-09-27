import { en } from "./en";
import { pt } from "./pt";

/**
 * Portuguese is the source language: every UI string is written in PT and used as its own key,
 * so a missing English entry degrades to readable Portuguese instead of a raw key.
 * `en.ts` maps each PT string to its English translation.
 */

export type Locale = "pt" | "en";
export type MessageKey = keyof typeof en;
export type MessageVars = Record<string, string | number>;

export const LOCALES: readonly Locale[] = ["pt", "en"];
export const DEFAULT_LOCALE: Locale = "pt";
export const LOCALE_COOKIE = "aq_locale";

export const LOCALE_NAME: Record<Locale, string> = { pt: "Português", en: "English" };

/** BCP 47 tag for Intl formatting (dates, numbers). en-GB keeps day-first dates and 24h clocks. */
export const INTL_LOCALE: Record<Locale, string> = { pt: "pt-PT", en: "en-GB" };

export function isLocale(value: unknown): value is Locale {
  return value === "pt" || value === "en";
}

/*
 * Two key suffixes, both optional:
 *   "Texto|contexto" — same Portuguese word with different meanings (e.g. a nav label vs a badge).
 *                      Portuguese shows the part before "|".
 *   "…|one"          — singular form, picked automatically when vars.count === 1.
 */
const dictionaries: Record<Locale, Partial<Record<string, string>>> = { pt, en };

function interpolate(text: string, vars?: MessageVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

function withoutContext(key: string): string {
  const bar = key.indexOf("|");
  return bar < 0 ? key : key.slice(0, bar);
}

export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const dictionary = dictionaries[locale];
  const singular = vars && Number(vars.count) === 1 ? dictionary[`${key}|one`] : undefined;
  return interpolate(singular ?? dictionary[key] ?? withoutContext(key), vars);
}

/** Runtime messages with a variable part (API f-strings), matched by shape. */
const dynamicPatterns: Record<Locale, [RegExp, string][]> = {
  pt: [],
  en: [
    [/^Aguarda (\d+) min antes de reenviar\.$/, "Wait $1 min before resending."],
    [/^(.+) inválido\.$/, "Invalid $1."],
  ],
};

/** For text that only exists at runtime (e.g. API error details): translated when known, else shown as is. */
export function translateDynamic(locale: Locale, text: string, vars?: MessageVars): string {
  const known = dictionaries[locale][text];
  if (known) return interpolate(known, vars);
  for (const [pattern, replacement] of dynamicPatterns[locale]) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return interpolate(text, vars);
}

/*
 * Active locale for plain functions (labels, formatters) that run outside React.
 * The browser sets it from LocaleProvider before any child renders. Store data only loads in the
 * browser, so data-driven labels never render during SSR; static text in components uses useT(),
 * which reads React context and is therefore request-safe on the server.
 */
let activeLocale: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale) {
  activeLocale = locale;
}

export function getLocale(): Locale {
  return activeLocale;
}

export function intlLocale(locale: Locale = activeLocale): string {
  return INTL_LOCALE[locale];
}

/** Translate with the active locale — for lib code. Components should prefer useT(). */
export function tx(key: MessageKey, vars?: MessageVars): string {
  return translate(activeLocale, key, vars);
}

export function txDynamic(text: string, vars?: MessageVars): string {
  return translateDynamic(activeLocale, text, vars);
}

/** A label map that resolves to the active locale on every read, so `MAP[key]` call sites stay unchanged. */
export function localizedMap<K extends string>(source: Record<K, MessageKey>): Record<K, string> {
  return new Proxy(source, {
    get(target, prop) {
      if (typeof prop === "string" && prop in target) return tx(target[prop as K]);
      return Reflect.get(target, prop);
    },
  }) as unknown as Record<K, string>;
}

/** A list of labels that translates on every index read (so `.map`, `[i]` and spreading all localize). */
export function localizedList(keys: readonly MessageKey[]): readonly string[] {
  return new Proxy(keys as MessageKey[], {
    get(target, prop, receiver) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        const key = target[Number(prop)];
        return key === undefined ? undefined : tx(key);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as readonly string[];
}

/** Pick the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.split("-")[0], q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) {
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
