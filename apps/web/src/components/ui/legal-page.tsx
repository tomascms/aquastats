"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { SiteFooter } from "@/components/ui/site-footer";
import { useT } from "@/i18n/provider";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 lg:max-w-2xl">
      <header className="safe-top flex items-center justify-between gap-4 pt-8">
        <Link href="/">
          <BrandLockup />
        </Link>
        <LanguageSwitch />
      </header>
      <main className="mt-10 flex-1">
      <article className="space-y-4 text-sm leading-relaxed text-mist">
        <p className="text-sm text-mute">{t("Informação")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-mute">{t("Atualizado em {date}", { date: updated })}</p>
        {children}
      </article>
      </main>
      <SiteFooter />
    </div>
  );
}
