import type { TrainingRep } from "../training-context";
import { dayNumber, HORIZONS, isPlanned, Z80, type Prediction, type TeamData } from "./backtest";
import { calibrateStream, type CalibrationCheckpoint } from "./calibration";
import { runStateModel, type StateCheckpoint, type TeamForecast } from "./forecaster";
import { teamSuspects, type Suspect } from "./quality";
import { V1_CALIBRATION, V1_OPTIONS, V1_VERSION } from "./v1";

/*
 * What the app runs for the state model, without replaying years of history on every request.
 *
 * Every part of the model is causal by day (the leakage tests check it): what it has learned by the
 * end of a day depends only on data up to that day. So the run keeps a checkpoint a couple of days
 * behind the latest timed day — suspect flags, the state model and the calibration as they stood —
 * with a fingerprint of all the data up to it. Next time:
 *   - same data → the same result, nothing runs;
 *   - data up to the checkpoint unchanged (new times, new sessions, plans) → resume from it: only the
 *     new days run;
 *   - an older time or session edited → a full run (correct by construction, just slower).
 * Resuming gives exactly the forecasts of a full run (incremental.test.ts, pipeline.test.ts). The
 * cache lives in memory: a page reload runs once in full (cost measured in docs/ml/README.md).
 */

export type PipelineMode = "cache" | "resume" | "full";

export type PipelineRun = {
  raw: Map<string, TeamForecast>;
  calibrated: Map<string, Prediction>;
  suspects: Map<string, Suspect>;
  mode: PipelineMode;
  /** Days the model actually processed in this run. */
  daysRun: number;
  ms: number;
};

type Checkpoint = { day: number; prefix: string; suspects: Map<string, Suspect>; state: StateCheckpoint; calibration: CalibrationCheckpoint };
type Entry = { fingerprint: string; run: PipelineRun; checkpoint: Checkpoint | null };

/** Times are often entered a day or two late: the checkpoint stays this far behind the latest timed day. */
const SLACK_DAYS = 2;
const cache = new Map<string, Entry>();

/* ---------- Fingerprint of the data a run reads ---------- */

/** 53-bit FNV-1a-style hash, fed field by field (no big string is built). */
class Hasher {
  private h1 = 0x811c9dc5;
  private h2 = 0x01000193;
  add(value: string | number | boolean | null | undefined) {
    const text = value == null ? "\u0000" : String(value);
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      this.h1 = Math.imul(this.h1 ^ c, 0x01000193);
      this.h2 = Math.imul(this.h2 ^ c, 0x5bd1e995);
    }
    this.h1 = Math.imul(this.h1 ^ 0x1f, 0x01000193);
    return this;
  }
  digest(): string {
    return `${(this.h1 >>> 0).toString(36)}${(this.h2 >>> 0).toString(36)}`;
  }
}

function hashRow(h: Hasher, row: TrainingRep) {
  h.add(row.log.id).add(row.timeS).add(row.date).add(row.workoutId).add(row.blockId).add(row.segmentIndex).add(row.round).add(row.log.repNumber);
  h.add(row.distanceM).add(row.intensity).add(row.stroke).add(row.gear.join("+")).add(row.course).add(row.fromBlock);
  h.add(row.repInSegment).add(row.segmentReps).add(row.restSeconds).add(row.shift).add(row.trainedEarlierToday).add(row.sleepHours).add(row.gymType).add(row.loadBeforeM);
}

/** Fingerprint of everything a run reads, up to the end of `upTo` (inclusive), or of everything. */
export function teamFingerprint(team: TeamData, upTo = Number.POSITIVE_INFINITY): string {
  return teamFingerprints(team, [upTo])[0];
}

/** Several fingerprints (one per cut-off day) in a single pass over the data. */
export function teamFingerprints(team: TeamData, cuts: number[]): string[] {
  const hashers = cuts.map(() => new Hasher().add(V1_VERSION));
  const workouts = cuts.map(() => new Set<string>());
  const each = (date: string | null, feed: (h: Hasher, i: number) => void) => {
    const day = date == null ? Number.NEGATIVE_INFINITY : dayNumber(date);
    for (let i = 0; i < cuts.length; i += 1) if (day <= cuts[i]) feed(hashers[i], i);
  };
  for (const athleteId of [...team.athletes.keys()].sort()) {
    const meta = team.athletes.get(athleteId)!;
    each(null, (h) => h.add(athleteId).add(meta.dateOfBirth).add(meta.gender).add(meta.primaryStroke));
    for (const entry of meta.wellness ?? []) each(entry.date, (h) => h.add(entry.date).add(entry.sleepHours).add(entry.gym).add(entry.recovery));
    for (const row of team.rows.get(athleteId) ?? []) {
      each(row.date, (h, i) => {
        hashRow(h, row);
        workouts[i].add(row.workoutId);
      });
    }
    for (const [date, value] of team.load.get(athleteId) ?? []) each(date, (h) => h.add(date).add(value.load).add(value.meters).add(value.sessions));
    for (const race of team.races?.get(athleteId) ?? []) each(race.date, (h) => h.add(race.date).add(race.distanceM).add(race.stroke).add(race.course).add(race.timeS));
  }
  const planned = [...(team.planned ?? [])].sort((a, b) => a[0].localeCompare(b[0]));
  return hashers.map((h, i) => {
    for (const [key, reps] of planned) if (workouts[i].has(key.split("|")[0])) h.add(key).add(reps);
    return h.digest();
  });
}

