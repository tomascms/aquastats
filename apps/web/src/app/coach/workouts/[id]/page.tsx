"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SessionAnalysis } from "@/components/workouts/session-analysis";
import { WorkoutSheet } from "@/components/workouts/workout-sheet";
import { COURSE_LABEL, SHIFT_LABEL, displayTitle, formatDatePt } from "@/lib/labels";
import { formatMeters, workoutMeters } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";
import { useT } from "@/i18n/provider";
import { HrChart } from "@/components/heart-rate/hr-chart";
import { TimingHints } from "@/components/workouts/timing-hints";
import { sessionFor } from "@/lib/heart-rate";
import { confirmDialog } from "@/lib/confirm";

export default function ViewWorkoutPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { athletes, workouts, hrSessions, timeLogs } = useAppState();
  const workout = workouts.find((item) => item.id === params.id);
  const present = workout ? athletes.filter((athlete) => workout.athleteIds.includes(athlete.id)) : [];

  if (!workout) {
    return (
      <div className="py-10 text-center text-mute">
        {t("Treino não encontrado.")}
        <Link href="/coach" className="mt-3 block text-aqua">
          {t("Voltar ao calendário")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`/coach?date=${workout.date}`} className="text-sm font-semibold text-pool hover:underline">
        ← {t("Calendário")}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{displayTitle(workout.title)}</h1>
          <p className="mt-1 text-sm text-mute">
            {formatDatePt(workout.date)} · {SHIFT_LABEL[workout.shift]}
            {workout.course === "scm" || workout.course === "lcm" ? ` · ${COURSE_LABEL[workout.course]}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/coach/matrix/${workout.id}`} className="btn-primary">
            {t("Registar tempos")}
          </Link>
          <Link href={`/coach/workouts/${workout.id}/edit`} className="btn-ghost">
            {t("Editar")}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-4">
          <WorkoutSheet workout={workout} />
          <SessionAnalysis workout={workout} athletes={present} />
          {present.map((athlete) => {
            const hr = sessionFor(hrSessions, workout.id, athlete.id);
            return hr ? (
              <div key={athlete.id}>
                <p className="mb-1 text-sm font-semibold text-mist">{athlete.name}</p>
                <HrChart session={hr} />
              </div>
            ) : null;
          })}
        </div>
        <aside className="space-y-4">
          <section className="rounded-2xl bg-aqua px-5 py-4 text-white">
            <p className="text-sm text-white/70">{t("Volume total")}</p>
            <p className="font-display text-4xl font-bold tabular">{formatMeters(workoutMeters(workout))}</p>
          </section>
          <TimingHints workout={workout} athletes={athletes} workouts={workouts} timeLogs={timeLogs} />
          <section className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-display text-xl font-bold">{t("Na água")}</h2>
            {present.length ? (
              <ul className="mt-2 space-y-1.5">
                {present.map((athlete) => {
                  const hr = sessionFor(hrSessions, workout.id, athlete.id);
                  return (
                    <li key={athlete.id} className="flex items-baseline justify-between gap-2">
                      <Link href={`/coach/team/${athlete.id}`} className="text-sm font-medium text-mist hover:text-pool">
                        {athlete.name}
                      </Link>
                      {hr?.maxHr ? (
                        <span className="font-mono text-xs text-coral" title={t("Frequência cardíaca máxima do treino")}>
                          ♥ {hr.maxHr}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-mute">{t("Ninguém marcado neste treino.")}</p>
            )}
          </section>
          <button
            type="button"
            className="min-h-10 w-full rounded-lg text-sm font-semibold text-coral hover:bg-[#fdecea]"
            onClick={async () => {
              if (!(await confirmDialog({ title: t("Apagar este treino e os tempos?"), confirmLabel: t("Apagar"), destructive: true }))) return;
              void actions.deleteWorkout(workout.id).then(() => router.push(`/coach?date=${workout.date}`));
            }}
          >
            {t("Apagar treino")}
          </button>
        </aside>
      </div>
    </div>
  );
}
