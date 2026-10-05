"use client";

import { useEffect, useRef } from "react";
import { todayIso } from "../dates";
import type { Athlete, TimeLog, Workout } from "../types";
import { ledgerItems, recordPredictions } from "./ledger";
import { appTeam, CHALLENGER, CHAMPION, predictionsFor } from "./production";

/** Delay so the timing screen is fully interactive before the model runs. */
const IDLE_MS = 1500;

/**
 * When a session is opened for timing, record what both models predict for every rep that has no
 * time yet (champion and the shadow challenger). Best effort: offline or failed requests are simply
 * not recorded — a prediction is never stored after its time exists (the API refuses it).
 */
export function useRecordPredictions(workout: Workout | undefined, data: { athletes: Athlete[]; workouts: Workout[]; timeLogs: TimeLog[] }) {
  const done = useRef(new Set<string>());
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  });
  const workoutId = workout?.id;
  const eligible = Boolean(workout && workout.date >= todayIso());
  useEffect(() => {
    if (!workoutId || !eligible || done.current.has(workoutId)) return;
    const timer = setTimeout(() => {
      const { athletes, workouts, timeLogs } = latest.current;
      const target = workouts.find((item) => item.id === workoutId);
      if (!target || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      done.current.add(workoutId);
      try {
        const { team, planned } = appTeam(athletes, workouts, timeLogs, [target]);
        if (!planned.length) return;
        for (const [model, role] of [
          [CHAMPION, "champion"],
          [CHALLENGER, "challenger"],
        ] as const) {
          const items = ledgerItems(predictionsFor(model, team), planned);
          if (items.length) void recordPredictions(model, role, items).catch(() => undefined);
        }
      } catch {
        // The ledger never blocks timing.
      }
    }, IDLE_MS);
    return () => clearTimeout(timer);
  }, [eligible, workoutId]);
}
