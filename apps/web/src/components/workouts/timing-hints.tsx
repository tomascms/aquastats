"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { todayIso } from "@/lib/dates";
import { runMlJob } from "@/lib/ml/ml-client";
import type { TimingSuggestion } from "@/lib/ml/production";
import { formatSet } from "@/lib/set";
import type { Athlete, TimeLog, Workout } from "@/lib/types";

/**
 * Which sets to time in this session to teach the model the most: where it is least sure, or what an
 * athlete has never been timed in. Tested on synthetic data: timing one set per session chosen this
 * way beats a random set (docs/ml/results/fase-i-aprendizagem-ativa.md).
 */
export function TimingHints({ workout, athletes, workouts, timeLogs }: { workout: Workout; athletes: Athlete[]; workouts: Workout[]; timeLogs: TimeLog[] }) {
  const t = useT();
  const upcoming = workout.date >= todayIso();
  const [hints, setHints] = useState<TimingSuggestion[]>([]);
  useEffect(() => {
    if (!upcoming) return;
    let alive = true;
    // In a Web Worker: the model's full pass must not freeze the page.
    runMlJob({ kind: "hints", limit: 3, athletes, workouts, timeLogs, workoutId: workout.id })
      .then((result) => alive && result.kind === "hints" && setHints(result.hints))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [athletes, timeLogs, upcoming, workout.id, workouts]);
  if (!upcoming || !hints.length) return null;
  const name = (id: string) => athletes.find((athlete) => athlete.id === id)?.name ?? "";
  const setLabel = (blockId: string) => {
    const block = workout.blocks.find((item) => item.id === blockId);
    return block ? formatSet(block) : "";
  };
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-xl font-bold">{t("O que cronometrar")}</h2>
      <p className="mt-1 text-xs text-mute">{t("Onde um tempo ensina mais ao modelo: o que ele sabe pior, ou séries que o atleta nunca fez cronometradas.")}</p>
      <ul className="mt-3 space-y-2">
        {hints.map((hint) => (
          <li key={`${hint.athleteId}-${hint.blockId}`} className="text-sm">
            <span className="font-semibold text-mist">{name(hint.athleteId)}</span>
            <span className="block text-mute">{setLabel(hint.blockId)}</span>
            <span className="block text-xs text-mute">
              {hint.newKind ? t("Nunca cronometrada: estimativa ±{pct}%", { pct: hint.uncertaintyPct.toFixed(1) }) : t("Estimativa ±{pct}%", { pct: hint.uncertaintyPct.toFixed(1) })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
