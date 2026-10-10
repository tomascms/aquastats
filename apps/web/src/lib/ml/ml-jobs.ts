import type { TrainingRep } from "../training-context";
import type { Athlete, TimeLog, Workout } from "../types";
import type { RaceResult } from "./backtest";
import { ledgerItems, type LedgerItem } from "./ledger";
import { appTeam, predictionsFor, timingSuggestions, type ModelId, type TimingSuggestion } from "./production";

/*
 * The model's heavy work for the screens, as plain data in and out so it can run in a Web Worker
 * (ml.worker.ts): a full pass over 30 athletes × 4 seasons takes ~3 s on a laptop, ~4× that on a phone, and
 * must never freeze the timing matrix. ml-client.ts sends the jobs; this file is also the fallback when a
 * browser has no workers.
 */

type TeamInput = { athletes: Athlete[]; workouts: Workout[]; timeLogs: TimeLog[]; races?: RaceResult[]; workoutId: string };

export type MlJob =
  | ({ kind: "ledger"; models: [ModelId, "champion" | "challenger"][] } & TeamInput)
  | ({ kind: "hints"; limit: number } & TeamInput);

export type MlJobResult =
  | { kind: "ledger"; recordings: { model: ModelId; role: "champion" | "challenger"; items: LedgerItem[] }[] }
  | { kind: "hints"; hints: TimingSuggestion[] };

function planned(input: TeamInput): { team: ReturnType<typeof appTeam>["team"]; planned: TrainingRep[] } | null {
  const target = input.workouts.find((item) => item.id === input.workoutId);
  if (!target) return null;
  const { team, planned } = appTeam(input.athletes, input.workouts, input.timeLogs, [target], input.races ?? []);
  return planned.length ? { team, planned } : null;
}

export function runMlJob(job: MlJob): MlJobResult {
  const prepared = planned(job);
  if (job.kind === "hints") {
    return { kind: "hints", hints: prepared ? timingSuggestions(prepared.team, prepared.planned).slice(0, job.limit) : [] };
  }
  return {
    kind: "ledger",
    recordings: prepared
      ? job.models.map(([model, role]) => ({ model, role, items: ledgerItems(predictionsFor(model, prepared.team), prepared.planned) }))
      : [],
  };
}
