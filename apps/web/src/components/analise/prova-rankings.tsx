"use client";

import { PbGrid, RecordDetails } from "@/components/team/personal-bests";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnaliseTabs } from "@/components/analise/analise-tabs";
import { AthleteChips, NoAthletes } from "@/components/analise/athlete-chips";
import { EvolutionChart } from "@/components/analise/evolution-chart";
import { RaceInsights } from "@/components/competicoes/race-insights";
import { RaceAnalysisPanel } from "@/components/analise/race-analysis-panel";
import { COURSE_LABEL, ageFromDob, formatDatePt, formatEvent, initials, strokeLabel } from "@/lib/labels";
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
import type { Athlete, Gender, PoolCourse, RaceSession, Stroke, WellnessEntry } from "@/lib/types";
import { useT } from "@/i18n/provider";

function signed(seconds: number, pct: number) {
  const prefix = seconds > 0 ? "+" : "";
  return {
    faster: seconds < 0,
    clock: `${prefix}${seconds.toFixed(2)} s`,
    pct: `${prefix}${pct.toFixed(2)} %`,
  };
}

export function ProvaRankings({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { athletes, competitions, meetEntries, meetResults, raceSessions, swimmerId, teamName, workouts, timeLogs } = useAppState();
  const locked = role === "swimmer" ? swimmerId : "";
  const athleteId = locked || search.get("atleta") || athletes[0]?.id || "";
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t("Análise de prova")}</h1>
          <p className="mt-1 text-sm text-mute">{t("Recordes, evolução e comparação entre marcas.")}</p>
        </div>
        <div className="w-full max-w-md">
          <AnaliseTabs role={role} />
        </div>
      </header>

      {role === "coach" ? (
        <AthleteChips
          athletes={athletes}
          selectedId={athleteId}
          onSelect={(id) => setParams({ atleta: id, evento: null, registo: null, comparar: null })}
        />
      ) : null}

      {!athlete ? (
        <NoAthletes />
      ) : recordId ? (
        <RecordDetail
          athlete={athlete}
          role={role}
          gender={athlete.gender}
          records={records}
          recordId={recordId}
          compareId={compareId}
          workouts={workouts}
          timeLogs={timeLogs}
          raceSessions={raceSessions.filter((item) => item.athleteId === athleteId)}
          wellness={athlete.wellness ?? []}
          onBack={() => setParams({ registo: null, comparar: null })}
          onCompare={(id) => setParams({ comparar: id || null })}
        />
      ) : event ? (
        <EventBoard
          athleteName={athlete.name}
          gender={athlete.gender}
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
          gender={athlete.gender}
          teamName={teamName}
          dob={athlete.dateOfBirth}
          groupName={athlete.groupName}
          stroke={athlete.primaryStroke || undefined}
          bests={bests}
          recordCount={records.length}
          onOpenEvent={(stroke, distanceM) => setParams({ evento: eventKey(stroke, distanceM) })}
          onOpenRecord={(id) => setParams({ registo: id })}
        />
      )}
    </div>
  );
}

