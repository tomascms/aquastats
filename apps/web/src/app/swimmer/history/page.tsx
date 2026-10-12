"use client";

import Link from "next/link";
import { useMemo } from "react";
import { swimClock } from "@/components/analise/coach-text";
import { displayTitle, formatDatePt } from "@/lib/labels";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep, type TrainingRep } from "@/lib/training-context";
import { useT } from "@/i18n/provider";

/** The session's main set: the timed set (not easy swimming) with the most metres. Never a "best" across distances. */
function mainSet(rows: TrainingRep[]): { label: string; meanS: number } | null {
  const sets = new Map<string, TrainingRep[]>();
  for (const r of rows) if (r.intensity !== "SUAVE") sets.set(`${r.blockId}|${r.segmentIndex}|${r.round}`, [...(sets.get(`${r.blockId}|${r.segmentIndex}|${r.round}`) ?? []), r]);
  const best = [...sets.values()].sort((a, b) => b.length * b[0].distanceM - a.length * a[0].distanceM)[0];
  if (!best) return null;
  return { label: `${best.length}×${best[0].distanceM} ${best[0].intensity}`, meanS: best.reduce((a, r) => a + r.timeS, 0) / best.length };
}

export default function SwimmerHistoryPage() {
  const t = useT();
  const { athletes, swimmerId, workouts, timeLogs } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId) ?? athletes[0];
  const mine = timeLogs.filter((log) => log.athleteId === me?.id);
  const rowsByWorkout = useMemo(() => {
    const out = new Map<string, TrainingRep[]>();
    if (!me) return out;
    for (const r of annotateTrainingReps(workouts, timeLogs, me.id).filter(isPlausibleRep)) out.set(r.workoutId, [...(out.get(r.workoutId) ?? []), r]);
    return out;
  }, [me, workouts, timeLogs]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Os meus tempos")}</h1>
      <ul className="space-y-2">
        {workouts.map((workout) => {
          const logs = mine.filter((log) => log.workoutId === workout.id);
          if (!logs.length) return null;
          const main = mainSet(rowsByWorkout.get(workout.id) ?? []);
          return (
            <li key={workout.id}>
              <Link href={`/swimmer/workout/${workout.id}`} className="block rounded-2xl border border-line bg-panel p-4">
                <p className="text-lg font-semibold">{displayTitle(workout.title)}</p>
                <p className="text-xs text-mute">
                  {formatDatePt(workout.date)} · {t("{count} tempos", { count: logs.length })}
                  {main ? ` · ${t("série principal {set}, média {time}", { set: main.label, time: swimClock(main.meanS) })}` : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
