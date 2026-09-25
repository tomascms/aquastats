"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { WorkoutSheet } from "@/components/workouts/workout-sheet";
import { COURSE_LABEL, SHIFT_LABEL, formatDatePt } from "@/lib/labels";
import { formatMeters, workoutMeters } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";

export default function ViewWorkoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { athletes, workouts } = useAppState();
  const workout = workouts.find((item) => item.id === params.id);
  const present = workout ? athletes.filter((athlete) => workout.athleteIds.includes(athlete.id)) : [];

  if (!workout) {
    return (
      <div className="py-10 text-center text-mute">
        Treino não encontrado.
        <Link href="/coach" className="mt-3 block text-aqua">
          Voltar ao calendário
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`/coach?date=${workout.date}`} className="text-sm font-semibold text-pool hover:underline">
        ← Calendário
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{workout.title}</h1>
          <p className="mt-1 text-sm text-mute">
            {formatDatePt(workout.date)} · {SHIFT_LABEL[workout.shift]}
            {workout.course === "scm" || workout.course === "lcm" ? ` · ${COURSE_LABEL[workout.course]}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/coach/matrix/${workout.id}`} className="btn-primary">
            Registar tempos
          </Link>
          <Link href={`/coach/workouts/${workout.id}/edit`} className="btn-ghost">
            Editar
          </Link>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <WorkoutSheet workout={workout} />
        <aside className="space-y-4">
          <section className="rounded-2xl bg-aqua px-5 py-4 text-white">
            <p className="text-sm text-white/70">Volume total</p>
            <p className="font-display text-4xl font-bold tabular">{formatMeters(workoutMeters(workout))}</p>
          </section>
          <section className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-display text-xl font-bold">Na água</h2>
            {present.length ? (
              <ul className="mt-2 space-y-1.5">
                {present.map((athlete) => (
                  <li key={athlete.id}>
                    <Link href={`/coach/team/${athlete.id}`} className="text-sm font-medium text-mist hover:text-pool">
                      {athlete.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-mute">Ninguém marcado neste treino.</p>
            )}
          </section>
          <button
            type="button"
            className="min-h-10 w-full rounded-lg text-sm font-semibold text-coral hover:bg-[#fdecea]"
            onClick={() => {
              if (!window.confirm("Apagar este treino e os tempos?")) return;
              void actions.deleteWorkout(workout.id).then(() => router.push(`/coach?date=${workout.date}`));
            }}
          >
            Apagar treino
          </button>
        </aside>
      </div>
    </div>
  );
}
