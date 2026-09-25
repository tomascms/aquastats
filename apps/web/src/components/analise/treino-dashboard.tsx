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
  type FatigueBand,
  type TrainingFilters,
  type TrainingGroupBy,
  type TrainingRep,
} from "@/lib/training-context";
import { predictTrainingTargets, type TrainingTarget } from "@/lib/training-prediction";
import type { TimeLog, WellnessEntry, Workout } from "@/lib/types";

const INK = "#0b1d33";
const NAVY = "#0b2545";
const POOL = "#1668b8";
const GOOD = "#138a64";
const LANE = "#c93a2e";
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
  "fatigueBand",
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
  workouts,
  timeLogs,
  teamRows,
  wellness,
}: {
  athleteId: string;
  workouts: Workout[];
  timeLogs: TimeLog[];
  teamRows?: TrainingRep[];
  wellness?: WellnessEntry[];
}) {
  const allRows = useMemo(
    () => annotateTrainingReps(workouts, timeLogs, athleteId, wellness),
    [athleteId, timeLogs, wellness, workouts],
  );
  const rows = useMemo(() => allRows.filter(isPlausibleRep), [allRows]);
  const invalid = useMemo(() => allRows.filter((row) => !isPlausibleRep(row)), [allRows]);
  const distances = useMemo(() => uniqueSorted(rows.map((row) => row.distanceM), (a, b) => a - b), [rows]);
  const [distance, setDistance] = useState<number | null>(() => modeDistance(rows));
  const activeDistance = distance != null && distances.includes(distance) ? distance : modeDistance(rows);
  const [filters, setFilters] = useState<TrainingFilters>(EMPTY_TRAINING_FILTERS);
  const [groupBy, setGroupBy] = useState<TrainingGroupBy>("intensity");
  const [moreFilters, setMoreFilters] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const predictions = useMemo(() => predictTrainingTargets(rows, teamRows ?? rows), [rows, teamRows]);
  const atDistance = useMemo(() => rows.filter((row) => row.distanceM === activeDistance), [activeDistance, rows]);
  const visible = useMemo(() => filterTrainingReps(atDistance, filters), [atDistance, filters]);
  const ranges = useMemo(() => restRanges(atDistance), [atDistance]);

  const presentIntensities = useMemo(
    () => INTENSITIES.filter((intensity) => atDistance.some((row) => row.intensity === intensity)),
    [atDistance],
  );
  const presentCourses = useMemo(
    () => (["scm", "lcm"] as const).filter((course) => atDistance.some((row) => row.course === course)),
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
      fatigueBands: uniqueSorted(atDistance.map((row) => row.fatigueBand)) as FatigueBand[],
    }),
    [atDistance],
  );

  if (!rows.length) {
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
        <p className="font-display text-2xl font-bold">Ainda sem tempos de treino</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mute">
          Regista tempos numa série para ver aqui cada repetição, o tempo estimado e a distribuição.
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
                {invalid.length === 1 ? "1 tempo ignorado" : `${invalid.length} tempos ignorados`}
              </span>{" "}
              por ser impossível para a distância:{" "}
              {invalid
                .slice(0, 3)
                .map((row) => `${clock(row.timeS)} em ${row.distanceM} m (${formatDatePt(row.date).slice(0, 5)})`)
                .join(", ")}
              {invalid.length > 3 ? "…" : ""}
            </p>
            <a href={`/coach/matrix/${invalid[0].workoutId}`} className="text-sm font-semibold text-pool hover:underline">
              Corrigir tempos
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Distância da repetição" className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1">
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
          <p className="text-sm text-mute">
            {visible.length} de {atDistance.length} repetições de {activeDistance} m
          </p>
        </div>

        <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-panel lg:grid-cols-4" aria-label="Resumo">
          <Kpi label="Tempo médio real" value={real.n ? clock(real.mean) : "—"} note={real.n ? `melhor ${clock(real.best)}` : ""} />
          <Kpi
            label="Tempo médio estimado"
            value={estimated.n ? clock(estimated.mean) : "—"}
            note={estimated.n ? `${paired.length} reps com estimativa` : "sem histórico comparável"}
          />
          <Kpi
            label="Real face ao estimado"
            value={Number.isFinite(delta) ? signedSeconds(delta) : "—"}
            tone={!Number.isFinite(delta) ? undefined : delta <= 0 ? "good" : "bad"}
            note={paired.length ? `${beat} de ${paired.length} abaixo do estimado` : ""}
          />
          <Kpi
            label="Consistência"
            value={real.n > 1 ? `±${real.sd.toFixed(2)} s` : "—"}
            note={real.n > 1 ? "desvio entre repetições" : ""}
          />
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display text-2xl font-bold">Repetição a repetição</h3>
              <p className="text-sm text-mute">Tempo real contra o estimado pelo histórico do atleta. Mais rápido fica em cima.</p>
            </div>
            <Legend
              items={[
                { swatch: <span className="h-2.5 w-2.5 rounded-full bg-good" />, label: "Abaixo do estimado" },
                { swatch: <span className="h-2.5 w-2.5 rounded-full bg-coral" />, label: "Acima do estimado" },
                { swatch: <span className="h-0.5 w-4 border-t-2 border-dashed border-pool" />, label: "Estimado" },
              ]}
            />
          </header>
          <RepTimeline items={visible.slice(-60)} predictions={predictions} />
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display text-2xl font-bold">Distribuição dos tempos</h3>
              <p className="text-sm text-mute">Quantas repetições caíram em cada faixa de tempo, real e estimado.</p>
            </div>
            <Legend
              items={[
                { swatch: <span className="h-2.5 w-2.5 rounded-sm bg-aqua" />, label: "Real" },
                { swatch: <span className="h-2.5 w-2.5 rounded-sm border-2 border-pool bg-pool-soft" />, label: "Estimado" },
              ]}
            />
          </header>
          <Histogram real={visible.map((row) => row.timeS)} estimated={paired.map((item) => item.target.targetS)} />
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold">Onde nada mais rápido</h3>
              <p className="text-sm text-mute">Tempo médio por contexto, do mais rápido para o mais lento.</p>
            </div>
            <label className="text-sm text-mute">
              <span className="sr-only">Agrupar por</span>
              <select className="field min-h-10 py-1.5" value={groupBy} onChange={(event) => setGroupBy(event.target.value as TrainingGroupBy)}>
                {GROUP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Por {GROUP_BY_LABEL[option].toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </header>
          <GroupBars rows={visible} groupBy={groupBy} />
        </section>

        <RepTable rows={visible} predictions={predictions} picked={picked} setPicked={setPicked} />
      </div>

      <aside className="rounded-2xl border border-line bg-panel p-5 xl:sticky xl:top-6" aria-label="Filtros">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-bold">Filtros</h3>
          {activeFilterCount ? (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_TRAINING_FILTERS);
                setPicked([]);
              }}
              className="text-sm font-semibold text-pool hover:underline"
            >
              Limpar ({activeFilterCount})
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          <FilterGroup title="Intensidade">
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

          <FilterGroup title="Descanso (saída)">
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

          <FilterGroup title="Piscina">
            {presentCourses.length ? (
              presentCourses.map((course) => (
                <Toggle
                  key={course}
                  on={filters.courses.includes(course)}
                  onClick={() => patch({ courses: toggleValue(filters.courses, course) })}
                  count={atDistance.filter((row) => row.course === course).length}
                >
                  {COURSE_LABEL[course]}
                </Toggle>
              ))
            ) : (
              <p className="text-sm text-mute">Os treinos não têm a piscina indicada.</p>
            )}
          </FilterGroup>

          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setMoreFilters((value) => !value)}
              aria-expanded={moreFilters}
              className="flex w-full items-center justify-between text-sm font-semibold text-mist"
            >
              Mais filtros
              <span aria-hidden="true" className={`transition-transform ${moreFilters ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
          </div>

          {moreFilters ? (
            <div className="space-y-4">
              <FilterGroup title="Posição na série">
                {(["first", "middle", "last"] as const).map((slot) => (
                  <Toggle key={slot} on={filters.slots.includes(slot)} onClick={() => patch({ slots: toggleValue(filters.slots, slot) })}>
                    {SLOT_LABEL[slot]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Série">
                {more.setShapes.map((shape) => (
                  <Toggle key={shape} on={filters.setShapes.includes(shape)} onClick={() => patch({ setShapes: toggleValue(filters.setShapes, shape) })}>
                    {shape}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Partida">
                <Toggle on={filters.fromBlock === "below"} onClick={() => exclusive("fromBlock")("below")}>
                  De baixo
                </Toggle>
                <Toggle on={filters.fromBlock === "block"} onClick={() => exclusive("fromBlock")("block")}>
                  Bloco
                </Toggle>
              </FilterGroup>
              <FilterGroup title="Treino do dia">
                <Toggle on={filters.trainedEarlier === "no"} onClick={() => exclusive("trainedEarlier")("no")}>
                  1.º treino
                </Toggle>
                <Toggle on={filters.trainedEarlier === "yes"} onClick={() => exclusive("trainedEarlier")("yes")}>
                  2.º treino
                </Toggle>
                {(["morning", "afternoon"] as const).map((shift) => (
                  <Toggle key={shift} on={filters.shifts.includes(shift)} onClick={() => patch({ shifts: toggleValue(filters.shifts, shift) })}>
                    {SHIFT_LABEL[shift]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Estilo">
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
              <FilterGroup title="Material">
                <Toggle on={filters.gears.includes("none")} onClick={() => patch({ gears: toggleValue(filters.gears, "none") })}>
                  Sem material
                </Toggle>
                {GEARS.map((gear) => (
                  <Toggle key={gear} on={filters.gears.includes(gear)} onClick={() => patch({ gears: toggleValue(filters.gears, gear) })}>
                    {GEAR_LABEL[gear]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Cansaço acumulado">
                {more.fatigueBands.map((band) => (
                  <Toggle key={band} on={filters.fatigueBands.includes(band)} onClick={() => patch({ fatigueBands: toggleValue(filters.fatigueBands, band) })}>
                    {band}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Carga antes da repetição">
                {more.loadBuckets.map((bucket) => (
                  <Toggle key={bucket} on={filters.loadBuckets.includes(bucket)} onClick={() => patch({ loadBuckets: toggleValue(filters.loadBuckets, bucket) })}>
                    {bucket}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Carga semanal">
                {more.weeklyBuckets.map((bucket) => (
                  <Toggle key={bucket} on={filters.weeklyBuckets.includes(bucket)} onClick={() => patch({ weeklyBuckets: toggleValue(filters.weeklyBuckets, bucket) })}>
                    {bucket}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Bloco">
                {(["warmup", "main", "recovery"] as const).map((type) => (
                  <Toggle key={type} on={filters.blockTypes.includes(type)} onClick={() => patch({ blockTypes: toggleValue(filters.blockTypes, type) })}>
                    {BLOCK_LABEL[type]}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Dia da semana">
                {WEEKDAYS.map((label, index) => (
                  <Toggle key={label} on={filters.weekdays.includes(index)} onClick={() => patch({ weekdays: toggleValue(filters.weekdays, index) })}>
                    {label}
                  </Toggle>
                ))}
              </FilterGroup>
              <FilterGroup title="Mês">
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
  if (!items.length) return <EmptyChart text="Nenhuma repetição com estes filtros." />;
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
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Tempo real e estimado por repetição">
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
              {`${formatDatePt(row.date)} · ${row.setShape} rep ${row.repInSegment}/${row.segmentReps}\nReal ${clock(row.timeS)}${
                target ? ` · estimado ${clock(target.targetS)} (${signedSeconds(row.timeS - target.targetS)})` : " · sem estimativa"
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

function Histogram({ real, estimated }: { real: number[]; estimated: number[] }) {
  if (!real.length) return <EmptyChart text="Nenhuma repetição com estes filtros." />;
  const all = [...real, ...estimated];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(max - min, 0.4);
  const binCount = Math.min(14, Math.max(5, Math.round(Math.sqrt(all.length) * 1.6)));
  const rawWidth = span / binCount;
  const binWidth = Math.ceil(rawWidth * 10) / 10 || 0.1;
  const start = Math.floor(min * 10) / 10;
  const bins = Array.from({ length: Math.ceil((max - start) / binWidth + 1e-9) || 1 }, (_, i) => ({
    lo: start + i * binWidth,
    hi: start + (i + 1) * binWidth,
    real: 0,
    est: 0,
  }));
  const place = (value: number, key: "real" | "est") => {
    const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((value - start) / binWidth)));
    bins[idx][key] += 1;
  };
  real.forEach((value) => place(value, "real"));
  estimated.forEach((value) => place(value, "est"));
  const peak = Math.max(1, ...bins.map((bin) => Math.max(bin.real, bin.est)));

  const width = 820;
  const height = 280;
  const pad = { l: 40, r: 16, t: 16, b: 44 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = innerW / bins.length;
  const barW = Math.min(26, slot * 0.36);
  const y = (n: number) => pad.t + innerH - (n / peak) * innerH;
  const every = Math.ceil(bins.length / 8);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Distribuição dos tempos reais e estimados">
      {niceTicks(0, peak, Math.min(4, peak))
        .filter((tick) => Number.isInteger(tick))
        .map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke={GRID} />
            <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" fill={MUTE} fontSize="12">
              {tick}
            </text>
          </g>
        ))}
      {bins.map((bin, i) => {
        const cx = pad.l + slot * i + slot / 2;
        return (
          <g key={i}>
            <rect x={cx - barW - 1} y={y(bin.real)} width={barW} height={pad.t + innerH - y(bin.real)} rx={3} fill={NAVY}>
              <title>{`${clock(bin.lo)}–${clock(bin.hi)} · real ${bin.real}`}</title>
            </rect>
            <rect
              x={cx + 1}
              y={y(bin.est)}
              width={barW}
              height={pad.t + innerH - y(bin.est)}
              rx={3}
              fill="#e6f0fa"
              stroke={POOL}
              strokeWidth={1.5}
            >
              <title>{`${clock(bin.lo)}–${clock(bin.hi)} · estimado ${bin.est}`}</title>
            </rect>
            {i % every === 0 ? (
              <text x={cx} y={height - 16} textAnchor="middle" fill={MUTE} fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
                {clock(bin.lo)}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={pad.l} x2={width - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="#bccad8" />
    </svg>
  );
}

function GroupBars({ rows, groupBy }: { rows: TrainingRep[]; groupBy: TrainingGroupBy }) {
  const groups = groupTrainingReps(rows, groupBy).map((group) => ({
    label: group.label,
    stats: statsOf(group.rows.map((row) => row.timeS)),
  }));
  if (!groups.length) return <EmptyChart text="Nenhuma repetição com estes filtros." />;
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
                {index === 0 ? `${group.stats.n} reps` : `+${gap.toFixed(2)}`}
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
  picked,
  setPicked,
}: {
  rows: TrainingRep[];
  predictions: Map<string, TrainingTarget>;
  picked: string[];
  setPicked: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const a = rows.find((row) => row.log.id === picked[0]);
  const b = rows.find((row) => row.log.id === picked[1]);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h3 className="font-display text-2xl font-bold">Repetições</h3>
          <p className="text-sm text-mute">Seleciona duas linhas para as comparar.</p>
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
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-panel-2 text-xs font-semibold text-mute">
            <tr>
              <th className="px-5 py-2.5">Data</th>
              <th className="px-3 py-2.5">Série</th>
              <th className="px-3 py-2.5">Rep</th>
              <th className="px-3 py-2.5 text-right">Real</th>
              <th className="px-3 py-2.5 text-right">Estimado</th>
              <th className="px-3 py-2.5 text-right">Dif.</th>
              <th className="px-3 py-2.5">Intensidade</th>
              <th className="px-3 py-2.5">Saída</th>
              <th className="px-3 py-2.5">Antes</th>
              <th className="px-3 py-2.5">Cansaço</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-mute">
                  Nenhuma repetição com estes filtros.
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
                          {row.fromBlock ? "Bloco" : "De baixo"}
                          {row.gearLabel ? ` · ${row.gearLabel}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular">
                        {row.round > 1 ? `S${row.round} · ` : ""}
                        {row.repInSegment}/{row.segmentReps}
                      </td>
                      <td className="px-3 py-2.5 text-right font-display text-lg font-bold tabular text-mist">{clock(row.timeS)}</td>
                      <td className="px-3 py-2.5 text-right tabular text-sand">
                        {target ? clock(target.targetS) : "—"}
                        {target ? <span className="block text-[11px] text-mute">confiança {target.confidence}</span> : null}
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
                      <td className="px-3 py-2.5">
                        {row.fatigue}
                        <span className="block text-xs text-mute">{row.fatigueBand}</span>
                      </td>
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
