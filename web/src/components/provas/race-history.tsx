"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { COURSE_LABEL, STROKE_LABEL } from "@/lib/labels";
import { DAY_PART_LABEL, analyzeRace, exportRacesCsv, formatRaceClock } from "@/lib/race";
import { actions, useAppState } from "@/lib/store";
import { ProvasNav } from "./provas-nav";

export function RaceHistory({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const { athletes, raceSessions, swimmerId } = useAppState();
  const [athleteId, setAthleteId] = useState(role === "swimmer" ? swimmerId : "");
  const nameOf = (id: string) => athletes.find((item) => item.id === id)?.name ?? "Atleta";
  const rows = useMemo(
    () =>
      raceSessions
        .filter((session) => !athleteId || session.athleteId === athleteId)
        .map((session) => ({ session, view: analyzeRace(session) })),
    [athleteId, raceSessions],
  );
  const dash = role === "coach" ? "/coach/provas" : "/swimmer/provas";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">Histórico</h1>
        </div>
        <ProvasNav role={role} />
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {role === "coach" ? (
          <select className="field max-w-xs !py-2.5" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">Todos os atletas</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => exportRacesCsv(rows.map((row) => row.session), nameOf)}
          className="h-10 rounded-2xl border border-line px-4 text-sm font-semibold"
        >
          Exportar Excel
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-3 py-2">Atleta</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Torneio</th>
              <th className="px-3 py-2">Prova</th>
              <th className="px-3 py-2">Piscina</th>
              <th className="px-3 py-2">Sessão</th>
              <th className="px-3 py-2">Tempo</th>
              <th className="px-3 py-2">SR</th>
              <th className="px-3 py-2">V</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ session, view }) => (
              <tr key={session.id} className="border-t border-line/70">
                <td className="px-3 py-2 font-semibold">{nameOf(session.athleteId)}</td>
                <td className="px-3 py-2 text-mute">{session.date}</td>
                <td className="max-w-[160px] truncate px-3 py-2 text-mute" title={session.tournament}>
                  {session.tournament || "—"}
                </td>
                <td className="px-3 py-2">
                  {session.distanceM} {STROKE_LABEL[session.stroke]}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-bold text-coral">
                    {COURSE_LABEL[session.course]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      session.dayPart === "am" ? "bg-sand/20 text-sand" : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {DAY_PART_LABEL[session.dayPart]}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-aqua">{formatRaceClock(view.totalTime)}</td>
                <td className="px-3 py-2 font-mono">{view.avgSr.toFixed(1)}</td>
                <td className="px-3 py-2 font-mono">{view.avgVelocity.toFixed(3)}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`${dash}?sessao=${session.id}`} className="mr-2 text-xs font-semibold text-aqua">
                    Ver
                  </Link>
                  {role === "coach" ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-coral"
                      onClick={() => {
                        if (window.confirm("Apagar esta sessão?")) void actions.deleteRaceSession(session.id);
                      }}
                    >
                      X
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-mute">Sem sessões gravadas.</p> : null}
      </div>
    </div>
  );
}
