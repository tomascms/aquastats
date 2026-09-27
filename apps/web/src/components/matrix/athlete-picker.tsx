"use client";

import { useState } from "react";
import { actions, useAppState } from "@/lib/store";
import { IconMinus, IconPlus } from "@/components/ui/icons";
import { useT } from "@/i18n/provider";

export function AthletePicker({
  workoutId,
  onClose,
}: {
  workoutId: string;
  onClose: () => void;
}) {
  const t = useT();
  const { athletes, workouts } = useAppState();
  const workout = workouts.find((item) => item.id === workoutId);
  const [query, setQuery] = useState("");
  const assigned = new Set(workout?.athleteIds ?? []);
  const visible = athletes.filter((athlete) => {
    if (athlete.active === false && !assigned.has(athlete.id)) return false;
    if (!query.trim()) return true;
    return athlete.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center">
      <div className="safe-bottom flex max-h-[80dvh] w-full max-w-lg flex-col rounded-xl border border-line bg-ink-2 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{t("Editar atletas")}</h2>
          <button type="button" onClick={onClose} className="text-sm text-mute">
            {t("Fechar")}
          </button>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Filtrar A–Z")}
          className="mb-3 w-full rounded-2xl border border-line bg-panel px-3 py-3 text-sm outline-none focus:border-aqua"
        />
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {visible.map((athlete) => {
            const inWorkout = assigned.has(athlete.id);
            return (
              <li key={athlete.id}>
                <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-3 py-2.5">
                  <span className={`font-semibold ${inWorkout ? "text-mist" : "text-mute"}`}>{athlete.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      inWorkout
                        ? actions.removeAthleteFromWorkout(workoutId, athlete.id)
                        : actions.addAthleteToWorkout(workoutId, athlete.id)
                    }
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      inWorkout ? "bg-coral/15 text-coral" : "bg-aqua/15 text-aqua"
                    }`}
                    aria-label={inWorkout ? t("Tirar {name}", { name: athlete.name }) : t("Meter {name}", { name: athlete.name })}
                  >
                    {inWorkout ? <IconMinus className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
