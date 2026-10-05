import type { CalibrationOptions } from "./calibration";
import { DEFAULT_OPTIONS, type StateModelOptions } from "./state-model";

/*
 * The frozen challenger, v1.0 (docs/ml/experiments.md): the state model plus every change the final
 * phase accepted on the development seeds — primary stroke (E2), races as observations (E3), Student-t
 * tails (E6), individual in-set fatigue with a cliff and a recalibrated break probability (E12) — and
 * race-time forecasts (E13, races.ts). Changing anything here is a new version.
 */
export const V1_VERSION = "1.0";

export const V1_OPTIONS: StateModelOptions = {
  ...DEFAULT_OPTIONS,
  primaryStroke: true,
  races: true,
  fatigueGrid: true,
  fatigueNoVolume: true,
  fatigueMinSets: 0,
  breakCalibration: [-1.352, 0.472],
};

export const V1_CALIBRATION: CalibrationOptions = { scale: "model", tails: 4 };
