"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLockup } from "@/components/ui/brand";
import { IconCalendar, IconFlag, IconGrid, IconPeople, IconSettings } from "@/components/ui/icons";
import { OfflinePill } from "@/components/ui/offline-pill";
import { actions, useAppState } from "@/lib/store";

const NAV = [
  { href: "/coach", label: "Calendário", icon: IconCalendar, exact: true },
  { href: "/coach/team", label: "Equipa", icon: IconPeople },
  { href: "/coach/competicoes", label: "Competição", icon: IconFlag },
  { href: "/coach/provas", label: "Análise", icon: IconGrid },
  { href: "/coach/definicoes", label: "Definições", icon: IconSettings },
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/coach/provas") return pathname.startsWith("/coach/provas");
  return pathname.startsWith(item.href);
}

export function CoachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { teamName } = useAppState();
  const hideChrome = pathname.includes("/matrix");

  async function logout() {
    await actions.logout();
    router.replace("/entrar");
  }

  if (hideChrome) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top,_rgba(108,141,191,0.18),transparent_40%),linear-gradient(180deg,#f4f8ff_0%,#edf3fb_100%)] lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-white/80 px-3 py-4 backdrop-blur-xl lg:flex">
        <Link href="/">
          <BrandLockup compact />
        </Link>
        <p className="mt-2 px-1 text-xs text-mute">{teamName}</p>
        <nav className="mt-6 space-y-1" aria-label="Navegação principal">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-aqua text-ink shadow-sm" : "text-mute hover:bg-ink-2 hover:text-mist"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
          <OfflinePill />
          <button
            type="button"
            onClick={() => void logout()}
            className="btn-ghost h-10 w-full"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex items-center justify-between gap-3 border-b border-line bg-panel px-4 pb-3 pt-2 lg:hidden">
          <div>
            <Link href="/">
              <BrandLockup compact />
            </Link>
            <p className="mt-1 text-xs text-mute">{teamName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OfflinePill />
            <button
              type="button"
              onClick={() => void logout()}
              className="h-8 shrink-0 rounded-md border border-line bg-panel px-3 text-xs font-medium"
            >
              Sair
            </button>
          </div>
        </header>
        <main id="conteudo" className="flex-1 px-4 pb-28 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 lg:hidden" aria-label="Navegação principal">
          <div className="mx-auto max-w-lg border-t border-line bg-panel/95 backdrop-blur-md">
            <div className="grid grid-cols-5 px-1 py-2">
              {NAV.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-medium ${
                      active ? "text-aqua" : "text-mute"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
