"use client";

import { useState } from "react";
import { sessionTitle } from "@/lib/race";
import { useAppState } from "@/lib/store";
import { CompareCharts } from "./session-charts";
import { ProvasNav } from "./provas-nav";

export function RaceCompare({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const { athletes, raceSessions, swimmerId } = useAppState();
  const pool = role === "swimmer" ? raceSessions.filter((item) => item.athleteId === swimmerId) : raceSessions;
  const [a, setA] = useState(pool[0]?.id ?? "");
  const [b, setB] = useState(pool[1]?.id ?? pool[0]?.id ?? "");
  const left = pool.find((item) => item.id === a);
  const right = pool.find((item) => item.id === b);
  const nameOf = (id?: string) => athletes.find((item) => item.id === id)?.name ?? "Sessão";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">Comparar</h1>
          <p className="text-sm text-mute">A em vermelho, B em azul tracejado. Mesmo atleta ou dois atletas.</p>
        </div>
        <ProvasNav role={role} />
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="rounded-xl border border-coral/40 bg-coral/10 p-3 text-xs font-semibold uppercase tracking-wide text-coral">
          Sessão A
          <select className="field mt-2" value={a} onChange={(e) => setA(e.target.value)}>
            {pool.map((session) => (
              <option key={session.id} value={session.id}>
                {sessionTitle(session, nameOf(session.athleteId))}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-xl border border-sky-400/40 bg-sky-400/10 p-3 text-xs font-semibold uppercase tracking-wide text-sky-300">
          Sessão B
          <select className="field mt-2" value={b} onChange={(e) => setB(e.target.value)}>
            {pool.map((session) => (
              <option key={session.id} value={session.id}>
                {sessionTitle(session, nameOf(session.athleteId))}
              </option>
            ))}
          </select>
        </label>
      </div>
      {left && right ? (
        <CompareCharts a={left} b={right} nameA={nameOf(left.athleteId)} nameB={nameOf(right.athleteId)} />
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
          Precisas de pelo menos uma sessão para comparar.
        </p>
      )}
    </div>
  );
}
