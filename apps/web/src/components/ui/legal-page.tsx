import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand";
import { SiteFooter } from "@/components/ui/site-footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 lg:max-w-2xl">
      <header className="safe-top pt-8">
        <Link href="/" aria-label="Ir para a página inicial">
          <BrandLockup />
        </Link>
      </header>
      <article className="mt-10 flex-1 space-y-4 text-sm leading-relaxed text-mist">
        <p className="text-sm text-mute">Informação</p>
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-mute">Atualizado em {updated}</p>
        {children}
      </article>
      <SiteFooter />
    </div>
  );
}
