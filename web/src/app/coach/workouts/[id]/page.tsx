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
    <div className="space-y-4">
      <Link href={`/coach?date=${workout.date}`} className="mb-1 inline-block text-sm text-mute">
        ← Calendário
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workout.title}</h1>
        <p className="text-sm text-mute">
          {formatDatePt(workout.date)} · {SHIFT_LABEL[workout.shift]}
          {workout.course === "scm" || workout.course === "lcm" ? ` · ${COURSE_LABEL[workout.course]}` : ""}
          {` · ${formatMeters(workoutMeters(workout))}`}
        </p>
      </div>
      <WorkoutSheet workout={workout} />
      {present.length > 0 && (
        <p className="text-sm text-mute">Na água: {present.map((athlete) => athlete.name).join(", ")}</p>
      )}
      <div className="grid grid-cols-2 gap-2 pb-4">
        <Link
          href={`/coach/workouts/${workout.id}/edit`}
          className="flex h-12 items-center justify-center rounded-2xl border border-line text-sm font-semibold"
        >
          Editar
        </Link>
        <Link
          href={`/coach/matrix/${workout.id}`}
          className="flex h-12 items-center justify-center rounded-2xl bg-aqua text-sm font-medium text-ink"
        >
          Tempos
        </Link>
        <button
          type="button"
          className="col-span-2 h-12 rounded-2xl border border-coral/40 text-sm font-semibold text-coral"
          onClick={() => {
            if (!window.confirm("Apagar este treino e os tempos?")) return;
            void actions.deleteWorkout(workout.id).then(() => router.push(`/coach?date=${workout.date}`));
          }}
        >
          Apagar treino
        </button>
      </div>
    </div>
  );
}
