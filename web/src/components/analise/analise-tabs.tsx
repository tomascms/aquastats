"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AnaliseTabs({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const pathname = usePathname();
  const provaHref = role === "swimmer" ? "/swimmer/provas" : "/coach/provas";
  const treinoHref = role === "swimmer" ? "/swimmer/provas/treino" : "/coach/provas/treino";
  const treino = pathname.includes("/treino");
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-ink-2 p-1">
      <Link
        href={provaHref}
        className={`rounded-md px-3 py-2 text-center text-sm font-medium ${
          treino ? "text-mute hover:text-mist" : "bg-aqua text-ink"
        }`}
      >
        Análise de prova
      </Link>
      <Link
        href={treinoHref}
        className={`rounded-md px-3 py-2 text-center text-sm font-medium ${
          treino ? "bg-aqua text-ink" : "text-mute hover:text-mist"
        }`}
      >
        Análise de treino
      </Link>
    </div>
  );
}
