"use client";

import { AppShell, type NavItem } from "@/components/shells/app-shell";
import { IconCalendar, IconFlag, IconHome, IconSettings } from "@/components/ui/icons";
import { useAppState } from "@/lib/store";

const NAV: NavItem[] = [
  { href: "/swimmer", label: "Hoje", icon: IconHome, exact: true },
  { href: "/swimmer/history", label: "Tempos", icon: IconCalendar },
  { href: "/swimmer/provas", label: "Análise", icon: IconFlag },
  { href: "/swimmer/definicoes", label: "Definições", icon: IconSettings },
];

export function SwimmerShell({ children }: { children: React.ReactNode }) {
  const { athletes, swimmerId } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId);

  return (
    <AppShell nav={NAV} homeHref="/swimmer" context={me?.name ?? "Atleta"} narrow>
      {children}
    </AppShell>
  );
}
