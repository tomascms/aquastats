"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyzeRace, filterRaces } from "@/lib/race";
import { useAppState } from "@/lib/store";
import { EMPTY_FILTERS, RaceFilterBar, type RaceFilters } from "./race-filters";
import { MetricCards } from "./metric-cards";
import { SessionCharts } from "./session-charts";
import { ProvasNav } from "./provas-nav";

export function RaceDashboard({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const search = useSearchParams();
  const { athletes, raceSessions, swimmerId } = useAppState();
  const locked = role === "swimmer" ? swimmerId : "";
  const [filters, setFilters] = useState<RaceFilters>({
    ...EMPTY_FILTERS,
    athleteId: locked,
    sessionId: search.get("sessao") || "",
  });
  const matches = useMemo(
    () => filterRaces(raceSessions, { ...filters, athleteId: locked || filters.athleteId }),
    [filters, locked, raceSessions],
  );
  const session = matches.find((item) => item.id === filters.sessionId) ?? matches[0];
  const view = session ? analyzeRace(session) : null;
  const athlete = athletes.find((item) => item.id === session?.athleteId);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise de prova</p>
          <h1 className="text-3xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-mute">9 gráficos, voltas, SR, submerso e DPS — para cruzar com o treino.</p>
        </div>
        <ProvasNav role={role} />
      </header>
      <RaceFilterBar
        athletes={athletes}
        sessions={matches}
        value={{ ...filters, athleteId: locked || filters.athleteId }}
        hideAthlete={role === "swimmer"}
        onChange={(next) => setFilters({ ...next, athleteId: locked || next.athleteId })}
      />
      {!session || !view ? (
        <section className="rounded-xl border border-dashed border-line bg-panel/50 px-5 py-10 text-center">
          <p className="text-xl font-semibold tracking-tight">Ainda sem sessões neste filtro</p>
          <p className="mt-1 text-sm text-mute">
            {role === "coach"
              ? "Os resultados metem-se em Competição. Quando houver uma sessão, o painel enche-se aqui."
              : "Quando o treinador gravar a tua prova, aparece aqui."}
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-mist">
              <span className="font-semibold">{athlete?.name}</span>
              <span className="text-mute">
                {" "}
                · {session.date} · {session.distanceM} m · {session.tournament || "sem torneio"}
              </span>
            </p>
            <button type="button" onClick={() => window.print()} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-mute">
              Exportar PDF
            </button>
          </div>
          <MetricCards view={view} />
          <SessionCharts session={session} />
        </>
      )}
    </div>
  );
}
