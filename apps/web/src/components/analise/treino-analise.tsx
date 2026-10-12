"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnaliseTabs } from "@/components/analise/analise-tabs";
import { TreinoDashboard } from "@/components/analise/treino-dashboard";
import { AthleteChips, NoAthletes } from "@/components/analise/athlete-chips";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { BLOCK_LABEL, SHIFT_LABEL, displayTitle, formatDatePt, strokeLabel } from "@/lib/labels";
import { todayIso } from "@/lib/dates";
import { formatMeters, weeklyVolume, workoutMeters } from "@/lib/rankings";
import { flattenInner, formatSegment, formatSet, innerCount, readySegments, splitRepNumber } from "@/lib/set";
import { formatRaceClock } from "@/lib/race";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps } from "@/lib/training-context";
import { predictTrainingTargets } from "@/lib/training-prediction";
import { appTeam, siteRaces, statePredictions } from "@/lib/ml/production";
import { useMlRoles } from "@/lib/ml/ml-config";
import { toCentiseconds } from "@/lib/swim-time";
import type { TimeLog, WorkoutBlock } from "@/lib/types";
import { useT } from "@/i18n/provider";

function logSeconds(log: TimeLog): number {
  return toCentiseconds(log.mm, log.ss, log.cc) / 100;
}

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
        on ? "bg-aqua text-white" : "border border-line text-mute hover:text-mist"
      }`}
    >
      {children}
    </button>
  );
}

export function TreinoAnalise({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { athletes, workouts, timeLogs, swimmerId, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const races = useMemo(() => siteRaces(athletes, { competitions, meetEntries, meetResults, raceSessions }), [athletes, competitions, meetEntries, meetResults, raceSessions]);
  const { champion } = useMlRoles();
  const locked = role === "swimmer" ? swimmerId : "";
  const athleteId = locked || search.get("atleta") || athletes[0]?.id || "";
  const athlete = athletes.find((item) => item.id === athleteId);
  const initial = search.get("date") || todayIso();
  const [cursor, setCursor] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const [compare, setCompare] = useState<string[]>([]);
  const [view, setView] = useState<"session" | "model">("model");
  const [workoutId, setWorkoutId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [roundPick, setRoundPick] = useState<number | "all">("all");

  const mine = useMemo(
    () =>
      workouts
        .filter((workout) => athleteId && workout.athleteIds.includes(athleteId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [athleteId, workouts],
  );
  const logs = useMemo(() => timeLogs.filter((log) => log.athleteId === athleteId), [athleteId, timeLogs]);
  const estimates = useMemo(() => {
    const byLog = new Map<string, number>();
    if (champion === "estado") {
      for (const [logId, prediction] of statePredictions(appTeam(athletes, workouts, timeLogs, [], races).team)) byLog.set(logId, prediction.mean);
      return byLog;
    }
    const own = athleteId ? annotateTrainingReps(workouts, timeLogs, athleteId, athlete?.wellness, athlete?.groupName) : [];
    for (const [logId, target] of predictTrainingTargets(own)) byLog.set(logId, target.targetS);
    return byLog;
  }, [athlete?.wellness, athleteId, athletes, champion, races, timeLogs, workouts]);
  const dayWorkouts = useMemo(() => mine.filter((workout) => workout.date === selected), [mine, selected]);
  const workoutCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const workout of mine) counts[workout.date] = (counts[workout.date] ?? 0) + 1;
    return counts;
  }, [mine]);

  const workout = dayWorkouts.find((item) => item.id === workoutId) ?? dayWorkouts[0];
  const block = workout?.blocks.find((item) => item.id === blockId) ?? workout?.blocks[0];
  const segments = block ? readySegments(block) : [];
  const segment = segments[Math.min(segmentIndex, Math.max(0, segments.length - 1))];

  const visibleLogs = useMemo(() => {
    if (!workout || !block) return [];
    const innerN = innerCount(block) || 1;
    const inners = flattenInner(block);
    return logs
      .filter((log) => {
        if (log.workoutId !== workout.id || log.blockId !== block.id) return false;
        const split = splitRepNumber(log.repNumber, innerN);
        if (roundPick !== "all" && split.round !== roundPick) return false;
        return inners[split.innerRep - 1]?.segmentIndex === segmentIndex;
      })
      .sort((a, b) => a.repNumber - b.repNumber);
  }, [block, logs, roundPick, segmentIndex, workout]);

  const picked = compare
    .map((id) => visibleLogs.find((log) => log.id === id))
    .filter((log): log is TimeLog => Boolean(log));
  const delta =
    picked.length === 2
      ? {
          seconds: logSeconds(picked[1]) - logSeconds(picked[0]),
          pct: logSeconds(picked[0])
            ? ((logSeconds(picked[1]) - logSeconds(picked[0])) / logSeconds(picked[0])) * 100
            : 0,
        }
      : null;

  const latestDate = mine[0]?.date;
  const hasDateParam = Boolean(search.get("date"));
  useEffect(() => {
    if (hasDateParam || !latestDate) return;
    setSelected(latestDate);
    setCursor(latestDate);
  }, [athleteId, hasDateParam, latestDate]);

  useEffect(() => {
    const first = dayWorkouts[0];
    setWorkoutId(first?.id ?? "");
    const firstBlock = first?.blocks.find((item) => item.type === "main") ?? first?.blocks[0];
    setBlockId(firstBlock?.id ?? "");
    setSegmentIndex(0);
    setRoundPick(firstBlock && firstBlock.rounds > 1 ? 1 : "all");
    setCompare([]);
  }, [athleteId, dayWorkouts, selected]);

  function setAthlete(id: string) {
    const next = new URLSearchParams(search.toString());
    if (id) next.set("atleta", id);
    else next.delete("atleta");
    next.delete("date");
    setCompare([]);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function toggleCompare(id: string) {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t("Análise de treino")}</h1>
          <p className="mt-1 text-sm text-mute">{t("A série do dia, repetição a repetição, ou o modelo com todo o contexto.")}</p>
        </div>
        <div className="w-full max-w-md">
          <AnaliseTabs role={role} />
        </div>
      </header>

      {role === "coach" ? <AthleteChips athletes={athletes} selectedId={athleteId} onSelect={setAthlete} /> : null}

      {!athlete ? (
        <NoAthletes />
      ) : (
        <>
          <div className="grid max-w-xs grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1">
            <button
              type="button"
              onClick={() => setView("session")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                view === "session" ? "bg-aqua text-white" : "text-mute hover:text-mist"
              }`}
            >
              {t("Sessão")}
            </button>
            <button
              type="button"
              onClick={() => setView("model")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                view === "model" ? "bg-aqua text-white" : "text-mute hover:text-mist"
              }`}
            >
              {t("Modelo")}
            </button>
          </div>

          {view === "model" ? (
            <TreinoDashboard
              athleteId={athlete.id}
              athletes={athletes}
              workouts={workouts}
              timeLogs={timeLogs}
              races={races}
              wellness={athlete.wellness}
              groupName={athlete.groupName}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
              <MonthCalendar
                cursor={cursor}
                selected={selected}
                workoutCountByDate={workoutCountByDate}
                onCursor={setCursor}
                onSelect={(iso) => {
                  setSelected(iso);
                  setCursor(iso);
                }}
              />

              <section className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-bold">{formatDatePt(selected)}</h2>
                  <span className="text-sm text-mute">
                    {(() => {
                      const dayMeters = dayWorkouts.reduce((sum, item) => sum + workoutMeters(item), 0);
                      const thisWeek = weeklyVolume(workouts, athlete.id, 1)[0]?.meters ?? 0;
                      return `${dayMeters ? `${t("{volume} neste dia", { volume: formatMeters(dayMeters) })} · ` : ""}${t("{volume} esta semana", { volume: formatMeters(thisWeek) })}`;
                    })()}
                  </span>
                </div>

                {dayWorkouts.length === 0 ? (
                  <p className="mt-3 text-sm text-mute">{t("Sem treino neste dia.")}</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {dayWorkouts.map((item) => (
                        <Chip
                          key={item.id}
                          on={workout?.id === item.id}
                          onClick={() => {
                            setWorkoutId(item.id);
                            const nextBlock = item.blocks.find((blockItem) => blockItem.type === "main") ?? item.blocks[0];
                            setBlockId(nextBlock?.id ?? "");
                            setSegmentIndex(0);
                            setRoundPick(nextBlock && nextBlock.rounds > 1 ? 1 : "all");
                            setCompare([]);
                          }}
                        >
                          {SHIFT_LABEL[item.shift]}
                          {item.title ? ` · ${displayTitle(item.title)}` : ""}
                        </Chip>
                      ))}
                    </div>

                    {workout ? (
                      <div className="flex flex-wrap gap-1">
                        {workout.blocks.map((item) => (
                          <Chip
                            key={item.id}
                            on={block?.id === item.id}
                            onClick={() => {
                              setBlockId(item.id);
                              setSegmentIndex(0);
                              setRoundPick(item.rounds > 1 ? 1 : "all");
                              setCompare([]);
                            }}
                          >
                            {BLOCK_LABEL[item.type]}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    {segments.length ? (
                      <div className="flex flex-wrap gap-1">
                        {segments.map((item, index) => (
                          <Chip
                            key={`${item.distanceM}-${index}`}
                            on={segmentIndex === index}
                            onClick={() => {
                              setSegmentIndex(index);
                              setCompare([]);
                            }}
                          >
                            {formatSegment(item)}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    {block && block.rounds > 1 ? (
                      <div className="flex flex-wrap gap-1">
                        <Chip
                          on={roundPick === "all"}
                          onClick={() => {
                            setRoundPick("all");
                            setCompare([]);
                          }}
                        >
                          {t("Todas as séries")}
                        </Chip>
                        {Array.from({ length: block.rounds }, (_, index) => (
                          <Chip
                            key={index}
                            on={roundPick === index + 1}
                            onClick={() => {
                              setRoundPick(index + 1);
                              setCompare([]);
                            }}
                          >
                            {t("Série {n}", { n: index + 1 })}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    {workout && block ? (
                      <article className="border-t border-line pt-4">
                        <p className="font-display text-2xl font-bold">{segment ? formatSegment(segment) : formatSet(block)}</p>
                        <p className="text-sm text-mute">
                          {SHIFT_LABEL[workout.shift]} · {formatMeters(workoutMeters(workout))}
                          {block.rounds > 1 && roundPick !== "all" ? ` · ${t("série {n}", { n: roundPick })}` : ""}
                        </p>
                        {visibleLogs.length === 0 ? (
                          <p className="mt-3 rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-sm text-mute">
                            {t("Ainda sem tempos nesta série.")}
                          </p>
                        ) : (
                          <SeriesTimes
                            logs={visibleLogs}
                            estimates={estimates}
                            block={block}
                            compare={compare}
                            onToggle={toggleCompare}
                          />
                        )}
                      </article>
                    ) : null}
                  </div>
                )}

                {delta && picked.length === 2 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-aqua px-4 py-3 text-white">
                    <p className="font-display text-2xl font-bold tabular">
                      {formatRaceClock(logSeconds(picked[0]))} <span className="text-white/60">→</span>{" "}
                      {formatRaceClock(logSeconds(picked[1]))}
                    </p>
                    <p className={`font-display text-2xl font-bold tabular ${delta.seconds < 0 ? "text-[#7ee2b8]" : "text-[#ffb4a8]"}`}>
                      {delta.seconds > 0 ? "+" : ""}
                      {delta.seconds.toFixed(2)} s
                      <span className="ml-2 text-sm font-medium text-white/70">
                        {delta.pct > 0 ? "+" : ""}
                        {delta.pct.toFixed(2)} %
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-mute">{t("Toca em dois tempos da série para os comparar.")}</p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SeriesTimes({
  logs,
  estimates,
  block,
  compare,
  onToggle,
}: {
  logs: TimeLog[];
  estimates: Map<string, number>;
  block: WorkoutBlock;
  compare: string[];
  onToggle: (id: string) => void;
}) {
  const t = useT();
  const times = logs.map((log) => logSeconds(log));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = times.reduce((sum, value) => sum + value, 0) / times.length;
  const floor = min - Math.max(0.5, (max - min) * 0.5);
  const innerN = innerCount(block) || 1;
  const inners = flattenInner(block);

  return (
    <div className="mt-4 space-y-4">
      <dl className="grid grid-cols-4 gap-2">
        {[
          { label: t("Média"), value: formatRaceClock(avg) },
          { label: t("Melhor"), value: formatRaceClock(min) },
          { label: t("Pior"), value: formatRaceClock(max) },
          { label: t("Amplitude"), value: `${(max - min).toFixed(2)} s` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-panel-2 px-3 py-2">
            <dt className="text-xs text-mute">{item.label}</dt>
            <dd className="font-display text-xl font-bold tabular">{item.value}</dd>
          </div>
        ))}
      </dl>
      <ol className="space-y-1">
        {logs.map((log, index) => {
          const split = splitRepNumber(log.repNumber, innerN);
          const inner = inners[split.innerRep - 1];
          const on = compare.includes(log.id);
          const time = times[index];
          const estimate = estimates.get(log.id);
          const diff = time - (estimate ?? avg);
          const width = 30 + ((time - floor) / Math.max(max - floor, 0.01)) * 70;
          return (
            <li key={log.id}>
              <button
                type="button"
                onClick={() => onToggle(log.id)}
                aria-pressed={on}
                className={`grid w-full grid-cols-[5.5rem_minmax(0,1fr)_4.5rem_4rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  on ? "bg-aqua-soft ring-2 ring-aqua" : "hover:bg-panel-2"
                }`}
              >
                <span className="text-sm text-mute">
                  {block.rounds > 1 ? `S${split.round} · ` : ""}
                  {t("Rep {n}", { n: (inner?.itemIndex ?? split.innerRep - 1) + 1 })}
                  {strokeLabel(log.stroke) ? <span className="block text-xs">{strokeLabel(log.stroke)}</span> : null}
                </span>
                <span className="h-5 overflow-hidden rounded bg-panel-2">
                  <span
                    className={`block h-full rounded ${diff <= 0 ? "bg-good" : "bg-coral"}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="text-right">
                  <span className="block font-display text-xl font-bold leading-tight tabular text-mist">{formatRaceClock(time)}</span>
                  {estimate ? <span className="block text-[11px] tabular text-mute">{t("est. {time}", { time: formatRaceClock(estimate) })}</span> : null}
                </span>
                <span className={`text-right text-xs font-semibold tabular ${diff <= 0 ? "text-good" : "text-coral"}`}>
                  {diff > 0 ? "+" : diff < 0 ? "−" : ""}
                  {Math.abs(diff).toFixed(2)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-mute">
        {t("Barras mais curtas são repetições mais rápidas. Verde: mais rápido do que o estimado para essa intensidade e saída (ou do que a média da série, quando não há histórico).")}
      </p>
    </div>
  );
}
