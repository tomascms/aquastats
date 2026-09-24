"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnaliseTabs } from "@/components/analise/analise-tabs";
import { TreinoDashboard } from "@/components/analise/treino-dashboard";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { BLOCK_LABEL, SHIFT_LABEL, formatDatePt, strokeLabel } from "@/lib/labels";
import { todayIso } from "@/lib/dates";
import { athleteVolumeM, formatMeters, weeklyVolume, workoutMeters } from "@/lib/rankings";
import { flattenInner, formatSegment, formatSet, innerCount, readySegments, splitRepNumber } from "@/lib/set";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, type TrainingRep } from "@/lib/training-context";
import { formatTime, toCentiseconds } from "@/lib/swim-time";
import type { TimeLog, WorkoutBlock } from "@/lib/types";

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
        on ? "bg-aqua text-ink" : "border border-line text-mute hover:text-mist"
      }`}
    >
      {children}
    </button>
  );
}

export function TreinoAnalise({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { athletes, workouts, timeLogs, swimmerId } = useAppState();
  const locked = role === "swimmer" ? swimmerId : "";
  const athleteId = locked || search.get("atleta") || "";
  const athlete = athletes.find((item) => item.id === athleteId);
  const initial = search.get("date") || todayIso();
  const [cursor, setCursor] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const [compare, setCompare] = useState<string[]>([]);
  const [view, setView] = useState<"session" | "model">("session");
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
  const teamRows = useMemo<TrainingRep[]>(
    () => (role === "coach" ? athletes.flatMap((item) => annotateTrainingReps(workouts, timeLogs, item.id, item.wellness)) : []),
    [athletes, role, timeLogs, workouts],
  );
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sand">Análise</p>
          <h1 className="text-3xl font-semibold tracking-tight">Análise de treino</h1>
          <p className="text-sm text-mute">Escolhe a série do dia ou abre o modelo com todos os filtros de contexto.</p>
        </div>
        <div className="w-full max-w-md">
          <AnaliseTabs role={role} />
        </div>
      </header>

      {role === "coach" ? (
        <label className="block text-xs font-semibold uppercase tracking-wide text-mute">
          Atleta
          <select className="field mt-1" value={athleteId} onChange={(event) => setAthlete(event.target.value)}>
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
          <p className="mt-1 text-sm text-mute">O calendário mostra os treinos e os tempos da água.</p>
        </section>
      ) : (
        <>
          <div className="grid max-w-md grid-cols-2 gap-1 rounded-lg border border-line bg-ink-2 p-1">
            <button
              type="button"
              onClick={() => setView("session")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                view === "session" ? "bg-aqua text-ink" : "text-mute hover:text-mist"
              }`}
            >
              Sessão
            </button>
            <button
              type="button"
              onClick={() => setView("model")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                view === "model" ? "bg-aqua text-ink" : "text-mute hover:text-mist"
              }`}
            >
              Modelo
            </button>
          </div>

          {view === "model" ? (
            <TreinoDashboard
              athleteId={athlete.id}
              workouts={workouts}
              timeLogs={timeLogs}
              teamRows={teamRows}
              wellness={athlete.wellness}
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

              <section className="rounded-xl border border-line bg-panel p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-aqua">{formatDatePt(selected)}</p>
                <p className="text-lg font-semibold">{athlete.name}</p>
                {(() => {
                  const weeks = weeklyVolume(workouts, athlete.id, 8);
                  const thisWeek = weeks[weeks.length - 1]?.meters ?? 0;
                  const dayMeters = dayWorkouts.reduce((sum, item) => sum + workoutMeters(item), 0);
                  const max = Math.max(...weeks.map((week) => week.meters), 1);
                  return (
                    <div className="mt-2">
                      <p className="text-xs text-mute">
                        {formatMeters(athleteVolumeM(workouts, athlete.id))} acumulados · {formatMeters(thisWeek)} esta
                        semana
                        {dayMeters ? ` · ${formatMeters(dayMeters)} neste dia` : ""}
                      </p>
                      <div className="mt-2 flex h-12 items-end gap-1">
                        {weeks.map((week) => (
                          <div key={week.start} className="flex flex-1 flex-col justify-end">
                            <div
                              className="w-full rounded-sm bg-aqua/80"
                              style={{ height: `${Math.max(6, (week.meters / max) * 100)}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {dayWorkouts.length === 0 ? (
                  <p className="mt-3 text-sm text-mute">Sem treino neste dia.</p>
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
                          {item.title ? ` · ${item.title}` : ""}
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
                          Todas as séries
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
                            Série {index + 1}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    {workout && block ? (
                      <article className="rounded-2xl border border-line bg-ink px-3 py-3">
                        <p className="font-semibold">{segment ? formatSegment(segment) : formatSet(block)}</p>
                        <p className="text-xs text-mute">
                          {SHIFT_LABEL[workout.shift]} · {formatMeters(workoutMeters(workout))}
                          {block.rounds > 1 && roundPick !== "all" ? ` · série ${roundPick}` : ""}
                        </p>
                        {visibleLogs.length === 0 ? (
                          <p className="mt-2 text-[11px] text-mute">Ainda sem tempos nesta série.</p>
                        ) : (
                          <SeriesTimes
                            logs={visibleLogs}
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
                  <div className="mt-4 rounded-2xl border border-line bg-ink px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sand">Comparação</p>
                    <p className="mt-1 font-mono text-sm">
                      {formatTime(picked[0].mm, picked[0].ss, picked[0].cc)} →{" "}
                      {formatTime(picked[1].mm, picked[1].ss, picked[1].cc)}
                    </p>
                    <p className={`font-mono text-lg ${delta.seconds < 0 ? "text-aqua" : "text-coral"}`}>
                      {delta.seconds > 0 ? "+" : ""}
                      {delta.seconds.toFixed(2)} s · {delta.pct > 0 ? "+" : ""}
                      {delta.pct.toFixed(2)} %
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-[11px] text-mute">Clica em dois tempos desta série para os comparar.</p>
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
  block,
  compare,
  onToggle,
}: {
  logs: TimeLog[];
  block: WorkoutBlock;
  compare: string[];
  onToggle: (id: string) => void;
}) {
  const times = logs.map((log) => logSeconds(log));
  const max = Math.max(...times, 0.01);
  const min = Math.min(...times);
  const innerN = innerCount(block) || 1;
  const inners = flattenInner(block);
  const span = Math.max(0.05, max - min * 0.98);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex h-10 items-end gap-1">
        {logs.map((log, index) => (
          <div
            key={log.id}
            className="flex-1 rounded-sm bg-aqua/80"
            style={{ height: `${Math.max(12, ((times[index] - min * 0.98) / span) * 100)}%` }}
            title={formatTime(log.mm, log.ss, log.cc)}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {logs.map((log) => {
          const split = splitRepNumber(log.repNumber, innerN);
          const inner = inners[split.innerRep - 1];
          const on = compare.includes(log.id);
          return (
            <li key={log.id}>
              <button
                type="button"
                onClick={() => onToggle(log.id)}
                className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left ${
                  on ? "bg-sand/20 ring-1 ring-sand" : "hover:bg-panel"
                }`}
              >
                <span className="text-[11px] text-mute">
                  {block.rounds > 1 ? `Série ${split.round} · ` : ""}
                  Rep {(inner?.itemIndex ?? split.innerRep - 1) + 1}
                  {strokeLabel(log.stroke) ? ` · ${strokeLabel(log.stroke)}` : ""}
                </span>
                <span className="font-mono text-sm text-aqua">{formatTime(log.mm, log.ss, log.cc)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
