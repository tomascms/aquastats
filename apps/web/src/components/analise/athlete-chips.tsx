"use client";

import { useT } from "@/i18n/provider";
import { initials } from "@/lib/labels";

export function AthleteChips({
  athletes,
  selectedId,
  onSelect,
}: {
  athletes: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  if (athletes.length === 0) return null;
  return (
    <nav aria-label={t("Escolher atleta")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {athletes.map((item) => {
        const active = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(item.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-semibold transition-colors ${
              active ? "border-aqua bg-aqua text-white" : "border-line bg-panel text-mist hover:border-aqua"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold ${
                active ? "bg-white/15 text-white" : "bg-aqua-soft text-aqua"
              }`}
            >
              {initials(item.name)}
            </span>
            {item.name}
          </button>
        );
      })}
    </nav>
  );
}

export function NoAthletes() {
  const t = useT();
  return (
    <section className="rounded-xl border border-dashed border-line-strong bg-panel px-5 py-10 text-center">
      <p className="font-display text-2xl font-bold">{t("Ainda não há atletas")}</p>
      <p className="mt-1 text-sm text-mute">{t("Adiciona atletas em Equipa para ver recordes, treinos e evolução.")}</p>
    </section>
  );
}
