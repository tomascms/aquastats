"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { todayIso } from "@/lib/dates";
import { appTeam, timingSuggestions } from "@/lib/ml/production";
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
  const hints = useMemo(() => {
    if (!upcoming) return [];
    const { team, planned } = appTeam(athletes, workouts, timeLogs, [workout]);
    return planned.length ? timingSuggestions(team, planned).slice(0, 3) : [];
  }, [athletes, timeLogs, upcoming, workout, workouts]);
  if (!hints.length) return null;
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
