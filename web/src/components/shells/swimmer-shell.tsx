"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLockup } from "@/components/ui/brand";
import { IconCalendar, IconFlag, IconHome, IconSettings } from "@/components/ui/icons";
import { actions, useAppState } from "@/lib/store";

const NAV = [
  { href: "/swimmer", label: "Hoje", icon: IconHome, exact: true },
  { href: "/swimmer/history", label: "Tempos", icon: IconCalendar },
  { href: "/swimmer/provas", label: "Análise", icon: IconFlag },
  { href: "/swimmer/definicoes", label: "Definições", icon: IconSettings },
];

export function SwimmerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { athletes, swimmerId } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId);

  async function logout() {
    await actions.logout();
    router.replace("/entrar");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col lg:max-w-none">
      <header className="safe-top flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <Link href="/swimmer">
          <BrandLockup compact />
        </Link>
        <div className="flex items-center gap-2">
          <p className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-mute">{me?.name ?? "Atleta"}</p>
          <button type="button" onClick={() => void logout()} className="text-xs text-mute">
            Sair
          </button>
        </div>
      </header>
      <main id="conteudo" className="flex-1 px-4 pb-28">
        {children}
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur-md" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-lg grid-cols-4 px-2 py-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-semibold ${
                  active ? "text-aqua" : "text-mute"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
