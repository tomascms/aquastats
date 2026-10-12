"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSay } from "@/components/analise/coach-text";
import { ReportPoints } from "@/components/analise/report-points";
import { readSession } from "@/components/workouts/session-analysis";
import { useT } from "@/i18n/provider";
import { displayTitle, formatDatePt } from "@/lib/labels";
import { useAppState } from "@/lib/store";
import type { Athlete } from "@/lib/types";

/** The swimmer's latest timed session in one card: verdict, one strength, one focus (benchmark-visualizacao D8). */
export function LastSessionCard({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs, competitions, meetEntries, meetResults } = useAppState();
  const data = useMemo(() => {
    const timed = new Set(timeLogs.filter((log) => log.athleteId === athlete.id).map((log) => log.workoutId));
    const last = workouts.filter((w) => timed.has(w.id)).sort((a, b) => b.date.localeCompare(a.date))[0];
    return last ? { workout: last, ...readSession(athlete, last, { workouts, timeLogs, competitions, meetEntries, meetResults }, "athlete", false) } : null;
  }, [athlete, workouts, timeLogs, competitions, meetEntries, meetResults]);
  if (!data || !data.report.sets.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-panel px-4 py-3" aria-labelledby="ultimo-treino">
      <h2 id="ultimo-treino" className="font-semibold">
        {t("O teu último treino")}
        <span className="font-normal text-mute">
          {" "}
          · {formatDatePt(data.workout.date)} · {displayTitle(data.workout.title)}
        </span>
      </h2>
      <p className="mt-1 font-semibold text-mist">{say(data.report.headline)}</p>
      <ReportPoints points={data.report.points} />
      <Link href={`/swimmer/workout/${data.workout.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-pool">
        {t("Ver o treino série a série")} →
      </Link>
    </section>
  );
}
