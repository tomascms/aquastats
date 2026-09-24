"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnaliseTabs } from "@/components/analise/analise-tabs";
import { EvolutionChart } from "@/components/analise/evolution-chart";
import { COURSE_LABEL, STROKE_LABEL, ageFromDob, formatDatePt, formatEvent, initials, strokeLabel } from "@/lib/labels";
import {
  eventKey,
  eventRecords,
  finaPoints,
  findRecord,
  parseEventKey,
  personalBests,
  raceRecords,
  sliceRecords,
  timeDelta,
} from "@/lib/rankings";
import { formatRaceClock } from "@/lib/race";
import { annotateTrainingReps } from "@/lib/training-context";
import { useAppState } from "@/lib/store";
import type { PoolCourse, Stroke } from "@/lib/types";

function signed(seconds: number, pct: number) {
  const prefix = seconds > 0 ? "+" : "";
  return {
    faster: seconds < 0,
    clock: `${prefix}${seconds.toFixed(2)} s`,
    pct: `${prefix}${pct.toFixed(2)} %`,
  };
}

export function ProvaRankings({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { athletes, competitions, meetEntries, meetResults, raceSessions, swimmerId, teamName, workouts, timeLogs } = useAppState();
  const locked = role === "swimmer" ? swimmerId : "";
  const athleteId = locked || search.get("atleta") || "";
  const event = parseEventKey(search.get("evento") || "");
  const mode = search.get("lista") === "best" ? "best" : "last";
  const recordId = search.get("registo") || "";
  const compareId = search.get("comparar") || "";
  const athlete = athletes.find((item) => item.id === athleteId);
  const records = useMemo(
    () => (athleteId ? raceRecords(competitions, meetEntries, meetResults, raceSessions, athleteId, athlete?.seedRecords) : []),
    [athlete?.seedRecords, athleteId, competitions, meetEntries, meetResults, raceSessions],
  );
  const bests = useMemo(() => personalBests(records), [records]);

  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(search.toString());
    if (locked) next.set("atleta", locked);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">Análise</p>
          <h1 className="text-3xl font-semibold tracking-tight">Análise de prova</h1>
          <p className="text-sm text-mute">Recordes, evolução e comparação entre marcas.</p>
        </div>
        <div className="w-full max-w-md">
          <AnaliseTabs role={role} />
        </div>
      </header>

      {role === "coach" ? (
        <label className="block text-xs font-semibold uppercase tracking-wide text-mute">
          Atleta
          <select
            className="field mt-1"
            value={athleteId}
            onChange={(event) => setParams({ atleta: event.target.value || null, evento: null, registo: null, comparar: null })}
          >
            <option value="">Selecionar atleta…</option>
            {athletes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!athlete ? (
        <section className="rounded-xl border border-dashed border-line bg-panel/50 px-5 py-10 text-center">
          <p className="text-xl font-semibold tracking-tight">Escolhe o atleta</p>
          <p className="mt-1 text-sm text-mute">Os melhores tempos abrem a partir daí.</p>
        </section>
      ) : recordId ? (
        <RecordDetail
          athleteName={athlete.name}
          records={records}
          recordId={recordId}
          compareId={compareId}
          workouts={workouts}
          timeLogs={timeLogs}
          onBack={() => setParams({ registo: null, comparar: null })}
          onCompare={(id) => setParams({ comparar: id || null })}
        />
      ) : event ? (
        <EventBoard
          athleteName={athlete.name}
          records={records}
          stroke={event.stroke}
          distanceM={event.distanceM}
          mode={mode}
          onMode={(next) => setParams({ lista: next })}
          onBack={() => setParams({ evento: null, lista: null })}
          onOpen={(id) => setParams({ registo: id })}
        />
      ) : (
        <PersonalBestTable
          athleteName={athlete.name}
          teamName={teamName}
          dob={athlete.dateOfBirth}
          groupName={athlete.groupName}
          stroke={athlete.primaryStroke || undefined}
          bests={bests}
          onOpenEvent={(stroke, distanceM) => setParams({ evento: eventKey(stroke, distanceM) })}
        />
      )}
    </div>
  );
}

function PersonalBestTable({
  athleteName,
  teamName,
  dob,
  groupName,
  stroke,
  bests,
  onOpenEvent,
}: {
  athleteName: string;
  teamName: string;
  dob?: string;
  groupName?: string;
  stroke?: Stroke | "";
  bests: ReturnType<typeof personalBests>;
  onOpenEvent: (stroke: Stroke, distanceM: number) => void;
}) {
  const year = dob ? dob.slice(0, 4) : "";
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-xl font-semibold tracking-tight text-aqua">
          {initials(athleteName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-semibold tracking-tight">
            {athleteName}
            {year ? <span className="ml-2 text-base text-mute">({year})</span> : null}
          </p>
          <p className="text-sm text-mute">
            {teamName}
            {groupName ? ` · ${groupName}` : ""}
            {strokeLabel(stroke) ? ` · ${strokeLabel(stroke)}` : ""}
            {ageFromDob(dob) != null ? ` · ${ageFromDob(dob)} anos` : ""}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-4 py-3">Prova</th>
              <th className="px-3 py-3">Piscina</th>
              <th className="px-3 py-3">Tempo</th>
              <th className="px-3 py-3">Pts</th>
              <th className="px-3 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {bests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-mute">
                  Ainda sem tempos de prova para este atleta.
                </td>
              </tr>
            ) : (
              bests.map((record) => (
                <tr key={record.id} className="border-t border-line/70 hover:bg-ink-2">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenEvent(record.stroke, record.distanceM)}
                      className="font-semibold text-aqua hover:underline"
                    >
                      {formatEvent(record.distanceM, record.stroke)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-mute">{COURSE_LABEL[record.course]}</td>
                  <td className="px-3 py-2.5 font-mono text-mist">{formatRaceClock(record.timeS)}</td>
                  <td className="px-3 py-2.5 font-mono text-sand">
                    {finaPoints(record.timeS, record.course, record.stroke, record.distanceM) || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-mute">{formatDatePt(record.date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventBoard({
  athleteName,
  records,
  stroke,
  distanceM,
  mode,
  onMode,
  onBack,
  onOpen,
}: {
  athleteName: string;
  records: ReturnType<typeof raceRecords>;
  stroke: Stroke;
  distanceM: number;
  mode: "last" | "best";
  onMode: (mode: "last" | "best") => void;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const all = eventRecords(records, stroke, distanceM);
  const scm = sliceRecords(eventRecords(all, stroke, distanceM, "scm"), mode);
  const lcm = sliceRecords(eventRecords(all, stroke, distanceM, "lcm"), mode);
  const chart = mode === "best" ? sliceRecords(all, "best") : sliceRecords(all, "last");
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-mute">
        ← Recordes de {athleteName}
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sand">Ranking pessoal</p>
          <h2 className="text-2xl font-semibold tracking-tight">{formatEvent(distanceM, stroke)}</h2>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-ink p-1">
          <button
            type="button"
            onClick={() => onMode("last")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "last" ? "bg-aqua text-ink" : "text-mute"}`}
          >
            Últimas 10
          </button>
          <button
            type="button"
            onClick={() => onMode("best")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "best" ? "bg-sand text-ink" : "text-mute"}`}
          >
            10 melhores
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-panel p-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-mute">Evolução</p>
        <EvolutionChart records={chart} onSelect={onOpen} />
        <p className="mt-2 px-1 text-[11px] text-mute">Clica num ponto ou numa linha para abrir o detalhe.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <CourseList title="Piscina de 50 m" course="lcm" rows={lcm} onOpen={onOpen} />
        <CourseList title="Piscina de 25 m" course="scm" rows={scm} onOpen={onOpen} />
      </div>
    </div>
  );
}

function CourseList({
  title,
  course,
  rows,
  onOpen,
}: {
  title: string;
  course: PoolCourse;
  rows: ReturnType<typeof sliceRecords>;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-3">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-sand">{title}</p>
      {rows.length === 0 ? (
        <p className="px-1 py-6 text-sm text-mute">Sem registos em {COURSE_LABEL[course]}.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => onOpen(record.id)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left hover:bg-ink"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm text-aqua">{formatRaceClock(record.timeS)}</span>
                  <span className="block truncate text-[11px] text-mute">
                    {formatDatePt(record.date)}
                  </span>
                </span>
                <span className="font-mono text-xs text-sand">
                  {finaPoints(record.timeS, record.course, record.stroke, record.distanceM) || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecordDetail({
  athleteName,
  records,
  recordId,
  compareId,
  workouts,
  timeLogs,
  onBack,
  onCompare,
}: {
  athleteName: string;
  records: ReturnType<typeof raceRecords>;
  recordId: string;
  compareId: string;
  workouts: ReturnType<typeof useAppState>["workouts"];
  timeLogs: ReturnType<typeof useAppState>["timeLogs"];
  onBack: () => void;
  onCompare: (id: string) => void;
}) {
  const record = findRecord(records, recordId);
  const other = compareId ? findRecord(records, compareId) : undefined;
  if (!record) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
        Registo não encontrado.
        <button type="button" onClick={onBack} className="mt-3 block w-full text-aqua">
          Voltar
        </button>
      </p>
    );
  }
  const sameEvent = records.filter(
    (item) => item.stroke === record.stroke && item.distanceM === record.distanceM && item.id !== record.id,
  );
  const delta = other ? timeDelta(record.timeS, other.timeS) : null;
  const signedDelta = delta ? signed(delta.seconds, delta.pct) : null;
  const trainingContext = useMemo(() => {
    const rows = annotateTrainingReps(workouts, timeLogs, record.athleteId).filter((row) => {
      const days = Math.round((Date.parse(record.date) - Date.parse(row.date)) / 86_400_000);
      return days >= 0 && days <= 42 && row.distanceM === record.distanceM;
    });
    const recent = rows.slice(-12);
    const recentDates = new Set(recent.map((row) => row.date));
    const mean = recent.length ? recent.reduce((sum, row) => sum + row.timeS, 0) / recent.length : 0;
    const fatigue = recent.length ? recent.reduce((sum, row) => sum + row.fatigue, 0) / recent.length : 0;
    return { rows, recent, recentDates, mean, fatigue };
  }, [record.athleteId, record.date, record.distanceM, timeLogs, workouts]);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-mute">
        ← {formatEvent(record.distanceM, record.stroke)}
      </button>
      <section className="rounded-xl border border-sand/30 bg-panel p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sand">{athleteName}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{formatEvent(record.distanceM, record.stroke)}</h2>
        <p className="font-mono text-4xl text-aqua">{formatRaceClock(record.timeS)}</p>
        <p className="mt-1 text-sm text-mute">
          {formatDatePt(record.date)} · {COURSE_LABEL[record.course]}
        </p>
        <p className="mt-1 font-mono text-sm text-sand">
          {finaPoints(record.timeS, record.course, record.stroke, record.distanceM) || "—"} pts
        </p>
        {sameEvent.length ? (
          <button
            type="button"
            onClick={() => onCompare(other ? "" : sameEvent[0].id)}
            className="mt-3 rounded-full bg-sand px-4 py-2 text-sm font-bold text-ink"
          >
            {other ? "Fechar comparação" : "Comparar"}
          </button>
        ) : null}
      </section>

      {other && signedDelta ? (
        <section className="rounded-xl border border-line bg-panel p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-mute">
            Comparar com outra marca do mesmo atleta
            <select className="field mt-1" value={other.id} onChange={(event) => onCompare(event.target.value)}>
              {sameEvent.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatRaceClock(item.timeS)} · {formatDatePt(item.date)}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-ink px-3 py-3">
              <p className="text-[10px] uppercase text-mute">Este</p>
              <p className="font-mono text-lg text-aqua">{formatRaceClock(record.timeS)}</p>
              <p className="text-[11px] text-mute">{formatDatePt(record.date)}</p>
            </div>
            <div className="rounded-2xl bg-ink px-3 py-3">
              <p className="text-[10px] uppercase text-mute">Outro</p>
              <p className="font-mono text-lg text-sand">{formatRaceClock(other.timeS)}</p>
              <p className="text-[11px] text-mute">{formatDatePt(other.date)}</p>
            </div>
            <div className={`rounded-2xl px-3 py-3 ${signedDelta.faster ? "bg-aqua/15" : "bg-coral/15"}`}>
              <p className="text-[10px] uppercase text-mute">Diferença (outro − este)</p>
              <p className="font-mono text-lg">{signedDelta.clock}</p>
              <p className="text-sm text-mute">{signedDelta.pct}</p>
            </div>
          </div>
        </section>
      ) : null}

      <TrainingContextPanel
        recordDate={record.date}
        distanceM={record.distanceM}
        mean={trainingContext.mean}
        fatigue={trainingContext.fatigue}
        reps={trainingContext.recent.length}
        sessions={trainingContext.recentDates.size}
      />
    </div>
  );
}

function TrainingContextPanel({
  recordDate,
  distanceM,
  mean,
  fatigue,
  reps,
  sessions,
}: {
  recordDate: string;
  distanceM: number;
  mean: number;
  fatigue: number;
  reps: number;
  sessions: number;
}) {
  const hasData = reps > 0;
  const readiness = fatigue < 35 ? "Fresco" : fatigue < 60 ? "Carga intermédia" : "Carga elevada";
  return (
    <section className="data-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="metric-label">Contexto de treino</p>
          <h3 className="mt-1 text-lg font-semibold text-mist">O que preparou este resultado</h3>
          <p className="mt-1 text-xs text-mute">Repetições de {distanceM} m nos 42 dias anteriores a {formatDatePt(recordDate)}.</p>
        </div>
        <span className="soft-pill">{hasData ? readiness : "Sem dados"}</span>
      </div>
      {hasData ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="stat-card p-3">
            <p className="metric-label">Reps equivalentes</p>
            <p className="mt-2 metric-value">{reps}</p>
            <p className="mt-1 text-xs text-mute">em {sessions} sessões</p>
          </div>
          <div className="stat-card p-3">
            <p className="metric-label">Média no treino</p>
            <p className="mt-2 metric-value">{mean.toFixed(2)}<span className="ml-1 text-sm font-normal text-mute">s</span></p>
            <p className="mt-1 text-xs text-mute">mesma distância</p>
          </div>
          <div className="stat-card p-3">
            <p className="metric-label">Fadiga média</p>
            <p className="mt-2 metric-value">{Math.round(fatigue)}<span className="ml-1 text-sm font-normal text-mute">/100</span></p>
            <p className="mt-1 text-xs text-mute">antes da prova</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-ink-2 px-3 py-4 text-sm text-mute">
          Ainda não existem repetições de treino comparáveis para esta distância e janela temporal.
        </p>
      )}
    </section>
  );
}
