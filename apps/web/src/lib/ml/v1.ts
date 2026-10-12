import type { CalibrationOptions } from "./calibration";
import { DEFAULT_OPTIONS, type StateModelOptions } from "./state-model";

/*
 * The frozen challenger, v1.0 (docs/ml/experiments.md): the state model plus every change the final
 * phase accepted on the development seeds — primary stroke (E2), races as observations (E3), Student-t
 * tails (E6), individual in-set fatigue with a cliff and a recalibrated break probability (E12) — and
 * race-time forecasts (E13, races.ts). Changing anything here is a new version.
 */
export const V1_VERSION = "1.0.1";

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

/*
 * Year-ahead forecasts only (user decision, 2026-10-05): the seasonal anchors of phase 6 — "same time
 * last year, adjusted for growth" and the usual summer break foreseen — help a year ahead (3.36 % →
 * 2.63 %) but not a month ahead, so they apply to forecasts ≥ 300 days ahead, in shadow, behind the
 * ML_YEAR_ANCHORS switch (/api/ml-config). Never used for the day horizon the app shows.
 */
export const V1_YEAR_OPTIONS: StateModelOptions = { ...V1_OPTIONS, seasonal: true, seasonalAnchorYear: 0.8 };
