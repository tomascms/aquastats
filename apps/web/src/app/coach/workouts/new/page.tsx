"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WorkoutForm } from "@/components/workouts/workout-form";
import { todayIso } from "@/lib/dates";
import { actions } from "@/lib/store";

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">A carregar…</p>}>
      <NewWorkoutForm />
    </Suspense>
  );
}

function NewWorkoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || todayIso();

  return (
    <div>
      <Link href={`/coach?date=${date}`} className="mb-3 inline-block text-sm text-mute">
        ← Calendário
      </Link>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Criar treino</h1>
      <p className="mb-4 text-sm text-mute">Reps e metros primeiro. Depois podes ajustar cada repetição.</p>
      <WorkoutForm
        key={date}
        initial={{ date }}
        submitLabel="Guardar treino"
        onSubmit={async (input) => {
          await actions.addWorkout(input);
          router.push(`/coach?date=${input.date}`);
        }}
      />
    </div>
  );
}
