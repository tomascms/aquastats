import type { TrainingRep } from "./training-context";
import { statsOf } from "./training-context";

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

function candidates(row: TrainingRep, rows: TrainingRep[], includeTeam: boolean): TrainingRep[] {
  return rows
    .filter((item) => {
      if (item.log.id === row.log.id || item.date > row.date) return false;
      if (!includeTeam && item.log.athleteId !== row.log.athleteId) return false;
      return (
        item.distanceM === row.distanceM &&
        item.segmentReps === row.segmentReps &&
        item.intensity === row.intensity &&
        item.course === row.course &&
        (!row.stroke || item.stroke === row.stroke)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.log.recordedAt.localeCompare(a.log.recordedAt))
    .slice(0, 24);
}

export function predictTrainingTarget(row: TrainingRep, individualRows: TrainingRep[], teamRows: TrainingRep[]): TrainingTarget {
  const individual = candidates(row, individualRows, false);
  const team = candidates(row, teamRows, true).filter((item) => item.log.athleteId !== row.log.athleteId);
  const ownStats = statsOf(individual.map((item) => item.timeS));
  const teamStats = statsOf(team.map((item) => item.timeS));
  const ownWeight = ownStats.n >= 3 ? 0.8 : ownStats.n ? 0.6 : 0;
  const teamWeight = teamStats.n ? 1 - ownWeight : 0;
  const baseTarget = ownWeight * ownStats.mean + teamWeight * teamStats.mean || row.timeS;
  const referenceRows = [...individual, ...team];
  const referenceFatigue = referenceRows.length
    ? referenceRows.reduce((sum, item) => sum + item.fatigue, 0) / referenceRows.length
    : row.fatigue;
  const fatigueAdjustment = Math.max(-0.025, Math.min(0.04, (row.fatigue - referenceFatigue) * 0.0008));
  const target = baseTarget * (1 + fatigueAdjustment);
  const variability = ownStats.n >= 2 ? ownStats.sd : teamStats.n >= 2 ? teamStats.sd : target * 0.025;
  const spread = Math.max(variability * 0.8, target * 0.012);
  const confidence: TargetConfidence = ownStats.n >= 8 ? "alta" : ownStats.n >= 3 ? "média" : teamStats.n >= 5 ? "média" : "baixa";
  const basis = ownStats.n
    ? `${ownStats.n} reps do atleta${teamStats.n ? ` · ${teamStats.n} da equipa` : ""}`
    : teamStats.n
      ? `${teamStats.n} reps da equipa`
      : "Sem histórico equivalente";
  return {
    targetS: target,
    lowS: Math.max(0, target - spread),
    highS: target + spread,
    confidence,
    individualN: ownStats.n,
    teamN: teamStats.n,
    basis,
  };
}

export function predictTrainingTargets(rows: TrainingRep[], teamRows = rows): Map<string, TrainingTarget> {
  return new Map(rows.map((row) => [row.log.id, predictTrainingTarget(row, rows, teamRows)]));
}
