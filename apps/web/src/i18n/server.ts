import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, negotiateLocale, translate, type Locale, type MessageKey, type MessageVars } from ".";

/** Locale for this request: explicit choice (cookie) first, then the browser's Accept-Language. */
export async function getServerLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiateLocale((await headers()).get("accept-language"));
}

export async function getServerT() {
  const locale = await getServerLocale();
  return (key: MessageKey, vars?: MessageVars) => translate(locale, key, vars);
}
