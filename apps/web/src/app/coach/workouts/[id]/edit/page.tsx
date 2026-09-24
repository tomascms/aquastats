"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { WorkoutForm } from "@/components/workouts/workout-form";
import { actions, useAppState } from "@/lib/store";
import { normalizeDraft } from "@/lib/set";

export default function EditWorkoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { workouts } = useAppState();
  const workout = workouts.find((item) => item.id === params.id);

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
    <div>
      <Link href={`/coach?date=${workout.date}`} className="mb-3 inline-block text-sm text-mute">
        ← Calendário
      </Link>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Editar treino</h1>
      <WorkoutForm
        initial={{
          title: workout.title,
          date: workout.date,
          shift: workout.shift,
          course: workout.course === "scm" || workout.course === "lcm" ? workout.course : undefined,
          blocks: workout.blocks.map((block) => ({ ...normalizeDraft(block), id: block.id })),
        }}
        submitLabel="Guardar alterações"
        onSubmit={async (input) => {
          await actions.updateWorkout(workout.id, input);
          router.push(`/coach?date=${input.date}`);
        }}
      />
      <button
        type="button"
        className="mt-3 h-12 w-full rounded-2xl border border-coral/40 text-sm font-semibold text-coral"
        onClick={() => {
          if (!window.confirm("Apagar este treino e os tempos?")) return;
          void actions.deleteWorkout(workout.id).then(() => router.push(`/coach?date=${workout.date}`));
        }}
      >
        Apagar treino
      </button>
    </div>
  );
}
