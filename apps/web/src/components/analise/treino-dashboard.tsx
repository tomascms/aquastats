"use client";

import { useMemo, useState } from "react";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, STROKE_LABEL, formatDatePt } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import { formatMeters } from "@/lib/rankings";
import { WEEKDAYS } from "@/lib/dates";
import { GEAR_LABEL, GEARS, INTENSITIES, INTENSITY_LABEL } from "@/lib/set";
import {
  EMPTY_TRAINING_FILTERS,
  GROUP_BY_LABEL,
  MONTH_LABEL,
  REST_VS_LABEL,
  SLOT_LABEL,
  annotateTrainingReps,
  filterTrainingReps,
  groupTrainingReps,
  isPlausibleRep,
  restRanges,
  statsOf,
  uniqueSorted,
  type TrainingFilters,
  type TrainingGroupBy,
  type TrainingRep,
} from "@/lib/training-context";
import {
  formTimeline,
  learnedPatterns,
  predictTrainingTargets,
  type FormBreak,
  type FormPoint,
  type LearnedEffect,
  type TrainingTarget,
} from "@/lib/training-prediction";
import { appTeam, asTrainingTargets, statePredictions } from "@/lib/ml/production";
import { useMlRoles } from "@/lib/ml/ml-config";
import { findSuspects, type Suspect } from "@/lib/ml/quality";
import type { Athlete, TimeLog, WellnessEntry, Workout } from "@/lib/types";
import type { RaceResult } from "@/lib/ml/backtest";
import { TrackRecordPanel } from "@/components/analise/track-record-panel";
import { useT } from "@/i18n/provider";

const INK = "#0b1d33";
const POOL = "#1668b8";
const GOOD = "#117a59";
const LANE = "#c03528";
const GRID = "#e3eaf1";
const MUTE = "#56697f";

const GROUP_OPTIONS: TrainingGroupBy[] = [
  "intensity",
  "restBucket",
  "slot",
  "setShape",
  "fromBlock",
  "shift",
  "trainedEarlier",
  "weekday",
  "gear",
  "loadBeforeBucket",
  "month",
];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function clock(seconds: number): string {
  return formatRaceClock(seconds);
}

function signedSeconds(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)} s`;
}

function modeDistance(rows: TrainingRep[]): number | null {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.distanceM, (counts.get(row.distanceM) ?? 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [distance, n] of counts) {
    if (n > bestN) {
      best = distance;
      bestN = n;
    }
  }
  return best;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-sm font-semibold text-mist">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Toggle({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        on ? "border-aqua bg-aqua text-white" : "border-line bg-panel text-mist hover:border-aqua"
      }`}
    >
      {children}
      {count != null ? <span className={`text-[11px] tabular ${on ? "text-white/70" : "text-mute"}`}>{count}</span> : null}
    </button>
  );
}

