"use client";

import Link from "next/link";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";
import { contactEmail } from "@/lib/site";

const LINKS: { href: string; label: MessageKey }[] = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
  { href: "/seguranca", label: "Segurança" },
];

export function SiteFooter() {
  const t = useT();
  const contact = contactEmail();
  return (
    <footer className="mt-auto border-t border-line px-5 py-5">
      <nav aria-label={t("Informação legal")} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-mute">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center hover:text-mist">
            {t(item.label)}
          </Link>
        ))}
        {contact ? (
          <a href={`mailto:${contact}`} className="inline-flex min-h-11 items-center hover:text-mist">
            {t("Contacto")}
          </a>
        ) : null}
      </nav>
      <p className="mt-3 text-center text-[11px] text-mute">
        {t("Aquastats não cobra neste lançamento e nunca guarda números de cartão.")}
      </p>
    </footer>
  );
}
