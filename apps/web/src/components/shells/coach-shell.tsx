"use client";

import { usePathname } from "next/navigation";
import { AppShell, type NavItem } from "@/components/shells/app-shell";import { IconCalendar, IconFlag, IconGrid, IconPeople, IconSettings } from "@/components/ui/icons";
import { useAppState } from "@/lib/store";

const NAV: NavItem[] = [
  { href: "/coach", label: "Calendário", icon: IconCalendar, exact: true },
  { href: "/coach/team", label: "Equipa", icon: IconPeople },
  { href: "/coach/competicoes", label: "Competição", icon: IconFlag },
  { href: "/coach/provas", label: "Análise", icon: IconGrid },
  { href: "/coach/definicoes", label: "Definições", icon: IconSettings },
];

export function CoachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { teamName } = useAppState();

  if (pathname.includes("/matrix")) return <>{children}</>;

  return (
    <AppShell nav={NAV} homeHref="/coach" context={teamName}>
      {children}
    </AppShell>
  );
}
