"use client";

import { useEffect, useRef } from "react";
import { todayIso } from "../dates";
import type { Athlete, TimeLog, Workout } from "../types";
import type { RaceResult } from "./backtest";
import { flushQueuedPredictions, recordOrQueue } from "./ledger";
import { runMlJob } from "./ml-client";
import { fetchMlRoles } from "./ml-config";

/** Delay so the timing screen is fully interactive before the model runs. */
const IDLE_MS = 1500;

/**
 * When a session is opened for timing, record what both models predict for every rep that has no
 * time yet (champion and the shadow challenger). Offline, the predictions wait on this device and
 * are sent when the connection is back; the API still refuses any that arrive after the rep's time,
 * so a prediction is never recorded after the fact.
 */
export function useRecordPredictions(workout: Workout | undefined, data: { athletes: Athlete[]; workouts: Workout[]; timeLogs: TimeLog[]; races?: RaceResult[]; historyLoaded: boolean }) {
  const done = useRef(new Set<string>());
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  });
  const workoutId = workout?.id;
  // The model needs the whole history: predicting from the recent window alone would record worse forecasts.
  const eligible = Boolean(workout && workout.date >= todayIso() && data.historyLoaded);
  useEffect(() => {
    const flush = () => void flushQueuedPredictions().catch(() => undefined);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);
  useEffect(() => {
    if (!workoutId || !eligible || done.current.has(workoutId)) return;
    const timer = setTimeout(async () => {
      const { athletes, workouts, timeLogs, races } = latest.current;
      const target = workouts.find((item) => item.id === workoutId);
      if (!target) return;
      done.current.add(workoutId);
      try {
        // Roles decided at run time: the kill switch reverts the champion, ML_SHADOW=off stops the shadow.
        const roles = await fetchMlRoles();
        const models: [typeof roles.champion, "champion" | "challenger"][] = [[roles.champion, "champion"]];
        if (roles.shadow) models.push([roles.challenger, "challenger"]);
        // The model runs in a Web Worker: timing keeps answering every tap while it works.
        const result = await runMlJob({ kind: "ledger", models, athletes, workouts, timeLogs, races, workoutId: target.id });
        if (result.kind !== "ledger") return;
        for (const { model, role, items } of result.recordings) {
          if (items.length) void recordOrQueue(model, role, items).catch(() => undefined);
        }
      } catch {
        // The ledger never blocks timing.
      }
    }, IDLE_MS);
    return () => clearTimeout(timer);
  }, [eligible, workoutId]);
}
