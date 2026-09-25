"use client";

import { useMemo, useState } from "react";
import { RaceChart } from "@/components/provas/charts";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, STROKE_LABEL, formatDatePt } from "@/lib/labels";
import { formatMeters } from "@/lib/rankings";
import { formatTime } from "@/lib/swim-time";
import {
  EMPTY_TRAINING_FILTERS,
  GROUP_BY_LABEL,
  MONTH_LABEL,
  REST_VS_LABEL,
  SLOT_LABEL,
  annotateTrainingReps,
  filterTrainingReps,
  groupTrainingReps,
  statsOf,
  uniqueSorted,
  type FatigueBand,
  type TrainingFilters,
  type TrainingGroupBy,
  type TrainingRep,
} from "@/lib/training-context";
import { GEAR_LABEL, GEARS, INTENSITIES, INTENSITY_LABEL } from "@/lib/set";
import { predictTrainingTargets } from "@/lib/training-prediction";
import { WEEKDAYS } from "@/lib/dates";
import type { TimeLog, WellnessEntry, Workout } from "@/lib/types";

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        on ? "bg-aqua text-ink" : "border border-line text-mute hover:text-mist"
      }`}
    >
      {children}
    </button>
  );
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-mute">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

const GROUP_OPTIONS: TrainingGroupBy[] = [
  "setShape",
  "intensity",
  "distance",
  "restBucket",
  "slot",
  "fromBlock",
  "weekday",
  "shift",
  "trainedEarlier",
  "stroke",
  "gear",
  "month",
  "fatigueBand",
  "loadBeforeBucket",
];

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
  const [filters, setFilters] = useState<TrainingFilters>(EMPTY_TRAINING_FILTERS);
  const [groupBy, setGroupBy] = useState<TrainingGroupBy>("setShape");
  const [picked, setPicked] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const rows = useMemo(
    () => annotateTrainingReps(workouts, timeLogs, athleteId, wellness),
    [athleteId, timeLogs, wellness, workouts],
  );
  const visible = useMemo(() => filterTrainingReps(rows, filters), [filters, rows]);
  const stats = useMemo(() => statsOf(visible.map((row) => row.timeS)), [visible]);
  const groups = useMemo(() => groupTrainingReps(visible, groupBy), [groupBy, visible]);
  const timeline = visible.slice(-48);
  const predictions = useMemo(() => predictTrainingTargets(rows, teamRows ?? rows), [rows, teamRows]);
  const timelineTargets = timeline.map((row) => predictions.get(row.log.id)?.targetS ?? row.timeS);
  const targetStats = statsOf(timelineTargets);
  const targetDelta = stats.n && targetStats.n ? stats.mean - targetStats.mean : 0;
  const activeFilterCount = Object.values(filters).reduce((count, value) => {
    if (Array.isArray(value)) return count + (value.length ? 1 : 0);
    return count + (value ? 1 : 0);
  }, 0);

  const options = useMemo(() => {
    return {
      distances: uniqueSorted(
        rows.map((row) => row.distanceM),
        (a, b) => a - b,
      ),
      setShapes: uniqueSorted(rows.map((row) => row.setShape)),
      restBuckets: uniqueSorted(rows.map((row) => row.restBucket)),
      months: uniqueSorted(
        rows.map((row) => row.month),
        (a, b) => a - b,
      ),
      loadBuckets: uniqueSorted(rows.map((row) => row.loadBeforeBucket)),
      weeklyBuckets: uniqueSorted(rows.map((row) => row.weeklyBucket)),
      fatigueBands: uniqueSorted(rows.map((row) => row.fatigueBand)) as FatigueBand[],
    };
  }, [rows]);

  function patch(next: Partial<TrainingFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPicked([]);
  }

  const exclusive =
    (key: "fromBlock" | "trainedEarlier" | "easierMiddle" | "mixedIntensity" | "mixedStroke") =>
    (value: TrainingFilters[typeof key]) => {
      patch({ [key]: filters[key] === value ? "" : value } as Partial<TrainingFilters>);
    };

  if (!rows.length) {
    return (
      <section className="rounded-xl border border-dashed border-line bg-panel/50 px-5 py-10 text-center">
        <p className="text-lg font-semibold">Ainda sem tempos para o modelo</p>
        <p className="mt-1 text-sm text-mute">
          Assim que houver séries cronometradas, cada repetição fica anotada com carga, descanso e contexto.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="data-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="metric-label">Modelo de treino</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-mist">Contexto de cada repetição</h2>
            <p className="mt-1 max-w-2xl text-sm text-mute">Cruza carga, descanso, intensidade e fadiga numa só leitura.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount ? <span className="soft-pill">{activeFilterCount} filtros</span> : null}
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="btn-ghost h-9 px-3 text-xs"
              aria-expanded={showFilters}
            >
              {showFilters ? "Esconder filtros" : "Filtrar dados"}
            </button>
            {activeFilterCount ? (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_TRAINING_FILTERS);
                  setPicked([]);
                }}
                className="text-xs font-semibold text-mute hover:text-mist"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>

        {showFilters ? <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2 xl:grid-cols-3">
          <FilterRow label="Distância">
            {options.distances.map((distance) => (
              <Chip
                key={distance}
                on={filters.distances.includes(distance)}
                onClick={() => patch({ distances: toggleValue(filters.distances, distance) })}
              >
                {distance} m
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Forma da série">
            {options.setShapes.map((shape) => (
              <Chip
                key={shape}
                on={filters.setShapes.includes(shape)}
                onClick={() => patch({ setShapes: toggleValue(filters.setShapes, shape) })}
              >
                {shape}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Intensidade">
            {INTENSITIES.map((intensity) => (
              <Chip
                key={intensity}
                on={filters.intensities.includes(intensity)}
                onClick={() => patch({ intensities: toggleValue(filters.intensities, intensity) })}
              >
                {INTENSITY_LABEL[intensity]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Descanso">
            {options.restBuckets.map((bucket) => (
              <Chip
                key={bucket}
                on={filters.restBuckets.includes(bucket)}
                onClick={() => patch({ restBuckets: toggleValue(filters.restBuckets, bucket) })}
              >
                {bucket === "livre" ? "Sem intervalo" : bucket}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Variação de descanso">
            {(["less", "same", "more"] as const).map((value) => (
              <Chip
                key={value}
                on={filters.restVsSet.includes(value)}
                onClick={() => patch({ restVsSet: toggleValue(filters.restVsSet, value) })}
              >
                {REST_VS_LABEL[value]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Posição na série">
            {(["first", "middle", "last"] as const).map((slot) => (
              <Chip
                key={slot}
                on={filters.slots.includes(slot)}
                onClick={() => patch({ slots: toggleValue(filters.slots, slot) })}
              >
                {SLOT_LABEL[slot]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Partida">
            <Chip on={filters.fromBlock === "below"} onClick={() => exclusive("fromBlock")("below")}>
              De baixo
            </Chip>
            <Chip on={filters.fromBlock === "block"} onClick={() => exclusive("fromBlock")("block")}>
              Bloco
            </Chip>
          </FilterRow>
          <FilterRow label="Meio da série">
            <Chip on={filters.easierMiddle === "yes"} onClick={() => exclusive("easierMiddle")("yes")}>
              Intensidade mais baixa no meio
            </Chip>
            <Chip on={filters.mixedIntensity === "yes"} onClick={() => exclusive("mixedIntensity")("yes")}>
              Intensidades mistas
            </Chip>
            <Chip on={filters.mixedStroke === "yes"} onClick={() => exclusive("mixedStroke")("yes")}>
              Muda o estilo
            </Chip>
          </FilterRow>
          <FilterRow label="Já treinou hoje">
            <Chip on={filters.trainedEarlier === "no"} onClick={() => exclusive("trainedEarlier")("no")}>
              1.º treino
            </Chip>
            <Chip on={filters.trainedEarlier === "yes"} onClick={() => exclusive("trainedEarlier")("yes")}>
              2.º treino do dia
            </Chip>
          </FilterRow>
          <FilterRow label="Dia da semana">
            {WEEKDAYS.map((label, index) => (
              <Chip
                key={label}
                on={filters.weekdays.includes(index)}
                onClick={() => patch({ weekdays: toggleValue(filters.weekdays, index) })}
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Horário">
            <Chip on={filters.shifts.includes("morning")} onClick={() => patch({ shifts: toggleValue(filters.shifts, "morning") })}>
              {SHIFT_LABEL.morning}
            </Chip>
            <Chip
              on={filters.shifts.includes("afternoon")}
              onClick={() => patch({ shifts: toggleValue(filters.shifts, "afternoon") })}
            >
              {SHIFT_LABEL.afternoon}
            </Chip>
          </FilterRow>
          <FilterRow label="Estilo">
            <Chip
              on={filters.strokes.includes("none")}
              onClick={() => patch({ strokes: toggleValue(filters.strokes, "none") })}
            >
              Sem estilo
            </Chip>
            {Object.entries(STROKE_LABEL).map(([stroke, label]) => (
              <Chip
                key={stroke}
                on={filters.strokes.includes(stroke as keyof typeof STROKE_LABEL)}
                onClick={() =>
                  patch({ strokes: toggleValue(filters.strokes, stroke as keyof typeof STROKE_LABEL) })
                }
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Material">
            <Chip on={filters.gears.includes("none")} onClick={() => patch({ gears: toggleValue(filters.gears, "none") })}>
              Sem material
            </Chip>
            {GEARS.map((gear) => (
              <Chip
                key={gear}
                on={filters.gears.includes(gear)}
                onClick={() => patch({ gears: toggleValue(filters.gears, gear) })}
              >
                {GEAR_LABEL[gear]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Mês">
            {options.months.map((month) => (
              <Chip
                key={month}
                on={filters.months.includes(month)}
                onClick={() => patch({ months: toggleValue(filters.months, month) })}
              >
                {MONTH_LABEL[month - 1]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Carga antes desta rep">
            {options.loadBuckets.map((bucket) => (
              <Chip
                key={bucket}
                on={filters.loadBuckets.includes(bucket)}
                onClick={() => patch({ loadBuckets: toggleValue(filters.loadBuckets, bucket) })}
              >
                {bucket}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Carga semanal">
            {options.weeklyBuckets.map((bucket) => (
              <Chip
                key={bucket}
                on={filters.weeklyBuckets.includes(bucket)}
                onClick={() => patch({ weeklyBuckets: toggleValue(filters.weeklyBuckets, bucket) })}
              >
                {bucket}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Cansaço acumulado">
            {options.fatigueBands.map((band) => (
              <Chip
                key={band}
                on={filters.fatigueBands.includes(band)}
                onClick={() => patch({ fatigueBands: toggleValue(filters.fatigueBands, band) })}
              >
                {band}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Bloco">
            {(["warmup", "main", "recovery"] as const).map((type) => (
              <Chip
                key={type}
                on={filters.blockTypes.includes(type)}
                onClick={() => patch({ blockTypes: toggleValue(filters.blockTypes, type) })}
              >
                {BLOCK_LABEL[type]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Piscina">
            <Chip on={filters.courses.includes("scm")} onClick={() => patch({ courses: toggleValue(filters.courses, "scm") })}>
              {COURSE_LABEL.scm}
            </Chip>
            <Chip on={filters.courses.includes("lcm")} onClick={() => patch({ courses: toggleValue(filters.courses, "lcm") })}>
              {COURSE_LABEL.lcm}
            </Chip>
          </FilterRow>
        </div> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Reps" value={String(stats.n)} />
        <Stat label="Média" value={stats.n ? stats.mean.toFixed(2) : "—"} hint="s" />
        <Stat label="Melhor" value={stats.n ? stats.best.toFixed(2) : "—"} hint="s" />
        <Stat label="Mediana" value={stats.n ? stats.median.toFixed(2) : "—"} hint="s" />
        <Stat label="Desvio" value={stats.n ? stats.sd.toFixed(2) : "—"} hint="s" />
      </section>

      <section className="data-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="metric-label">Objetivos preditivos</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-mist">Real vs objetivo esperado</h2>
            <p className="mt-1 max-w-2xl text-sm text-mute">
              O histórico do atleta pesa mais; a equipa entra apenas como referência quando faltam repetições equivalentes.
            </p>
          </div>
          <span className="soft-pill">modelo explicável</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <PredictionStat label="Objetivo médio" value={targetStats.n ? `${targetStats.mean.toFixed(2)} s` : "—"} />
          <PredictionStat label="Real médio" value={stats.n ? `${stats.mean.toFixed(2)} s` : "—"} />
          <PredictionStat
            label="Desvio ao objetivo"
            value={targetStats.n ? `${targetDelta > 0 ? "+" : ""}${targetDelta.toFixed(2)} s` : "—"}
            tone={targetDelta <= 0 ? "good" : "warn"}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <RaceChart
          title="Ritmo real vs objetivo"
          unit="linha dourada = objetivo esperado"
          labels={timeline.map((row, index) =>
            index === 0 || index === timeline.length - 1 ? formatDatePt(row.date).slice(0, 5) : "",
          )}
          series={[
            {
              id: "times",
              label: "Real",
              color: "#4b9fff",
              values: timeline.map((row) => row.timeS),
            },
          ]}
          overlay={{ id: "target", label: "Objetivo", color: "#e7b84b", values: timelineTargets, dashed: true }}
        />
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-mute">
            Agrupar por
            <select
              className="field mt-1"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as TrainingGroupBy)}
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {GROUP_BY_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
          <RaceChart
            title={`Média por ${GROUP_BY_LABEL[groupBy].toLowerCase()}`}
            unit="segundos"
            kind="bar"
            labels={groups.map((group) => group.label)}
            series={[
              {
                id: "mean",
                label: "Média",
                color: "#f5c542",
                values: groups.map((group) => statsOf(group.rows.map((row) => row.timeS)).mean),
              },
            ]}
          />
        </div>
      </div>

      <section className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="min-w-[920px] w-full text-left text-[12px]">
          <thead className="text-xs text-mute">
            <tr>
              <th className="px-3 py-2 font-semibold">Data</th>
              <th className="px-3 py-2 font-semibold">Série</th>
              <th className="px-3 py-2 font-semibold">Rep</th>
              <th className="px-3 py-2 font-semibold">Tempo</th>
              <th className="px-3 py-2 font-semibold">Objetivo</th>
              <th className="px-3 py-2 font-semibold">Int.</th>
              <th className="px-3 py-2 font-semibold">Descanso</th>
              <th className="px-3 py-2 font-semibold">Antes</th>
              <th className="px-3 py-2 font-semibold">Semana</th>
              <th className="px-3 py-2 font-semibold">Cansaço</th>
              <th className="px-3 py-2 font-semibold">Contexto</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-mute">
                  Nenhum tempo com estes filtros.
                </td>
              </tr>
            ) : (
              visible
                .slice()
                .reverse()
                .slice(0, 80)
                .map((row) => {
                  const on = picked.includes(row.log.id);
                  return (
                    <tr
                      key={row.log.id}
                      className={`cursor-pointer border-t border-line/70 ${on ? "bg-sand/15" : "hover:bg-ink"}`}
                      onClick={() =>
                        setPicked((current) => {
                          if (current.includes(row.log.id)) return current.filter((id) => id !== row.log.id);
                          if (current.length >= 2) return [current[1], row.log.id];
                          return [...current, row.log.id];
                        })
                      }
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatDatePt(row.date)}
                        <span className="block text-[10px] text-mute">
                          {row.weekdayLabel} · {SHIFT_LABEL[row.shift]}
                          {row.trainedEarlierToday ? " · 2.º" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.setShape}
                        <span className="block text-[10px] text-mute">
                          {row.fromBlock ? "Bloco" : "De baixo"}
                          {row.gearLabel ? ` · ${row.gearLabel}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {row.round > 1 ? `S${row.round} · ` : ""}
                        {row.repInSegment}/{row.segmentReps}
                      </td>
                      <td className="px-3 py-2 font-mono text-aqua">{formatTime(row.log.mm, row.log.ss, row.log.cc)}</td>
                      <td className="px-3 py-2 font-mono text-sand">{predictions.get(row.log.id)?.targetS.toFixed(2) ?? "—"}</td>
                      <td className="px-3 py-2">{INTENSITY_LABEL[row.intensity]}</td>
                      <td className="px-3 py-2">
                        {row.restLabel}
                        <span className="block text-[10px] text-mute">{REST_VS_LABEL[row.restVsSet]}</span>
                      </td>
                      <td className="px-3 py-2">{formatMeters(row.loadBeforeM)}</td>
                      <td className="px-3 py-2">{formatMeters(row.weeklyLoadM)}</td>
                      <td className="px-3 py-2">
                        {row.fatigue}
                        <span className="block text-[10px] text-mute">{row.fatigueBand}</span>
                      </td>
                      <td className="px-3 py-2 text-mute">
                        {[
                          STROKE_LABEL[row.stroke as keyof typeof STROKE_LABEL],
                          SLOT_LABEL[row.slot],
                          row.easierMiddle ? "meio mais fácil" : "",
                          row.strokeChanged ? "mudou estilo" : "",
                          MONTH_LABEL[row.month - 1],
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </section>
      {picked.length === 2 ? <CompareHint rows={visible} picked={picked} /> : (
        <p className="text-[11px] text-mute">Clica em duas linhas para comparar centésimos no mesmo contexto.</p>
      )}
    </div>
  );
}

function PredictionStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className="stat-card p-3">
      <p className="metric-label">{label}</p>
      <p className={`mt-2 metric-value ${tone === "good" ? "text-[#278b66]" : tone === "warn" ? "text-coral" : ""}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-3">
      <p className="text-xs font-semibold text-mute">{label}</p>
      <p className="mt-1 font-mono text-lg text-aqua">
        {value}
        {hint ? <span className="ml-1 text-[11px] text-mute">{hint}</span> : null}
      </p>
    </div>
  );
}

function CompareHint({ rows, picked }: { rows: TrainingRep[]; picked: string[] }) {
  const a = rows.find((row) => row.log.id === picked[0]);
  const b = rows.find((row) => row.log.id === picked[1]);
  if (!a || !b) return null;
  const delta = b.timeS - a.timeS;
  return (
    <div className="rounded-xl border border-line bg-ink px-4 py-3">
      <p className="text-xs font-semibold text-sand">Comparação</p>
      <p className="mt-1 font-mono text-sm">
        {formatTime(a.log.mm, a.log.ss, a.log.cc)} → {formatTime(b.log.mm, b.log.ss, b.log.cc)}
        <span className={`ml-2 ${delta < 0 ? "text-aqua" : "text-coral"}`}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(2)} s
        </span>
      </p>
      <p className="mt-1 text-[11px] text-mute">
        {a.setShape} {INTENSITY_LABEL[a.intensity]} vs {b.setShape} {INTENSITY_LABEL[b.intensity]} · cansaço {a.fatigue}{" "}
        vs {b.fatigue} · carga antes {formatMeters(a.loadBeforeM)} vs {formatMeters(b.loadBeforeM)}
      </p>
    </div>
  );
}
