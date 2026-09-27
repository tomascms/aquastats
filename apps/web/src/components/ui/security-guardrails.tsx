"use client";

import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";

const ITEMS: { title: MessageKey; body: MessageKey }[] = [
  {
    title: "Exposição",
    body: "Nenhum segredo está em URL, em query string, em página pública nem em ficheiros do repositório.",
  },
  {
    title: "Origem",
    body: "O Worker e a API partilham um token secreto e a API recusa chamadas diretas sem esse header.",
  },
  {
    title: "Acesso",
    body: "Endpoints não públicos devolvem 401, 403 ou 404; nada sensível aparece em links públicos nem em páginas de erro.",
  },
  {
    title: "Regra",
    body: "Qualquer alteração futura tem de seguir esta base: segredo só em hosting, app origin validada e sem tokens em URLs.",
  },
];

export function SecurityGuardrails() {
  const t = useT();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ITEMS.map((item) => (
        <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold tracking-[0.12em] text-aqua">{t(item.title)}</p>
          <p className="mt-2 text-sm text-mist">{t(item.body)}</p>
        </div>
      ))}
    </div>
  );
}
