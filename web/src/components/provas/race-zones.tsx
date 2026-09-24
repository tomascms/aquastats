"use client";

import { useMemo, useState } from "react";
import { COURSE_LABEL, STROKE_LABEL, STROKES } from "@/lib/labels";
import { RACE_DISTANCES, ZONES, analyzeRace, formatRaceClock, pace100, scaleTime } from "@/lib/race";
import { useAppState } from "@/lib/store";
import type { PoolCourse, Stroke } from "@/lib/types";
import { ProvasNav } from "./provas-nav";

const DIST_TABLE = [25, 50, 100, 200, 400, 800];

export function RaceZones({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const { athletes, raceSessions, swimmerId } = useAppState();
  const [athleteId, setAthleteId] = useState(role === "swimmer" ? swimmerId : athletes[0]?.id ?? "");
  const [stroke, setStroke] = useState<Stroke>("free");
  const [distanceM, setDistanceM] = useState(100);
  const [course, setCourse] = useState<PoolCourse>("scm");

  const best = useMemo(() => {
    const rows = raceSessions
      .filter((session) => session.athleteId === athleteId && session.stroke === stroke && session.distanceM === distanceM && session.course === course)
      .map((session) => analyzeRace(session))
      .filter((view) => view.totalTime > 0)
      .sort((a, b) => a.totalTime - b.totalTime);
    return rows[0] ?? null;
  }, [athleteId, course, distanceM, raceSessions, stroke]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">Tempo alvo · Z1–Z6</h1>
          <p className="text-sm text-mute">Zonas EN1–SP3 a partir do melhor tempo da prova escolhida.</p>
        </div>
        <ProvasNav role={role} />
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
      {!best ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
          Sem melhor tempo nesta prova.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ZONES.map((zone) => {
              const time = best.totalTime * zone.pct;
              return (
                <article key={zone.id} className="rounded-[22px] border border-line bg-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-aqua">
                    {zone.id} · {zone.code}
                  </p>
                  <h3 className="text-lg font-semibold">{zone.name}</h3>
                  <p className="font-mono text-2xl text-aqua">{formatRaceClock(time)}</p>
                  <p className="text-xs text-mute">
                    {zone.hr} · pace 100 {formatRaceClock(pace100(time, distanceM))}
                  </p>
                  <p className="mt-1 text-xs text-mute">{zone.hint}</p>
                </article>
              );
            })}
          </div>
          <section className="overflow-x-auto rounded-xl border border-line bg-panel">
            <h2 className="px-4 pt-4 font-semibold">Tempos por distância</h2>
            <table className="mt-2 min-w-[720px] w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-mute">
                <tr>
                  <th className="px-3 py-2">Zona</th>
                  {DIST_TABLE.map((item) => (
                    <th key={item} className="px-3 py-2">
                      {item} m
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ZONES.map((zone) => (
                  <tr key={zone.id} className="border-t border-line/70">
                    <td className="px-3 py-2 font-semibold">
                      {zone.id} {zone.code}
                    </td>
                    {DIST_TABLE.map((item) => (
                      <td key={item} className="px-3 py-2 font-mono">
                        {formatRaceClock(scaleTime(best.totalTime * zone.pct, distanceM, item))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