/* ---------- The run ---------- */

function pointOf(raw: Map<string, TeamForecast>): Map<string, Prediction> {
  const out = new Map<string, Prediction>();
  for (const [id, forecast] of raw) {
    out.set(id, {
      mean: forecast.meanS,
      sd: forecast.meanS * forecast.logSd,
      lo: Math.exp(forecast.logMean - Z80 * forecast.logSd),
      hi: Math.exp(forecast.logMean + Z80 * forecast.logSd),
      nominal: 0.8,
      pBreakBy: forecast.pBreakBy,
    });
  }
  return out;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** v1.0 on the team's data, day horizon (what the app shows and records), reusing the last run where it can. */
export function runV1Pipeline(team: TeamData): PipelineRun {
  const started = now();
  const key = [...team.athletes.keys()].sort().join(",");
  const entry = cache.get(key);
  let lastDay: number | null = null;
  for (const rows of team.rows.values()) for (const row of rows) if (!isPlanned(row)) lastDay = Math.max(lastDay ?? Number.NEGATIVE_INFINITY, dayNumber(row.date));
  const checkpointDay = lastDay == null ? null : lastDay - SLACK_DAYS;
  const previous = entry?.checkpoint;
  const fingerprint = teamFingerprint(team);
  if (entry && entry.fingerprint === fingerprint) return { ...entry.run, mode: "cache", daysRun: 0, ms: now() - started };
  // One more pass: the data up to the previous checkpoint, and up to the new one.
  const [previousPrefix, newPrefix] = teamFingerprints(team, [previous?.day ?? Number.NEGATIVE_INFINITY, checkpointDay ?? Number.NEGATIVE_INFINITY]);
  const resume = previous && checkpointDay != null && previous.day <= checkpointDay && previousPrefix === previous.prefix ? previous : null;

  const suspects = resume ? new Map([...resume.suspects, ...teamSuspects(team.rows, { fromDay: resume.day + 1, known: resume.suspects })]) : teamSuspects(team.rows);
  let state: StateCheckpoint | null = null;
  let calibration: CalibrationCheckpoint | null = null;
  const allDays = new Set([...team.rows.values()].flat().map((row) => dayNumber(row.date)));
  const raw = runStateModel(team, HORIZONS.day, V1_OPTIONS, new Set(suspects.keys()), {
    resume: resume?.state,
    ...(checkpointDay != null ? { checkpointAt: checkpointDay, onCheckpoint: (cp: StateCheckpoint) => (state = cp) } : {}),
  });
  const calibrated = calibrateStream(pointOf(raw), team, HORIZONS.day, V1_CALIBRATION, {
    suspects,
    resume: resume?.calibration,
    ...(checkpointDay != null ? { checkpointAt: checkpointDay, onCheckpoint: (cp: CalibrationCheckpoint) => (calibration = cp) } : {}),
  });

  const dayOfLog = new Map([...team.rows.values()].flat().map((row) => [row.log.id, dayNumber(row.date)]));
  const checkpoint: Checkpoint | null =
    checkpointDay != null && state && calibration
      ? {
          day: checkpointDay,
          prefix: newPrefix,
          suspects: new Map([...suspects].filter(([id]) => (dayOfLog.get(id) ?? Number.POSITIVE_INFINITY) <= checkpointDay)),
          state,
          calibration,
        }
      : null;
  const run: PipelineRun = {
    raw,
    calibrated,
    suspects,
    mode: resume ? "resume" : "full",
    daysRun: resume ? [...allDays].filter((day) => day > resume.day).length : allDays.size,
    ms: now() - started,
  };
  cache.set(key, { fingerprint, run, checkpoint });
  // One team at a time in practice; keep the memory bounded anyway.
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return run;
}

/** Forget every cached run (tests; or after signing out). */
export function clearPipelineCache() {
  cache.clear();
}
