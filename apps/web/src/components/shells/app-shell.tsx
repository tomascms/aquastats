"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { BrandLockup } from "@/components/ui/brand";
import { OfflinePill } from "@/components/ui/offline-pill";
import { actions } from "@/lib/store";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AppShell({
  nav,
  homeHref,
  context,
  narrow = false,
  children,
}: {
  nav: NavItem[];
  homeHref: string;
  context?: string;
  narrow?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await actions.logout();
    router.replace("/entrar");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-aqua text-white lg:flex">
        <div className="lane-rope" aria-hidden="true" />
        <div className="px-5 pb-6 pt-6">
          <Link href={homeHref} className="inline-block rounded-md">
            <BrandLockup onDark />
          </Link>
          {context ? <p className="mt-3 truncate text-sm text-white/70">{context}</p> : null}
        </div>

        <nav className="flex-1 space-y-0.5 px-3" aria-label="Navegação principal">
          {nav.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] transition-colors ${
                  active ? "bg-white/12 font-semibold text-white" : "text-white/72 hover:bg-white/8 hover:text-white"
                }`}
              >
                {active ? <span className="lane-rope-v absolute inset-y-2 left-0 rounded-full" aria-hidden="true" /> : null}
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3 border-t border-white/12 px-5 py-5">
          <OfflinePill />
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-10 rounded-lg border border-white/25 px-3 text-sm font-medium text-white/85 transition-colors hover:border-white/60 hover:text-white"
          >
            Terminar sessão
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-20 bg-panel lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
            <div className="min-w-0">
              <Link href={homeHref} className="inline-block">
                <BrandLockup compact />
              </Link>
              {context ? <p className="truncate text-xs text-mute">{context}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OfflinePill />
              <button
                type="button"
                onClick={() => void logout()}
                className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold text-mist"
              >
                Sair
              </button>
            </div>
          </div>
          <div className="lane-rope" aria-hidden="true" />
        </header>

        <main id="conteudo" className={`mx-auto w-full ${narrow ? "max-w-3xl" : "max-w-[1400px]"} flex-1 px-4 pb-28 pt-5 lg:px-10 lg:pb-12 lg:pt-10`}>
          {children}
        </main>

        <nav
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel lg:hidden"
          aria-label="Navegação principal"
        >
          <div className="mx-auto grid max-w-lg px-1 pt-1" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                    active ? "text-aqua" : "text-mute"
                  }`}
                >
                  {active ? <span className="lane-rope absolute inset-x-4 top-0 rounded-full" aria-hidden="true" /> : null}
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
