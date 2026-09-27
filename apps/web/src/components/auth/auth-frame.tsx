"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageSwitch } from "@/components/ui/language-switch";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";

const LINKS: { href: string; label: MessageKey }[] = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
];

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="grid min-h-dvh bg-ink lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden flex-col bg-aqua text-white lg:flex">
        <div className="lane-rope" aria-hidden="true" />
        <div className="flex flex-1 flex-col justify-between px-12 py-12">
          <Image
            src="/aquastats-logo.png"
            alt="Aquastats"
            width={900}
            height={880}
            className="h-40 w-auto self-start brightness-0 invert"
            priority
          />
          <div>
            <p className="font-display text-7xl font-bold leading-[0.9]">know your swim</p>
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-white/75">
              {t("Tempos de treino e de prova no mesmo sítio, para decidir a próxima série com dados.")}
            </p>
          </div>
          <p className="text-sm text-white/55">{t("Para treinadores e nadadores de competição.")}</p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="safe-top relative bg-aqua lg:hidden">
          <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))]">
            <LanguageSwitch tone="dark" />
          </div>
          <div className="flex flex-col items-center px-6 pb-6 pt-4">
            <Image
              src="/aquastats-logo.png"
              alt="Aquastats"
              width={280}
              height={274}
              className="h-24 w-auto brightness-0 invert"
              priority
            />
            <p className="mt-1 font-display text-2xl font-bold text-white">know your swim</p>
          </div>
          <div className="lane-rope" aria-hidden="true" />
        </header>
        <div className="hidden justify-end px-8 pt-6 lg:flex">
          <LanguageSwitch />
        </div>
        <main id="conteudo" className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px] rounded-2xl border border-line bg-panel p-7 shadow-[var(--shadow-raise)] sm:p-9">
            {children}
          </div>
        </main>
        <footer className="safe-bottom px-6 pb-6">
          <nav aria-label={t("Informação legal")} className="flex justify-center gap-5 text-sm text-mute">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-mist">
                {t(item.label)}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}