function PersonalBestTable({
  athleteName,
  gender,
  teamName,
  dob,
  groupName,
  stroke,
  bests,
  recordCount,
  onOpenEvent,
  onOpenRecord,
}: {
  athleteName: string;
  gender?: Gender | "";
  teamName: string;
  dob?: string;
  groupName?: string;
  stroke?: Stroke | "";
  bests: ReturnType<typeof personalBests>;
  recordCount: number;
  onOpenEvent: (stroke: Stroke, distanceM: number) => void;
  onOpenRecord: (id: string) => void;
}) {
  const t = useT();
  const { historyLoaded } = useAppState();
  const year = dob ? dob.slice(0, 4) : "";
  const scored = bests
    .map((record) => ({ record, points: finaPoints(record.timeS, record.course, record.stroke, record.distanceM, gender) || 0 }))
    .sort((a, b) => b.points - a.points);
  const top = scored[0]?.points ? scored[0] : undefined;
  const latest = bests.reduce<string>((max, record) => (record.date > max ? record.date : max), "");
  const age = ageFromDob(dob);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="bg-aqua px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/12 font-display text-2xl font-bold">
            {initials(athleteName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-3xl font-bold leading-none">
              {athleteName}
              {year ? <span className="ml-2 text-lg font-medium text-white/60">{year}</span> : null}
            </p>
            <p className="mt-1.5 text-sm text-white/70">
              {[teamName, strokeLabel(stroke), age != null ? t("{age} anos", { age }) : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
          <div>
            <dt className="text-xs text-white/65">{t("Registos de prova")}</dt>
            <dd className="font-display text-3xl font-bold tabular">{recordCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/65">
              {t("Melhor pontuação FINA")}
              {gender !== "M" && gender !== "F" ? <span className="block text-[#ffd8a8]">{t("define o género do atleta")}</span> : null}
            </dt>
            <dd className="font-display text-3xl font-bold tabular">
              {top ? top.points : "—"}
              {top ? (
                <span className="ml-2 align-middle font-sans text-xs font-medium text-white/65">
                  {formatEvent(top.record.distanceM, top.record.stroke)}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-white/65">{t("Última prova")}</dt>
            <dd className="font-display text-3xl font-bold tabular">{latest ? formatDatePt(latest).slice(0, 5) : "—"}</dd>
          </div>
        </dl>
      </div>
      {bests.length === 0 ? (
        <p className="px-4 py-8 text-center text-mute" role="status">{historyLoaded ? t("Ainda sem tempos de prova para este atleta.") : t("A carregar…")}</p>
      ) : (
        <>
          <PbGrid bests={bests} gender={gender} onOpen={(record) => onOpenRecord(record.id)} onOpenEvent={onOpenEvent} titleFor={() => t("Abrir análise")} />
          <p className="px-4 py-2 text-[11px] text-mute">{t("Carrega num tempo para abrir a análise dessa prova, ou na distância para ver todas as marcas.")}</p>
        </>
      )}
    </section>
  );
}

function EventBoard({
  athleteName,
  gender,
  records,
  stroke,
  distanceM,
  mode,
  onMode,
  onOpen,
  onBack,
}: {
  athleteName: string;
  gender?: Gender | "";
  records: ReturnType<typeof raceRecords>;
  stroke: Stroke;
  distanceM: number;
  mode: "last" | "best";
  onMode: (mode: "last" | "best") => void;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const all = eventRecords(records, stroke, distanceM);
  const scm = sliceRecords(eventRecords(all, stroke, distanceM, "scm"), mode);
  const lcm = sliceRecords(eventRecords(all, stroke, distanceM, "lcm"), mode);
  // 25 m and 50 m times aren't comparable (turns differ), so the chart is always just one pool.
  const [chartCourse, setChartCourse] = useState<PoolCourse>(lcm.length >= scm.length ? "lcm" : "scm");
  useEffect(() => {
    setChartCourse(lcm.length >= scm.length ? "lcm" : "scm");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stroke, distanceM]);
  const chartRows = chartCourse === "lcm" ? lcm : scm;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-pool hover:underline">
        ← {t("Recordes de {name}", { name: athleteName })}
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{formatEvent(distanceM, stroke)}</h2>
          <p className="text-sm text-mute">{t("Ranking pessoal de {name}", { name: athleteName })}</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1">
          <button
            type="button"
            onClick={() => onMode("last")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "last" ? "bg-aqua text-white" : "text-mute hover:text-mist"}`}
          >
            {t("Últimas 10")}
          </button>
          <button
            type="button"
            onClick={() => onMode("best")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "best" ? "bg-aqua text-white" : "text-mute hover:text-mist"}`}
          >
            {t("10 melhores")}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-panel p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="font-display text-xl font-bold">{t("Evolução")}</h3>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel-2 p-0.5">
            {(["lcm", "scm"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setChartCourse(item)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${chartCourse === item ? "bg-aqua text-white" : "text-mute hover:text-mist"}`}
              >
                {item === "lcm" ? "50 m" : "25 m"}
              </button>
            ))}
          </div>
        </div>
        <EvolutionChart records={chartRows} onSelect={onOpen} />
        <p className="mt-2 px-1 text-[11px] text-mute">{t("Clica num ponto ou numa linha para abrir o detalhe.")}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <CourseList gender={gender} title={t("Piscina de {course}", { course: "50 m" })} course="lcm" rows={lcm} onOpen={onOpen} />
        <CourseList gender={gender} title={t("Piscina de {course}", { course: "25 m" })} course="scm" rows={scm} onOpen={onOpen} />
      </div>
    </div>
  );
}

function CourseList({
  gender,
  title,
  course,
  rows,
  onOpen,
}: {
  gender?: Gender | "";
  title: string;
  course: PoolCourse;
  rows: ReturnType<typeof sliceRecords>;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="px-1 font-display text-xl font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-1 py-6 text-sm text-mute">{t("Sem registos em {course}.", { course: COURSE_LABEL[course] })}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => onOpen(record.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-panel-2"
              >
                <span className="min-w-0">
                  <span className="block font-display text-xl font-bold text-mist tabular">{formatRaceClock(record.timeS)}</span>
                  <span className="block truncate text-[11px] text-mute">
                    {formatDatePt(record.date)}
                  </span>
                </span>
                <span className="font-mono text-xs text-sand">
                  {finaPoints(record.timeS, record.course, record.stroke, record.distanceM, gender) || "—"}
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
  athlete,
  role,
  gender,
  records,
  recordId,
  compareId,
  workouts,
  timeLogs,
  raceSessions,
  wellness = [],
  onBack,
  onCompare,
}: {
  athlete: Athlete;
  role: "coach" | "swimmer";
  gender?: Gender | "";
  records: ReturnType<typeof raceRecords>;
  recordId: string;
  compareId: string;
  workouts: ReturnType<typeof useAppState>["workouts"];
  timeLogs: ReturnType<typeof useAppState>["timeLogs"];
  raceSessions: RaceSession[];
  wellness?: WellnessEntry[];
  onBack: () => void;
  onCompare: (id: string) => void;
}) {
  const t = useT();
  const athleteName = athlete.name;
  const record = findRecord(records, recordId);
  const [addingDetails, setAddingDetails] = useState(false);
  const other = compareId ? findRecord(records, compareId) : undefined;
  const athleteIdForContext = record?.athleteId ?? "";
  // Every rep the athlete swam (any distance); form is read per group, never converted between them.
  const reps = athleteIdForContext ? annotateTrainingReps(workouts, timeLogs, athleteIdForContext, wellness) : [];

  if (!record) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
        {t("Registo não encontrado.")}
        <button type="button" onClick={onBack} className="mt-3 block w-full text-aqua">
          {t("Voltar")}
        </button>
      </p>
    );
  }
  // Only marks from the same event in the same pool are comparable; 25 m and 50 m times differ by turns.
  const sameEvent = records
    .filter(
      (item) =>
        item.stroke === record.stroke &&
        item.distanceM === record.distanceM &&
        item.course === record.course &&
        item.id !== record.id,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const previous = sameEvent.find((item) => item.date <= record.date) ?? sameEvent[0];
  const comparable = other && other.course === record.course ? other : undefined;
  // "This vs the other": negative means this mark is faster.
  const delta = comparable ? timeDelta(comparable.timeS, record.timeS) : null;
  const signedDelta = delta ? signed(delta.seconds, delta.pct) : null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-pool hover:underline">
        ← {formatEvent(record.distanceM, record.stroke)}
      </button>
      <section className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-xs font-semibold text-sand">{athleteName}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{formatEvent(record.distanceM, record.stroke)}</h2>
        <p className="mt-1 font-display text-6xl font-bold leading-none text-aqua tabular">{formatRaceClock(record.timeS)}</p>
        <p className="mt-1 text-sm text-mute">
          {formatDatePt(record.date)} · {COURSE_LABEL[record.course]}
        </p>
        <p className="mt-1 font-mono text-sm text-sand">
          {finaPoints(record.timeS, record.course, record.stroke, record.distanceM, gender) || "—"} {t("pts")}
        </p>
        {sameEvent.length ? (
          <button
            type="button"
            onClick={() => onCompare(comparable ? "" : previous.id)}
            className="btn-primary mt-4"
          >
            {comparable ? t("Fechar comparação") : t("Comparar com outra marca")}
          </button>
        ) : (
          <p className="mt-4 text-sm text-mute">{t("Sem outras marcas desta prova em {course} para comparar.", { course: COURSE_LABEL[record.course] })}</p>
        )}
      </section>

      {comparable && signedDelta ? (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <label className="block text-sm font-semibold text-mist">
            {t("Comparar com")}
            <select className="field mt-1.5" value={comparable.id} onChange={(event) => onCompare(event.target.value)}>
              {sameEvent.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatRaceClock(item.timeS)} · {formatDatePt(item.date)}
                  {item.meetTitle ? ` · ${item.meetTitle}` : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-mute">
            {t("Só marcas de {event} em {course}.", { event: formatEvent(record.distanceM, record.stroke), course: COURSE_LABEL[record.course] })}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-panel-2 px-4 py-3">
              <p className="text-xs text-mute">{t("Esta marca")} · {formatDatePt(record.date)}</p>
              <p className="font-display text-3xl font-bold text-mist tabular">{formatRaceClock(record.timeS)}</p>
            </div>
            <div className="rounded-xl bg-panel-2 px-4 py-3">
              <p className="text-xs text-mute">{t("Comparada com")} · {formatDatePt(comparable.date)}</p>
              <p className="font-display text-3xl font-bold text-mist tabular">{formatRaceClock(comparable.timeS)}</p>
            </div>
            <div className={`rounded-xl px-4 py-3 ${signedDelta.faster ? "bg-good-soft" : delta && delta.seconds === 0 ? "bg-panel-2" : "bg-[#fdecea]"}`}>
              <p className="text-xs text-mute">
                {signedDelta.faster ? t("Esta marca é mais rápida") : delta && delta.seconds === 0 ? t("Tempos iguais") : t("Esta marca é mais lenta")}
              </p>
              <p className={`font-display text-3xl font-bold tabular ${signedDelta.faster ? "text-good" : "text-coral"}`}>{signedDelta.clock}</p>
              <p className="text-sm text-mute">{signedDelta.pct}</p>
            </div>
          </div>
        </section>
      ) : null}

      {(() => {
        const session = raceSessions.find((item) => item.id === (record.sessionId ?? record.id));
        if (!session) {
          // A seed record (e.g. from SwimRankings) has no meet entry, so its details are added right
          // here; a real meet result without details yet is edited from the competition's results page.
          return (
            <div className="rounded-2xl border border-dashed border-line bg-panel px-5 py-4">
              <p className="text-sm text-mute">
                {role === "coach"
                  ? t("Adiciona informação a esta prova (reação, 15 m, subaquático, viragens, frequências…) para a cruzar com a preparação.")
                  : t("Sem informação desta prova (reação, 15 m, subaquático, viragens…). Só o treinador pode adicioná-la.")}
              </p>
              {role !== "coach" ? null : record.competitionId ? (
                <a href={`/coach/competicoes/${record.competitionId}/resultados/${record.entryId}`} className="btn-primary mt-3 inline-flex h-10">
                  {t("Adicionar detalhes da prova")}
                </a>
              ) : addingDetails ? (
                <div className="mt-3">
                  <RecordDetails athlete={athlete} record={record} role={role} onClose={() => setAddingDetails(false)} />
                </div>
              ) : (
                <button type="button" className="btn-primary mt-3 h-10" onClick={() => setAddingDetails(true)}>
                  {t("Adicionar detalhes da prova")}
                </button>
              )}
            </div>
          );
        }
        return (
          <>
            <RaceInsights session={session} others={raceSessions} />
          </>
        );
      })()}

      <RaceAnalysisPanel
        mark={record}
        sameEvent={[record, ...sameEvent]}
        audience={role === "swimmer" ? "athlete" : "coach"}
        session={
          raceSessions.find((item) => item.id === (record.sessionId ?? record.id)) ?? {
            id: record.id,
            athleteId: record.athleteId,
            date: record.date,
            tournament: "",
            course: record.course,
            distanceM: record.distanceM,
            stroke: record.stroke,
            dayPart: "am",
            reactionS: 0,
            flightS: 0,
            officialTimeS: record.timeS,
            laps: [],
            createdAt: "",
          }
        }
        sessions={raceSessions}
        workouts={workouts}
        wellness={wellness}
        reps={reps}
      />
    </div>
  );
}
