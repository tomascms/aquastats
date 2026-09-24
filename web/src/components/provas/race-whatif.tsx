"use client";

import { useMemo, useState } from "react";
import { COURSE_LABEL, STROKE_LABEL, STROKES } from "@/lib/labels";
import { RACE_DISTANCES, analyzeRace, formatRaceClock, formatSeconds, whatIfLaps, type WhatIfStrategy } from "@/lib/race";
import { useAppState } from "@/lib/store";
import type { PoolCourse, Stroke } from "@/lib/types";
import { RaceChart } from "./charts";
import { ProvasNav } from "./provas-nav";

const STRATEGIES: { id: WhatIfStrategy; label: string }[] = [
  { id: "constant", label: "Esforço constante" },
  { id: "faster-start", label: "Partida mais rápida" },
  { id: "stronger-finish", label: "Chegada mais forte" },
];

export function RaceWhatIf({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const { athletes, raceSessions, swimmerId } = useAppState();
  const [athleteId, setAthleteId] = useState(role === "swimmer" ? swimmerId : athletes[0]?.id ?? "");
  const [stroke, setStroke] = useState<Stroke>("free");
  const [distanceM, setDistanceM] = useState(100);
  const [course, setCourse] = useState<PoolCourse>("scm");
  const [improve, setImprove] = useState(2);
  const [strategy, setStrategy] = useState<WhatIfStrategy>("constant");

  const best = useMemo(() => {
    const rows = raceSessions
      .filter((session) => session.athleteId === athleteId && session.stroke === stroke && session.distanceM === distanceM && session.course === course)
      .map((session) => analyzeRace(session))
      .filter((view) => view.totalTime > 0)
      .sort((a, b) => a.totalTime - b.totalTime);
    return rows[0] ?? null;
  }, [athleteId, course, distanceM, raceSessions, stroke]);

  const target = best ? best.totalTime * (1 - improve / 100) : 0;
  const ideal = best ? whatIfLaps(best, improve, strategy) : [];
  const labels = best?.laps.map((lap) => `V${lap.n}`) ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">What-if</h1>
          <p className="text-sm text-mute">O que acontece se o tempo melhorar X% — e como isso se reparte por volta.</p>
        </div>
        <ProvasNav role={role} />
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {role === "swimmer" ? null : (
          <select className="field" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        )}
        <select className="field" value={stroke} onChange={(e) => setStroke(e.target.value as Stroke)}>
          {STROKES.map((item) => (
            <option key={item} value={item}>
              {STROKE_LABEL[item]}
            </option>
          ))}
        </select>
        <select className="field" value={distanceM} onChange={(e) => setDistanceM(Number(e.target.value))}>
          {RACE_DISTANCES.map((item) => (
            <option key={item} value={item}>
              {item} m
            </option>
          ))}
        </select>
        <select className="field" value={course} onChange={(e) => setCourse(e.target.value as PoolCourse)}>
          <option value="scm">{COURSE_LABEL.scm}</option>
          <option value="lcm">{COURSE_LABEL.lcm}</option>
        </select>
        <label className="text-xs text-mute">
          Melhoria {improve}%
          <input className="mt-1 w-full" type="range" min={0.5} max={8} step={0.5} value={improve} onChange={(e) => setImprove(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {STRATEGIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStrategy(item.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${strategy === item.id ? "bg-aqua text-ink" : "border border-line text-mute"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Melhor actual" value={best ? formatRaceClock(best.totalTime) : "—"} />
        <Stat label="Velocidade média" value={best ? `${best.avgVelocity.toFixed(3)} m/s` : "—"} />
        <Stat label="Tempo alvo" value={best ? formatRaceClock(target) : "—"} />
        <Stat label="Ganho" value={`${improve.toFixed(1)} %`} />
      </div>
      {best ? (
        <>
          <RaceChart
            title="Actual vs ideal"
            labels={labels}
            series={[
              { id: "now", label: "Actual", color: "#ff6b6b", values: best.laps.map((lap) => lap.lapTime) },
              { id: "if", label: "What-if", color: "#5aa7ff", values: ideal, dashed: true },
            ]}
          />
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-mute">
                <tr>
                  <th className="px-3 py-2">Volta</th>
                  <th className="px-3 py-2">Actual</th>
                  <th className="px-3 py-2">Ideal</th>
                  <th className="px-3 py-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {best.laps.map((lap, index) => (
                  <tr key={lap.n} className="border-t border-line/70">
                    <td className="px-3 py-2">V{lap.n}</td>
                    <td className="px-3 py-2 font-mono">{formatSeconds(lap.lapTime)}</td>
                    <td className="px-3 py-2 font-mono text-aqua">{formatSeconds(ideal[index] || 0)}</td>
                    <td className="px-3 py-2 text-aqua">↓ {((lap.lapTime || 0) - (ideal[index] || 0)).toFixed(2)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
          Sem melhor tempo nesta prova. Grava uma sessão primeiro.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[22px] border border-line bg-panel px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-mute">{label}</p>
      <p className="text-xl font-semibold tracking-tight text-aqua">{value}</p>
    </article>
  );
}
