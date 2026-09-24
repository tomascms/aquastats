"use client";

import { useMemo, useState } from "react";
import { STROKE_LABEL } from "@/lib/labels";
import { analyzeRace, formatRaceClock } from "@/lib/race";
import { useAppState } from "@/lib/store";
import { PieChart } from "./charts";
import { ProvasNav } from "./provas-nav";

const COLORS = ["#3dffe8", "#f5c542", "#ff6b6b", "#5aa7ff", "#c084fc", "#34d399", "#fb7185", "#94a3b8"];

export function RaceStats({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const { athletes, raceSessions, swimmerId } = useAppState();
  const [athleteId, setAthleteId] = useState(role === "swimmer" ? swimmerId : athletes[0]?.id ?? "");
  const mine = useMemo(
    () => raceSessions.filter((session) => session.athleteId === athleteId).map((session) => ({ session, view: analyzeRace(session) })),
    [athleteId, raceSessions],
  );
  const bests = new Map<string, (typeof mine)[number]>();
  for (const row of mine) {
    const key = `${row.session.stroke}-${row.session.distanceM}-${row.session.course}`;
    const current = bests.get(key);
    if (!current || row.view.totalTime < current.view.totalTime) bests.set(key, row);
  }
  const improvements = mine
    .filter((row) => row.view.totalTime > 0)
    .map((row) => {
      const key = `${row.session.stroke}-${row.session.distanceM}-${row.session.course}`;
      const best = bests.get(key);
      if (!best || best.session.id === row.session.id) return null;
      const delta = row.view.totalTime - best.view.totalTime;
      return { row, delta, pct: best.view.totalTime ? (delta / best.view.totalTime) * 100 : 0 };
    })
    .filter(Boolean)
    .sort((a, b) => (a && b ? a.delta - b.delta : 0))
    .slice(0, 6);
  const slices = Array.from(
    mine.reduce((map, row) => {
      const label = `${row.session.distanceM} ${STROKE_LABEL[row.session.stroke]}`;
      map.set(label, (map.get(label) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([label, value], index) => ({ label, value, color: COLORS[index % COLORS.length] }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">Estatísticas</h1>
        </div>
        <ProvasNav role={role} />
      </header>
      {role === "swimmer" ? null : (
        <select className="field max-w-sm" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.name}
            </option>
          ))}
        </select>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="font-semibold">Recordes pessoais</h2>
          <ul className="mt-3 space-y-2">
            {[...bests.values()].map(({ session, view }) => (
              <li key={session.id} className="flex items-center justify-between text-sm">
                <span>
                  {session.distanceM} {STROKE_LABEL[session.stroke]}
                </span>
                <span className="font-mono text-aqua">
                  {formatRaceClock(view.totalTime)} <span className="text-mute">{session.date}</span>
                </span>
              </li>
            ))}
            {bests.size === 0 ? <li className="text-sm text-mute">Sem provas ainda.</li> : null}
          </ul>
        </section>
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="font-semibold">Melhorias recentes</h2>
          <ul className="mt-3 space-y-2">
            {improvements.map((item) =>
              item ? (
                <li key={item.row.session.id} className="flex items-center justify-between text-sm">
                  <span>
                    {item.row.session.distanceM} {STROKE_LABEL[item.row.session.stroke]}
                  </span>
                  <span className="text-aqua">
                    {item.delta < 0 ? "↓" : "↑"} {Math.abs(item.delta).toFixed(2)} s ({Math.abs(item.pct).toFixed(1)}%)
                  </span>
                </li>
              ) : null,
            )}
            {improvements.length === 0 ? <li className="text-sm text-mute">Ainda sem comparações.</li> : null}
          </ul>
        </section>
        <div className="lg:col-span-2">
          <PieChart title="Distribuição por prova" slices={slices.length ? slices : [{ label: "Sem dados", value: 1, color: "#7f9aa6" }]} />
        </div>
      </div>
    </div>
  );
}
