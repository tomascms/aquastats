import { isPlausibleRep, type TrainingRep } from "./training-context";
import type { Intensity } from "./types";

export type TargetConfidence = "alta" | "média" | "baixa";

export type TrainingTarget = {
  targetS: number;
  lowS: number;
  highS: number;
  confidence: TargetConfidence;
  individualN: number;
  teamN: number;
  basis: string;
};

// Pace relative to A3 (aerobic threshold). Used only to translate history across intensities.
const PACE_FACTOR: Record<Intensity, number> = {
  SUAVE: 1.14,
  A1: 1.09,
  A2: 1.045,
  A3: 1,
  PA: 0.965,
  MAX: 0.935,
  P50: 0.94,
  P100: 0.955,
  P200: 0.97,
  P400: 0.985,
};

// Long course carries fewer turns: roughly 2% slower per length-equivalent than short course.
const COURSE_FACTOR = { scm: 1, lcm: 1.02 } as const;
const HALF_LIFE_DAYS = 42;

type Reference = { timeS: number; weight: number; own: boolean };

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`)) / 86_400_000;
}

function courseFactor(course: TrainingRep["course"]): number {
  return course === "lcm" ? COURSE_FACTOR.lcm : COURSE_FACTOR.scm;
}

function reference(row: TrainingRep, item: TrainingRep, own: boolean): Reference | null {
  if (item.log.id === row.log.id || item.date >= row.date) return null;
  if (item.distanceM !== row.distanceM) return null;
  if (row.stroke && item.stroke && item.stroke !== row.stroke) return null;

  let timeS = item.timeS;
  let weight = Math.pow(0.5, daysBetween(item.date, row.date) / HALF_LIFE_DAYS);

  if (item.course !== row.course) {
    timeS *= courseFactor(row.course) / courseFactor(item.course);
    weight *= 0.7;
  }
  if (item.intensity !== row.intensity) {
    timeS *= PACE_FACTOR[row.intensity] / PACE_FACTOR[item.intensity];
    weight *= 0.35;
  }
  if (row.restSeconds != null && item.restSeconds != null && Math.abs(row.restSeconds - item.restSeconds) > 15) {
    weight *= 0.6;
  }
  const repRatio = item.segmentReps / Math.max(1, row.segmentReps);
  if (repRatio < 0.5 || repRatio > 2) weight *= 0.7;
  if (!own) weight *= 0.3;
  return { timeS, weight, own };
}

function weightedMedian(refs: Reference[]): number {
  const sorted = [...refs].sort((a, b) => a.timeS - b.timeS);
  const total = sorted.reduce((sum, ref) => sum + ref.weight, 0);
  let acc = 0;
  for (const ref of sorted) {
    acc += ref.weight;
    if (acc >= total / 2) return ref.timeS;
  }
  return sorted[sorted.length - 1].timeS;
}

function weightedSd(refs: Reference[], center: number): number {
  const total = refs.reduce((sum, ref) => sum + ref.weight, 0);
  if (!total) return 0;
  return Math.sqrt(refs.reduce((sum, ref) => sum + ref.weight * (ref.timeS - center) ** 2, 0) / total);
}

export function predictTrainingTarget(
  row: TrainingRep,
  individualRows: TrainingRep[],
  teamRows: TrainingRep[],
): TrainingTarget | null {
  const own = individualRows
    .filter((item) => item.log.athleteId === row.log.athleteId)
    .map((item) => reference(row, item, true))
    .filter((ref): ref is Reference => Boolean(ref));
  const ownWeight = own.reduce((sum, ref) => sum + ref.weight, 0);

  // Team history only stands in when the athlete has almost nothing comparable.
  const team =
    own.length >= 3
      ? []
      : teamRows
          .filter((item) => item.log.athleteId !== row.log.athleteId)
          .map((item) => reference(row, item, false))
          .filter((ref): ref is Reference => Boolean(ref));

  const refs = [...own, ...team].filter((ref) => ref.weight > 0.01);
  if (!refs.length) return null;

  const center = weightedMedian(refs);
  const references = refs.filter((ref) => ref.own);
  const fatigueRefs = individualRows.filter((item) => item.distanceM === row.distanceM && item.date < row.date);
  const refFatigue = fatigueRefs.length
    ? fatigueRefs.reduce((sum, item) => sum + item.fatigue, 0) / fatigueRefs.length
    : row.fatigue;
  const fatigueAdjustment = Math.max(-0.015, Math.min(0.025, (row.fatigue - refFatigue) * 0.0005));
  const targetS = center * (1 + fatigueAdjustment);
  const spread = Math.max(weightedSd(refs, center), targetS * 0.01);

  const confidence: TargetConfidence =
    references.length >= 8 && ownWeight >= 3 ? "alta" : references.length >= 3 ? "média" : "baixa";
  const basis = references.length
    ? `${references.length} reps do atleta${team.length ? ` · ${team.length} da equipa` : ""}`
    : `${team.length} reps da equipa`;

  return {
    targetS,
    lowS: Math.max(0, targetS - spread),
    highS: targetS + spread,
    confidence,
    individualN: references.length,
    teamN: team.length,
    basis,
  };
}

export function predictTrainingTargets(rows: TrainingRep[], teamRows = rows): Map<string, TrainingTarget> {
  const out = new Map<string, TrainingTarget>();
  const valid = rows.filter(isPlausibleRep);
  const validTeam = teamRows.filter(isPlausibleRep);
  for (const row of valid) {
    const target = predictTrainingTarget(row, valid, validTeam);
    if (target) out.set(row.log.id, target);
  }
  return out;
}
