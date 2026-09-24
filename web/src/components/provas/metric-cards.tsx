"use client";

import { formatRaceClock, formatSeconds } from "@/lib/race";
import type { RaceView } from "@/lib/race";

export function MetricCards({ view }: { view: RaceView }) {
  const cards = [
    { label: "Tempo total", value: formatRaceClock(view.totalTime), hint: "Σ voltas + reacção" },
    { label: "SR médio", value: view.avgSr ? `${view.avgSr.toFixed(1)}` : "—", hint: "cyc/min" },
    { label: "Velocidade média", value: view.avgVelocity ? `${view.avgVelocity.toFixed(3)}` : "—", hint: "m/s" },
    {
      label: "Reacção + voo",
      value: formatSeconds((view.session.reactionS || 0) + (view.session.flightS || 0)),
      hint: `${formatSeconds(view.session.reactionS)} + ${formatSeconds(view.session.flightS)}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="relative overflow-hidden rounded-[22px] border border-aqua/15 bg-gradient-to-br from-aqua/10 to-panel px-4 py-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tracking-tight text-aqua">{card.value}</p>
          <p className="text-[11px] text-mute">{card.hint}</p>
        </article>
      ))}
    </div>
  );
}
