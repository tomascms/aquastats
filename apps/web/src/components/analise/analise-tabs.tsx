"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AnaliseTabs({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const pathname = usePathname();
  const provaHref = role === "swimmer" ? "/swimmer/provas" : "/coach/provas";
  const treinoHref = role === "swimmer" ? "/swimmer/provas/treino" : "/coach/provas/treino";
  const treino = pathname.includes("/treino");
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1">
      <Link
        href={provaHref}
        className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
          treino ? "text-mute hover:text-mist" : "bg-aqua text-white"
        }`}
      >
        Análise de prova
      </Link>
      <Link
        href={treinoHref}
        className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
          treino ? "bg-aqua text-white" : "text-mute hover:text-mist"
        }`}
      >
        Análise de treino
      </Link>
    </div>
  );
}
