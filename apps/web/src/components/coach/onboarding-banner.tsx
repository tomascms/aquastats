"use client";

import Link from "next/link";
import { useAppState } from "@/lib/store";

export function OnboardingBanner() {
  const { workouts, athletes, teamName } = useAppState();
  if (workouts.length > 0) return null;

  const steps = [
    { done: Boolean(teamName), label: "Equipa criada", href: "/coach/definicoes" },
    { done: athletes.length > 1, label: "Atletas convidados", href: "/coach/team" },
    { done: false, label: "Primeiro treino", href: "/coach/workouts/new" },
  ];

  return (
    <section className="card border-aqua/20 bg-[linear-gradient(135deg,rgba(15,31,61,0.05),rgba(74,114,164,0.08))] p-4 sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-aqua">Primeiros passos</p>
          <h2 className="mt-1 text-lg font-semibold text-mist">Configura a tua equipa</h2>
        </div>
        <span className="soft-pill">Checklist</span>
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3 rounded-xl border border-line bg-white/70 px-3 py-2 text-sm">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                step.done ? "bg-aqua text-ink" : "border border-line text-mute"
              }`}
              aria-hidden="true"
            >
              {step.done ? "✓" : "·"}
            </span>
            <Link href={step.href} className={step.done ? "text-mute line-through" : "font-medium text-mist hover:text-aqua"}>
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
