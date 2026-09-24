"use client";

import { useMemo, useState } from "react";
import { STROKE_LABEL, STROKES } from "@/lib/labels";
import { RACE_DISTANCES, analyzeRace, formatRaceClock } from "@/lib/race";
import { useAppState } from "@/lib/store";
import type { Stroke } from "@/lib/types";
import { RaceChart } from "./charts";
import { ProvasNav } from "./provas-nav";

export function RaceProgress({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const { athletes, raceSessions, swimmerId } = useAppState();
  const [athleteId, setAthleteId] = useState(role === "swimmer" ? swimmerId : athletes[0]?.id ?? "");
  const [stroke, setStroke] = useState<Stroke | "">("");
  const [distanceM, setDistanceM] = useState<number | "">("");
  const rows = useMemo(() => {
    return raceSessions
      .filter((session) => session.athleteId === athleteId)
      .filter((session) => !stroke || session.stroke === stroke)
      .filter((session) => !distanceM || session.distanceM === distanceM)
      .map((session) => ({ session, view: analyzeRace(session) }))
      .sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [athleteId, distanceM, raceSessions, stroke]);

  const deltas = rows.map((row, index) => {
    const prev = rows[index - 1];
    const delta = prev ? row.view.totalTime - prev.view.totalTime : 0;
    return { ...row, delta };
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">Progresso</h1>
          <p className="text-sm text-mute">Linha a descer = melhoria. Setas verdes mostram o ganho exacto.</p>
        </div>
        <ProvasNav role={role} />
      </header>
      <div className="grid gap-2 sm:grid-cols-3">
        {role === "swimmer" ? null : (
          <select className="field" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        )}
        <select className="field" value={stroke} onChange={(e) => setStroke(e.target.value as Stroke | "")}>
          <option value="">Todos os estilos</option>
          {STROKES.map((item) => (
            <option key={item} value={item}>
              {STROKE_LABEL[item]}
            </option>
          ))}
        </select>
        <select className="field" value={distanceM} onChange={(e) => setDistanceM(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Todas as distâncias</option>
          {RACE_DISTANCES.map((item) => (
            <option key={item} value={item}>
              {item} m
            </option>
          ))}
        </select>
      </div>
      <RaceChart
        title="Evolução do tempo"
        unit="mais baixo = mais rápido"
        labels={deltas.map((row) => row.session.date.slice(5))}
        series={[{ id: "t", label: "Tempo (s)", color: "#3dffe8", values: deltas.map((row) => row.view.totalTime) }]}
      />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-3 py-2">Prova</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Tempo</th>
              <th className="px-3 py-2">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map(({ session, view, delta }) => (
              <tr key={session.id} className="border-t border-line/70">
                <td className="px-3 py-2">
                  {session.distanceM} {STROKE_LABEL[session.stroke]}
                </td>
                <td className="px-3 py-2 text-mute">{session.date}</td>
                <td className="px-3 py-2 font-mono text-aqua">{formatRaceClock(view.totalTime)}</td>
                <td className="px-3 py-2">
                  {delta < 0 ? (
                    <span className="text-aqua">↓ {Math.abs(delta).toFixed(2)} s</span>
                  ) : delta > 0 ? (
                    <span className="text-coral">↑ {delta.toFixed(2)} s</span>
                  ) : (
                    <span className="text-mute">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
