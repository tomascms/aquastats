"use client";

import Link from "next/link";
import { displayTitle, formatDatePt } from "@/lib/labels";
import { useAppState } from "@/lib/store";
import { formatTime, toCentiseconds } from "@/lib/swim-time";
import { useT } from "@/i18n/provider";

export default function SwimmerHistoryPage() {
  const t = useT();
  const { athletes, swimmerId, workouts, timeLogs } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId) ?? athletes[0];
  const mine = timeLogs.filter((log) => log.athleteId === me?.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("Os meus tempos")}</h1>
      <ul className="space-y-2">
        {workouts.map((workout) => {
          const logs = mine.filter((log) => log.workoutId === workout.id);
          if (!logs.length) return null;
          const best = [...logs].sort(
            (a, b) => toCentiseconds(a.mm, a.ss, a.cc) - toCentiseconds(b.mm, b.ss, b.cc),
          )[0];
          return (
            <li key={workout.id}>
              <Link href={`/swimmer/workout/${workout.id}`} className="block rounded-2xl border border-line bg-panel p-4">
                <p className="text-lg font-semibold">{displayTitle(workout.title)}</p>
                <p className="text-xs text-mute">
                  {formatDatePt(workout.date)} · {t("{count} tempos", { count: logs.length })} ·{" "}
                  {t("melhor {time}", { time: formatTime(best.mm, best.ss, best.cc) })}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