export function TreinoDashboard({
  athleteId,
  athletes,
  workouts,
  timeLogs,
  races = [],
  wellness,
  groupName,
  canReadLedger = false,
}: {
  athleteId: string;
  /** The whole team: the state model learns from teammates too. */
  athletes: Athlete[];
  workouts: Workout[];
  timeLogs: TimeLog[];
  /** Competition results and personal bests (the state model learns from races too). */
  races?: RaceResult[];
  wellness?: WellnessEntry[];
  groupName?: string;
  canReadLedger?: boolean;
}) {
  const t = useT();
  const allRows = useMemo(
    () => annotateTrainingReps(workouts, timeLogs, athleteId, wellness, groupName),
    [athleteId, groupName, timeLogs, wellness, workouts],
  );
  const plausible = useMemo(() => allRows.filter(isPlausibleRep), [allRows]);
  const invalid = useMemo(() => allRows.filter((row) => !isPlausibleRep(row)), [allRows]);
  // A 25 m and a 50 m pool are never compared: everything below (estimates, patterns, form) is per pool.
  const courseOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of plausible) counts.set(row.course || "", (counts.get(row.course || "") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  }, [plausible]);
  const [course, setCourse] = useState<string | null>(null);
  const activeCourse = course != null && courseOptions.includes(course) ? course : (courseOptions[0] ?? "");
  const rows = useMemo(() => plausible.filter((row) => (row.course || "") === activeCourse), [activeCourse, plausible]);
  const distances = useMemo(() => uniqueSorted(rows.map((row) => row.distanceM), (a, b) => a - b), [rows]);
  const [distance, setDistance] = useState<number | null>(() => modeDistance(rows));
  const activeDistance = distance != null && distances.includes(distance) ? distance : modeDistance(rows);
  const [filters, setFilters] = useState<TrainingFilters>(EMPTY_TRAINING_FILTERS);
  const [groupBy, setGroupBy] = useState<TrainingGroupBy>("intensity");
  const [moreFilters, setMoreFilters] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const { champion } = useMlRoles();
  const championEstimates = useMemo(
    () => (champion === "estado" ? asTrainingTargets(statePredictions(appTeam(athletes, workouts, timeLogs, [], races).team)) : null),
    [athletes, champion, races, timeLogs, workouts],
  );
  const predictions = useMemo(() => championEstimates ?? predictTrainingTargets(rows), [championEstimates, rows]);
  // Times that look like typing errors: shown to the coach, kept out of what the state model learns.
  const suspects = useMemo(() => findSuspects(allRows), [allRows]);
  const patterns = useMemo(() => learnedPatterns(rows), [rows]);
  const form = useMemo(() => formTimeline(rows), [rows]);
  const atDistance = useMemo(() => rows.filter((row) => row.distanceM === activeDistance), [activeDistance, rows]);
  const visible = useMemo(() => filterTrainingReps(atDistance, filters), [atDistance, filters]);
  const ranges = useMemo(() => restRanges(atDistance), [atDistance]);

  const presentIntensities = useMemo(
    () => INTENSITIES.filter((intensity) => atDistance.some((row) => row.intensity === intensity)),
    [atDistance],
  );
  const paired = useMemo(
    () =>
      visible
        .map((row) => ({ row, target: predictions.get(row.log.id) }))
        .filter((item): item is { row: TrainingRep; target: TrainingTarget } => Boolean(item.target)),
    [predictions, visible],
  );
  const real = statsOf(visible.map((row) => row.timeS));
  const estimated = statsOf(paired.map((item) => item.target.targetS));
  const pairedReal = statsOf(paired.map((item) => item.row.timeS));
  const delta = paired.length ? pairedReal.mean - estimated.mean : NaN;
  const beat = paired.filter((item) => item.row.timeS <= item.target.targetS).length;

  const activeFilterCount =
    filters.intensities.length +
    filters.restRanges.length +
    filters.courses.length +
    Object.entries(filters).reduce((count, [key, value]) => {
      if (["intensities", "restRanges", "courses", "distances"].includes(key)) return count;
      if (Array.isArray(value)) return count + (value.length ? 1 : 0);
      return count + (value ? 1 : 0);
    }, 0);

  function patch(next: Partial<TrainingFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPicked([]);
  }

  const exclusive =
    (key: "fromBlock" | "trainedEarlier" | "easierMiddle" | "mixedIntensity" | "mixedStroke") =>
    (value: TrainingFilters[typeof key]) =>
      patch({ [key]: filters[key] === value ? "" : value } as Partial<TrainingFilters>);

  const more = useMemo(
    () => ({
      setShapes: uniqueSorted(atDistance.map((row) => row.setShape)),
      months: uniqueSorted(atDistance.map((row) => row.month), (a, b) => a - b),
      loadBuckets: uniqueSorted(atDistance.map((row) => row.loadBeforeBucket)),
      weeklyBuckets: uniqueSorted(atDistance.map((row) => row.weeklyBucket)),
    }),
    [atDistance],
  );

  if (!plausible.length) {
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
        <p className="font-display text-2xl font-bold">{t("Ainda sem tempos de treino")}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mute">
          {t("Regista tempos numa série para ver aqui cada repetição, o tempo estimado e a distribuição.")}
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div className="min-w-0 space-y-5">
        {invalid.length ? (
          <div role="status" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#f3c6c0] bg-[#fdf1ef] px-4 py-3">
            <p className="text-sm text-mist">
              <span className="font-semibold text-coral">
                {invalid.length === 1 ? t("1 tempo ignorado") : t("{count} tempos ignorados", { count: invalid.length })}
              </span>{" "}
              {t("por ser impossível para a distância:")}{" "}
              {invalid
                .slice(0, 3)
                .map((row) =>
                  t("{time} em {distance} m ({date})", {
                    time: clock(row.timeS),
                    distance: row.distanceM,
                    date: formatDatePt(row.date).slice(0, 5),
                  }),
                )
                .join(", ")}
              {invalid.length > 3 ? "…" : ""}
            </p>
            <a href={`/coach/matrix/${invalid[0].workoutId}`} className="text-sm font-semibold text-pool hover:underline">
              {t("Corrigir tempos")}
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
          {courseOptions.length > 1 ? (
            <div role="group" aria-label={t("Piscina")} className="flex gap-1 rounded-xl border border-line bg-panel p-1">
              {courseOptions.map((value) => (
                <button
                  key={value || "none"}
                  type="button"
                  aria-pressed={value === activeCourse}
                  onClick={() => {
                    setCourse(value);
                    setDistance(null);
                    setFilters(EMPTY_TRAINING_FILTERS);
                    setPicked([]);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    value === activeCourse ? "bg-mist text-white" : "text-mute hover:text-mist"
                  }`}
                >
                  {value === "scm" || value === "lcm" ? COURSE_LABEL[value] : t("Piscina não indicada")}
                </button>
              ))}
            </div>
          ) : null}
          <div role="group" aria-label={t("Distância da repetição")} className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1">
            {distances.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === activeDistance}
                onClick={() => {
                  setDistance(value);
                  setFilters(EMPTY_TRAINING_FILTERS);
                  setPicked([]);
                }}
                className={`rounded-lg px-3.5 py-1.5 font-display text-lg font-bold tabular transition-colors ${
                  value === activeDistance ? "bg-aqua text-white" : "text-mute hover:text-mist"
                }`}
              >
                {value} m
              </button>
            ))}
          </div>
          </div>
          <p className="text-sm text-mute">
            {t("{shown} de {total} repetições de {distance} m", { shown: visible.length, total: atDistance.length, distance: activeDistance ?? "—" })}
          </p>
        </div>

        <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-panel lg:grid-cols-4" aria-label={t("Resumo")}>
          <Kpi label={t("Tempo médio real")} value={real.n ? clock(real.mean) : "—"} note={real.n ? t("melhor {time}", { time: clock(real.best) }) : ""} />
          <Kpi
            label={t("Tempo médio estimado")}
            value={estimated.n ? clock(estimated.mean) : "—"}
            note={estimated.n ? t("{count} reps com estimativa", { count: paired.length }) : t("sem histórico comparável")}
          />
          <Kpi
            label={t("Real face ao estimado")}
            value={Number.isFinite(delta) ? signedSeconds(delta) : "—"}
            tone={!Number.isFinite(delta) ? undefined : delta <= 0 ? "good" : "bad"}
            note={paired.length ? t("{beat} de {total} abaixo do estimado", { beat, total: paired.length }) : ""}
          />
          <Kpi
            label={t("Consistência")}
            value={real.n > 1 ? `±${real.sd.toFixed(2)} s` : "—"}
            note={real.n > 1 ? t("desvio entre repetições") : ""}
          />
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold">{t("Repetição a repetição")}</h2>
              <p className="text-sm text-mute">{t("Tempo real contra o estimado pelo histórico do atleta. Mais rápido fica em cima.")}</p>
            </div>
            <Legend
              items={[
                { swatch: <span className="h-2.5 w-2.5 rounded-full bg-good" />, label: t("Abaixo do estimado") },
                { swatch: <span className="h-2.5 w-2.5 rounded-full bg-coral" />, label: t("Acima do estimado") },
                { swatch: <span className="h-0.5 w-4 border-t-2 border-dashed border-pool" />, label: t("Estimado") },
              ]}
            />
          </header>
          <RepTimeline items={visible.slice(-60)} predictions={predictions} />
        </section>

        {/* Model reliability stays behind "Como se calculou" (ADR 0004): the coach reads swimming, not the model. */}
        <details className="rounded-2xl border border-line bg-panel p-5">
          <summary className="cursor-pointer text-sm font-semibold text-mist">{t("Como se calculou: fiabilidade das estimativas")}</summary>
          <div className="mt-3">
            <TrackRecordPanel athleteId={athleteId} athletes={athletes} workouts={workouts} timeLogs={timeLogs} races={races} canReadLedger={canReadLedger} />
          </div>
        </details>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold">{t("Distribuição dos tempos")}</h2>
              <p className="text-sm text-mute">{t("Onde se concentram os tempos reais e os estimados. Passa o cursor para ler cada ponto.")}</p>
            </div>
            <Legend
              items={[
                { swatch: <span className="h-0.5 w-5 bg-[#4f46c8]" />, label: t("Real") },
                { swatch: <span className="h-0.5 w-5 border-t-2 border-dashed border-pool" />, label: t("Estimado") },
                { swatch: <span className="h-3 w-0.5 bg-[#2fae4a]" />, label: t("Referências") },
              ]}
            />
          </header>
          <DensityChart real={visible.map((row) => row.timeS)} estimated={paired.map((item) => item.target.targetS)} />
        </section>

        <div className="grid gap-5 2xl:grid-cols-2">
          <LearnedPanel effects={patterns.effects} n={patterns.n} />
          <FormPanel points={form.points} breaks={form.breaks} />
        </div>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">{t("Onde nada mais rápido")}</h2>
              <p className="text-sm text-mute">{t("Tempo médio por contexto, do mais rápido para o mais lento.")}</p>
            </div>
            <label className="text-sm text-mute">
              <span className="sr-only">{t("Agrupar por")}</span>
              <select className="field min-h-10 py-1.5" value={groupBy} onChange={(event) => setGroupBy(event.target.value as TrainingGroupBy)}>
                {GROUP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t("Por {group}", { group: GROUP_BY_LABEL[option].toLowerCase() })}
                  </option>
                ))}
              </select>
            </label>
          </header>
          <GroupBars rows={visible} groupBy={groupBy} />
        </section>

        <RepTable rows={visible} predictions={predictions} suspects={suspects} picked={picked} setPicked={setPicked} />
      </div>

      <aside className="rounded-2xl border border-line bg-panel p-5 xl:sticky xl:top-6" aria-label={t("Filtros")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{t("Filtros")}</h2>
          {activeFilterCount ? (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_TRAINING_FILTERS);
                setPicked([]);
              }}
              className="text-sm font-semibold text-pool hover:underline"
            >
              {t("Limpar ({count})", { count: activeFilterCount })}
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          <FilterGroup title={t("Intensidade")}>
            {presentIntensities.map((intensity) => (
              <Toggle
                key={intensity}
                on={filters.intensities.includes(intensity)}
                onClick={() => patch({ intensities: toggleValue(filters.intensities, intensity) })}
                count={atDistance.filter((row) => row.intensity === intensity).length}
              >
                {INTENSITY_LABEL[intensity]}
              </Toggle>
            ))}
          </FilterGroup>

          <FilterGroup title={t("Descanso (saída)")}>
            {ranges.map((range) => (
              <Toggle
                key={range.key}
                on={filters.restRanges.includes(range.key)}
                onClick={() => patch({ restRanges: toggleValue(filters.restRanges, range.key) })}
                count={range.count}
              >
                {range.label}
              </Toggle>
            ))}
          </FilterGroup>

          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setMoreFilters((value) => !value)}
              aria-expanded={moreFilters}
              className="flex w-full items-center justify-between text-sm font-semibold text-mist"
            >
              {t("Mais filtros")}
              <span aria-hidden="true" className={`transition-transform ${moreFilters ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
          </div>

          {moreFilters ? (
            <div className="space-y-4">
              <FilterGroup title={t("Posição na série")}>
                {(["first", "middle", "last"] as const).map((slot) => (
                  <Toggle key={slot} on={filters.slots.includes(slot)} onClick={() => patch({ slots: toggleValue(filters.slots, slot) })}>
                    {SLOT_LABEL[slot]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Série")}>
                {more.setShapes.map((shape) => (
                  <Toggle key={shape} on={filters.setShapes.includes(shape)} onClick={() => patch({ setShapes: toggleValue(filters.setShapes, shape) })}>
                    {shape}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Partida")}>
                <Toggle on={filters.fromBlock === "below"} onClick={() => exclusive("fromBlock")("below")}>
                  {t("De baixo")}
                </Toggle>
                <Toggle on={filters.fromBlock === "block"} onClick={() => exclusive("fromBlock")("block")}>
                  {t("Bloco")}
                </Toggle>
              </FilterGroup>
              <FilterGroup title={t("Treino do dia")}>
                <Toggle on={filters.trainedEarlier === "no"} onClick={() => exclusive("trainedEarlier")("no")}>
                  {t("1.º treino")}
                </Toggle>
                <Toggle on={filters.trainedEarlier === "yes"} onClick={() => exclusive("trainedEarlier")("yes")}>
                  {t("2.º treino")}
                </Toggle>
                {(["morning", "afternoon"] as const).map((shift) => (
                  <Toggle key={shift} on={filters.shifts.includes(shift)} onClick={() => patch({ shifts: toggleValue(filters.shifts, shift) })}>
                    {SHIFT_LABEL[shift]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Estilo")}>
                {Object.entries(STROKE_LABEL).map(([stroke, label]) => (
                  <Toggle
                    key={stroke}
                    on={filters.strokes.includes(stroke as keyof typeof STROKE_LABEL)}
                    onClick={() => patch({ strokes: toggleValue(filters.strokes, stroke as keyof typeof STROKE_LABEL) })}
                  >
                    {label}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Material")}>
                <Toggle on={filters.gears.includes("none")} onClick={() => patch({ gears: toggleValue(filters.gears, "none") })}>
                  {t("Sem material")}
                </Toggle>
                {GEARS.map((gear) => (
                  <Toggle key={gear} on={filters.gears.includes(gear)} onClick={() => patch({ gears: toggleValue(filters.gears, gear) })}>
                    {GEAR_LABEL[gear]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Carga antes da repetição")}>
                {more.loadBuckets.map((bucket) => (
                  <Toggle key={bucket} on={filters.loadBuckets.includes(bucket)} onClick={() => patch({ loadBuckets: toggleValue(filters.loadBuckets, bucket) })}>
                    {bucket}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Carga semanal")}>
                {more.weeklyBuckets.map((bucket) => (
                  <Toggle key={bucket} on={filters.weeklyBuckets.includes(bucket)} onClick={() => patch({ weeklyBuckets: toggleValue(filters.weeklyBuckets, bucket) })}>
                    {bucket}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Bloco|tipo")}>
                {(["warmup", "main", "recovery"] as const).map((type) => (
                  <Toggle key={type} on={filters.blockTypes.includes(type)} onClick={() => patch({ blockTypes: toggleValue(filters.blockTypes, type) })}>
                    {BLOCK_LABEL[type]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Dia da semana")}>
                {WEEKDAYS.map((label, index) => (
                  <Toggle key={label} on={filters.weekdays.includes(index)} onClick={() => patch({ weekdays: toggleValue(filters.weekdays, index) })}>
                    {label}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Mês")}>
                {more.months.map((month) => (
                  <Toggle key={month} on={filters.months.includes(month)} onClick={() => patch({ months: toggleValue(filters.months, month) })}>
                    {MONTH_LABEL[month - 1]}
                  </Toggle>
                ))}
              </FilterGroup>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="border-b border-r border-line px-5 py-4 last:border-r-0 lg:border-b-0 [&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r">
      <p className="text-sm text-mute">{label}</p>
      <p
        className={`mt-1 font-display text-[2.1rem] font-bold leading-none tabular ${
          tone === "good" ? "text-good" : tone === "bad" ? "text-coral" : "text-mist"
        }`}
      >
        {value}
      </p>
      {note ? <p className="mt-1.5 text-xs text-mute">{note}</p> : null}
    </div>
  );
}

function Legend({ items }: { items: { swatch: React.ReactNode; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.swatch}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= hi + 1e-9; value += step) ticks.push(Number(value.toFixed(4)));
  return ticks;
}

function RepTimeline({ items, predictions }: { items: TrainingRep[]; predictions: Map<string, TrainingTarget> }) {
  const t = useT();
  if (!items.length) return <EmptyChart text={t("Nenhuma repetição com estes filtros.")} />;
  const width = 820;
  const height = 300;
  const pad = { l: 64, r: 16, t: 16, b: 40 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const targets = items.map((row) => predictions.get(row.log.id));
  const values = [
    ...items.map((row) => row.timeS),
    ...targets.flatMap((target) => (target ? [target.lowS, target.highS] : [])),
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = Math.max(0.2, (max - min) * 0.1);
  const lo = min - margin;
  const hi = max + margin;
  const x = (i: number) => (items.length === 1 ? pad.l + innerW / 2 : pad.l + (i / (items.length - 1)) * innerW);
  const y = (t: number) => pad.t + ((t - lo) / (hi - lo)) * innerH;

  const segments: string[] = [];
  let current = "";
  const band: { upper: string[]; lower: string[] }[] = [];
  let open: { upper: string[]; lower: string[] } | null = null;
  targets.forEach((target, i) => {
    if (target) {
      current += `${current ? "L" : "M"}${x(i).toFixed(1)} ${y(target.targetS).toFixed(1)} `;
      if (!open) {
        open = { upper: [], lower: [] };
        band.push(open);
      }
      open.upper.push(`${x(i).toFixed(1)} ${y(target.lowS).toFixed(1)}`);
      open.lower.push(`${x(i).toFixed(1)} ${y(target.highS).toFixed(1)}`);
    } else {
      if (current) segments.push(current);
      current = "";
      open = null;
    }
  });
  if (current) segments.push(current);

  const dateTicks = items
    .map((row, i) => ({ i, date: row.date }))
    .filter((item, idx, all) => idx === 0 || item.date !== all[idx - 1].date);
  const shownDates = dateTicks.filter((_, idx) => idx % Math.ceil(dateTicks.length / 6 || 1) === 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={t("Tempo real e estimado por repetição")}>
      {niceTicks(lo, hi).map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke={GRID} />
          <text x={pad.l - 10} y={y(tick) + 4} textAnchor="end" fill={MUTE} fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
            {clock(tick)}
          </text>
        </g>
      ))}
      {dateTicks.slice(1).map((tick) => (
        <line key={`sep-${tick.i}`} x1={x(tick.i) - innerW / Math.max(items.length - 1, 1) / 2} x2={x(tick.i) - innerW / Math.max(items.length - 1, 1) / 2} y1={pad.t} y2={height - pad.b} stroke={GRID} strokeDasharray="2 4" />
      ))}
      {band.map((part, idx) => (
        <polygon key={`band-${idx}`} points={[...part.upper, ...part.lower.reverse()].join(" ")} fill={POOL} opacity={0.1} />
      ))}
      {segments.map((d, idx) => (
        <path key={`est-${idx}`} d={d} fill="none" stroke={POOL} strokeWidth={2} strokeDasharray="6 5" />
      ))}
      {items.map((row, i) => {
        const target = targets[i];
        const faster = target ? row.timeS <= target.targetS : null;
        return (
          <circle
            key={row.log.id}
            cx={x(i)}
            cy={y(row.timeS)}
            r={4.5}
            fill={faster == null ? INK : faster ? GOOD : LANE}
            stroke="#fff"
            strokeWidth={1.5}
          >
            <title>
              {`${formatDatePt(row.date)} · ${row.setShape} ${t("rep {n}/{total}", { n: row.repInSegment, total: row.segmentReps })}\n${t("Real {time}", { time: clock(row.timeS) })}${
                target
                  ? ` · ${t("estimado {time}", { time: clock(target.targetS) })} (${signedSeconds(row.timeS - target.targetS)})`
                  : ` · ${t("sem estimativa")}`
              }`}
            </title>
          </circle>
        );
      })}
      {shownDates.map((tick) => (
        <text key={`d-${tick.i}`} x={x(tick.i)} y={height - 14} textAnchor="middle" fill={MUTE} fontSize="12">
          {formatDatePt(tick.date).slice(0, 5)}
        </text>
      ))}
    </svg>
  );
}

const SPECTRUM_LINE = "#4f46c8";
const MARKER = "#2fae4a";

function gaussianDensity(values: number[], bandwidth: number) {
  const norm = 1 / (values.length * bandwidth * Math.sqrt(2 * Math.PI));
  return (x: number) => values.reduce((sum, v) => sum + Math.exp(-0.5 * ((x - v) / bandwidth) ** 2), 0) * norm;
}

function silverman(values: number[]): number {
  const s = statsOf(values);
  return Math.max(0.12, 1.06 * (s.sd || 0.3) * Math.pow(values.length, -0.2));
}

function DensityChart({ real, estimated }: { real: number[]; estimated: number[] }) {
  const t = useT();
  const [cursor, setCursor] = useState<number | null>(null);
  if (!real.length) return <EmptyChart text={t("Nenhuma repetição com estes filtros.")} />;

  const width = 860;
  const height = 360;
  const pad = { l: 58, r: 20, t: 22, b: 40 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const h = silverman(real);
  const all = [...real, ...estimated];
  const lo = Math.min(...all) - 3 * h;
  const hi = Math.max(...all) + 3 * h;
  // Density per 0.1 s: "how many reps land in a tenth of a second around this time".
  const scale = 0.1;
  const realFn = gaussianDensity(real, h);
  const estFn = estimated.length ? gaussianDensity(estimated, silverman(estimated)) : null;
  const samples = 220;
  const xs = Array.from({ length: samples + 1 }, (_, i) => lo + ((hi - lo) * i) / samples);
  const realY = xs.map((x) => realFn(x) * real.length * scale);
  const estY = estFn ? xs.map((x) => estFn(x) * estimated.length * scale) : [];
  const top = Math.max(...realY, ...estY) * 1.12 || 1;

  const px = (t: number) => pad.l + ((t - lo) / (hi - lo)) * innerW;
  const py = (v: number) => pad.t + innerH - (v / top) * innerH;
  const path = (ys: number[]) => ys.map((v, i) => `${i ? "L" : "M"}${px(xs[i]).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");

  const realStats = statsOf(real);
  const estStats = statsOf(estimated);
  const markers = [
    { t: realStats.best, label: t("melhor") },
    { t: realStats.mean, label: t("média real") },
    ...(estimated.length ? [{ t: estStats.mean, label: t("média estimada") }] : []),
  ];

  const xTicks = niceTicks(lo, hi, 8);
  const yTicks = niceTicks(0, top, 6);
  const cursorT = cursor ?? realStats.mean;
  const readReal = realFn(cursorT) * real.length * scale;
  const readEst = estFn ? estFn(cursorT) * estimated.length * scale : null;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    if (x < pad.l || x > width - pad.r) return;
    setCursor(lo + ((x - pad.l) / innerW) * (hi - lo));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel-2 px-3 py-2 text-xs text-mute">
        <Readout label={t("Tempo")} value={clock(cursorT)} />
        <Readout label={t("Real")} value={readReal.toFixed(2)} />
        {readEst != null ? <Readout label={t("Estimado")} value={readEst.toFixed(2)} /> : null}
        <span>{t("reps por 0,1 s")}</span>
        <span className="ml-auto font-semibold text-mist tabular">
          {t("TOT {count} reps", { count: real.length })}
          {estimated.length ? ` · ${t("{count} estimadas", { count: estimated.length })}` : ""}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-none bg-white"
        role="img"
        aria-label={t("Curva de distribuição dos tempos reais e estimados")}
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
      >
        {yTicks.map((tick) => (
          <g key={`y${tick}`}>
            <line x1={pad.l} x2={width - pad.r} y1={py(tick)} y2={py(tick)} stroke="#eef1f5" />
            <text x={pad.l - 8} y={py(tick) + 4} textAnchor="end" fill={MUTE} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
              {tick.toFixed(tick < 1 ? 2 : 1)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x${tick}`}>
            <line x1={px(tick)} x2={px(tick)} y1={pad.t} y2={pad.t + innerH} stroke="#eef1f5" />
            <text x={px(tick)} y={height - 16} textAnchor="middle" fill={MUTE} fontSize="11" style={{ fontVariantNumeric: "tabular-nums" }}>
              {clock(tick)}
            </text>
          </g>
        ))}
        <rect x={pad.l} y={pad.t} width={innerW} height={innerH} fill="none" stroke="#c9d3de" />
        {[...markers]
          .sort((a, b) => a.t - b.t)
          .map((marker, index) => {
            const x = px(marker.t);
            const nearRight = x > width - pad.r - 150;
            return (
              <g key={marker.label}>
                <line x1={x} x2={x} y1={pad.t} y2={pad.t + innerH} stroke={MARKER} strokeWidth={1.2} />
                <text
                  x={nearRight ? x - 5 : x + 5}
                  y={pad.t + 14 + index * 15}
                  textAnchor={nearRight ? "end" : "start"}
                  fill={MARKER}
                  fontSize="11"
                  paintOrder="stroke"
                  stroke="#fff"
                  strokeWidth={3}
                >
                  {marker.label} {clock(marker.t)}
                </text>
              </g>
            );
          })}
        {estY.length ? <path d={path(estY)} fill="none" stroke={POOL} strokeWidth={1.4} strokeDasharray="5 4" /> : null}
        <path d={path(realY)} fill="none" stroke={SPECTRUM_LINE} strokeWidth={1.6} />
        {cursor != null ? (
          <g pointerEvents="none">
            <line x1={px(cursor)} x2={px(cursor)} y1={pad.t} y2={pad.t + innerH} stroke="#8a97a8" strokeDasharray="3 3" />
            <circle cx={px(cursor)} cy={py(readReal)} r={3.5} fill={SPECTRUM_LINE} />
            {readEst != null ? <circle cx={px(cursor)} cy={py(readEst)} r={3.5} fill={POOL} /> : null}
          </g>
        ) : null}
        <text x={width - pad.r} y={height - 2} textAnchor="end" fill={MUTE} fontSize="11">
          {t("tempo")}
        </text>
      </svg>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <span className="min-w-16 rounded border border-line-strong bg-white px-1.5 py-0.5 font-semibold text-mist tabular">{value}</span>
    </span>
  );
}

function GroupBars({ rows, groupBy }: { rows: TrainingRep[]; groupBy: TrainingGroupBy }) {
  const t = useT();
  const groups = groupTrainingReps(rows, groupBy).map((group) => ({
    label: group.label,
    stats: statsOf(group.rows.map((row) => row.timeS)),
  }));
  if (!groups.length) return <EmptyChart text={t("Nenhuma repetição com estes filtros.")} />;
  const fastest = Math.min(...groups.map((group) => group.stats.mean));
  const slowest = Math.max(...groups.map((group) => group.stats.mean));
  const span = Math.max(slowest - fastest, 0.01);
  return (
    <ol className="space-y-2">
      {groups.map((group, index) => {
        const gap = group.stats.mean - fastest;
        const pct = 22 + (1 - gap / span) * 78;
        return (
          <li key={group.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3">
            <span className="truncate text-sm font-medium text-mist" title={group.label}>
              {group.label}
            </span>
            <span className="relative h-7 overflow-hidden rounded-md bg-panel-2">
              <span
                className={`absolute inset-y-0 left-0 rounded-md ${index === 0 ? "bg-aqua" : "bg-[#9fb6cf]"}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-32 text-right text-sm">
              <span className="font-display text-lg font-bold tabular text-mist">{clock(group.stats.mean)}</span>
              <span className="ml-1.5 text-xs text-mute">
                {index === 0 ? t("{count} reps", { count: group.stats.n }) : `+${gap.toFixed(2)}`}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-mute">{text}</p>;
}

function RepTable({
  rows,
  predictions,
  suspects,
  picked,
  setPicked,
}: {
  rows: TrainingRep[];
  predictions: Map<string, TrainingTarget>;
  suspects: Map<string, Suspect>;
  picked: string[];
  setPicked: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const t = useT();
  const a = rows.find((row) => row.log.id === picked[0]);
  const b = rows.find((row) => row.log.id === picked[1]);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-2xl font-bold">{t("Repetições")}</h2>
          <p className="text-sm text-mute">{t("Seleciona duas linhas para as comparar.")}</p>
        </div>
        {a && b ? (
          <p className="text-sm">
            <span className="font-display text-lg font-bold tabular">{clock(a.timeS)}</span>
            <span className="mx-2 text-mute">→</span>
            <span className="font-display text-lg font-bold tabular">{clock(b.timeS)}</span>
            <span className={`ml-2 font-semibold ${b.timeS - a.timeS <= 0 ? "text-good" : "text-coral"}`}>
              {signedSeconds(b.timeS - a.timeS)}
            </span>
          </p>
        ) : null}
      </header>
      <div className="max-h-[520px] overflow-auto" tabIndex={0} role="region" aria-label={t("Repetições")}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-panel-2 text-xs font-semibold text-mute">
            <tr>
              <th className="px-5 py-2.5">{t("Data")}</th>
              <th className="px-3 py-2.5">{t("Série")}</th>
              <th className="px-3 py-2.5">{t("Rep")}</th>
              <th className="px-3 py-2.5 text-right">{t("Real")}</th>
              <th className="px-3 py-2.5 text-right">{t("Estimado")}</th>
              <th className="px-3 py-2.5 text-right">{t("Dif.")}</th>
              <th className="px-3 py-2.5">{t("Intensidade")}</th>
              <th className="px-3 py-2.5">{t("Saída")}</th>
              <th className="px-3 py-2.5">{t("Antes")}</th>
              <th className="px-3 py-2.5">{t("Semana")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-mute">
                  {t("Nenhuma repetição com estes filtros.")}
                </td>
              </tr>
            ) : (
              rows
                .slice()
                .reverse()
                .slice(0, 120)
                .map((row) => {
                  const target = predictions.get(row.log.id);
                  const diff = target ? row.timeS - target.targetS : null;
                  const on = picked.includes(row.log.id);
                  return (
                    <tr
                      key={row.log.id}
                      aria-selected={on}
                      onClick={() =>
                        setPicked((current) => {
                          if (current.includes(row.log.id)) return current.filter((id) => id !== row.log.id);
                          if (current.length >= 2) return [current[1], row.log.id];
                          return [...current, row.log.id];
                        })
                      }
                      className={`cursor-pointer border-t border-line ${on ? "bg-aqua-soft" : "hover:bg-panel-2"}`}
                    >
                      <td className="whitespace-nowrap px-5 py-2.5">
                        {formatDatePt(row.date)}
                        <span className="block text-xs text-mute">
                          {row.weekdayLabel} · {SHIFT_LABEL[row.shift]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.setShape}
                        <span className="block text-xs text-mute">
                          {row.fromBlock ? t("Bloco") : t("De baixo")}
                          {row.gearLabel ? ` · ${row.gearLabel}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular">
                        {row.round > 1 ? `S${row.round} · ` : ""}
                        {row.repInSegment}/{row.segmentReps}
                      </td>
                      <td className="px-3 py-2.5 text-right font-display text-lg font-bold tabular text-mist">
                        {clock(row.timeS)}
                        {suspects.has(row.log.id) ? <SuspectNote suspect={suspects.get(row.log.id)!} /> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-sand">
                        {target ? clock(target.targetS) : "—"}
                        {target ? <span className="block text-[11px] text-mute">{t("confiança {level}", { level: t(target.confidence) })}</span> : null}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold tabular ${
                          diff == null ? "text-mute" : diff <= 0 ? "text-good" : "text-coral"
                        }`}
                      >
                        {diff == null ? "—" : signedSeconds(diff)}
                      </td>
                      <td className="px-3 py-2.5">{INTENSITY_LABEL[row.intensity]}</td>
                      <td className="px-3 py-2.5">
                        {row.restLabel}
                        <span className="block text-xs text-mute">{REST_VS_LABEL[row.restVsSet]}</span>
                      </td>
                      <td className="px-3 py-2.5">{formatMeters(row.loadBeforeM)}</td>
                      <td className="px-3 py-2.5">{formatMeters(row.weeklyLoadM)}</td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const SUSPECT_REASON: Record<Suspect["reason"], "Parece +/− 1 minuto" | "Parece dígitos trocados" | "Parece um parcial" | "Parece o tempo de outro atleta" | "Muito longe das outras reps"> = {
  minute: "Parece +/− 1 minuto",
  digits: "Parece dígitos trocados",
  split: "Parece um parcial",
  swap: "Parece o tempo de outro atleta",
  outlier: "Muito longe das outras reps",
};

function SuspectNote({ suspect }: { suspect: Suspect }) {
  const t = useT();
  const hint = suspect.suggestedS != null ? t("{reason}: talvez {time}?", { reason: t(SUSPECT_REASON[suspect.reason]), time: clock(suspect.suggestedS) }) : t(SUSPECT_REASON[suspect.reason]);
  return (
    <span className="block text-[11px] font-semibold text-coral" title={t("{hint} O modelo não aprende com este tempo até ser corrigido.", { hint })}>
      {t("suspeito")}
    </span>
  );
}

function LearnedPanel({ effects, n }: { effects: LearnedEffect[]; n: number }) {
  const t = useT();
  const shown = [...effects].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 12);
  const scale = Math.max(1, ...shown.map((effect) => Math.abs(effect.pct)));
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-bold">{t("O que o modelo aprendeu")}</h2>
      <p className="text-sm text-mute">
        {t("Efeitos estimados só com os tempos deste atleta ({count} repetições comparáveis). Com poucos dados ficam perto de zero.", { count: n })}
      </p>
      {shown.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">
          {t("Ainda não há repetições suficientes em condições diferentes para aprender padrões.")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((effect) => {
            const faster = effect.pct < 0;
            const width = (Math.abs(effect.pct) / scale) * 50;
            return (
              <li key={effect.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)_4.5rem] items-center gap-3">
                <span className="text-sm text-mist">
                  {effect.label}
                  <span className="block text-xs text-mute">{t("{count} reps", { count: effect.support })}</span>
                </span>
                <span className="relative h-5 rounded bg-panel-2">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden="true" />
                  <span
                    className={`absolute inset-y-0.5 rounded ${faster ? "bg-good" : "bg-coral"}`}
                    style={faster ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }}
                  />
                </span>
                <span className={`text-right text-sm font-semibold tabular ${faster ? "text-good" : "text-coral"}`}>
                  {effect.pct > 0 ? "+" : "−"}
                  {Math.abs(effect.pct).toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-mute">{t("Verde: tempos mais rápidos nessa condição. Vermelho: mais lentos.")}</p>
    </section>
  );
}

function FormPanel({ points, breaks }: { points: FormPoint[]; breaks: FormBreak[] }) {
  const t = useT();
  if (points.length < 2) {
    return (
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl font-bold">{t("Forma ao longo do tempo")}</h2>
        <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">
          {t("Aparece a partir de duas semanas com repetições comparáveis.")}
        </p>
      </section>
    );
  }
  const width = 620;
  const height = 240;
  const pad = { l: 52, r: 16, t: 16, b: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const values = points.map((p) => p.indexPct);
  const lim = Math.max(1, ...values.map((v) => Math.abs(v))) * 1.2;
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * innerW;
  // Faster (negative index) is drawn higher.
  const y = (v: number) => pad.t + ((v + lim) / (2 * lim)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.indexPct).toFixed(1)}`).join(" ");
  const breakIndex = (iso: string) => points.findIndex((p) => p.week >= weekStartMondayLocal(iso));

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-bold">{t("Forma ao longo do tempo")}</h2>
      <p className="text-sm text-mute">{t("Tempo semanal face ao habitual do atleta, nas mesmas séries. Mais rápido fica em cima.")}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={t("Índice de forma semanal")}>
        {[-lim / 1.2, 0, lim / 1.2].map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#bccad8" : GRID} />
            <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" fill={MUTE} fontSize="11">
              {tick > 0 ? "+" : ""}
              {tick.toFixed(1)}%
            </text>
          </g>
        ))}
        {breaks.map((item) => {
          const i = breakIndex(item.to);
          if (i < 0) return null;
          return (
            <g key={item.to}>
              <line x1={x(i)} x2={x(i)} y1={pad.t} y2={pad.t + innerH} stroke={LANE} strokeDasharray="4 4" />
              <text x={x(i) + 4} y={pad.t + 12} fill={LANE} fontSize="11">
                {t("após {days} dias parado", { days: item.days })}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={POOL} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={p.week} cx={x(i)} cy={y(p.indexPct)} r={3.5} fill={p.indexPct <= 0 ? GOOD : LANE}>
            <title>{`${t("Semana de {date}", { date: formatDatePt(p.week) })} · ${p.indexPct > 0 ? "+" : ""}${p.indexPct.toFixed(1)}% · ${t("{count} reps", { count: p.n })}`}</title>
          </circle>
        ))}
        <text x={x(0)} y={height - 12} textAnchor="start" fill={MUTE} fontSize="11">
          {formatDatePt(points[0].week).slice(0, 5)}
        </text>
        <text x={x(points.length - 1)} y={height - 12} textAnchor="end" fill={MUTE} fontSize="11">
          {formatDatePt(points[points.length - 1].week).slice(0, 5)}
        </text>
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-mute">{t("Ver em tabela")}</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="font-medium">{t("Semana")}</th>
              <th scope="col" className="font-medium">{t("Forma vs. habitual")}</th>
              <th scope="col" className="font-medium">{t("Repetições")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.week}>
                <td>{formatDatePt(point.week)}</td>
                <td>{point.indexPct > 0 ? "+" : ""}{point.indexPct.toFixed(1)}%</td>
                <td>{point.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {breaks.length ? (
        <ul className="mt-2 space-y-1 text-sm text-mist">
          {breaks.map((item) => (
            <li key={item.to}>
              {t("Paragem de {days} dias ({from} → {to}):", {
                days: item.days,
                from: formatDatePt(item.from).slice(0, 5),
                to: formatDatePt(item.to).slice(0, 5),
              })}{" "}
              {item.recoveryWeeks == null
                ? t("ainda não voltou ao nível anterior.")
                : item.recoveryWeeks === 0
                  ? t("voltou ao nível anterior na primeira semana.")
                  : t("voltou ao nível anterior em {weeks} semanas.", { weeks: item.recoveryWeeks })}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function weekStartMondayLocal(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}
