import type { Predictor } from "./backtest";
import { calibrated, type CalibrationOptions } from "./calibration";
import { ensemble } from "./ensemble";
import { baselinePredictor, frontierPredictor, lastValuePredictor, levelOnlyPredictor, perAthleteGate, qualityBaselinePredictor, REFERENCE_PREDICTORS, stateModelPredictor } from "./predictors";
import { DEFAULT_OPTIONS, type StateModelOptions } from "./state-model";

const stateModel = stateModelPredictor();
const withContext = stateModelPredictor({ ...DEFAULT_OPTIONS, context: true }, "modelo de estado com contexto");
const withBanister = stateModelPredictor({ ...DEFAULT_OPTIONS, banister: true }, "modelo de estado com Banister");
const seasonal = stateModelPredictor({ ...DEFAULT_OPTIONS, seasonal: true }, "modelo de estado sazonal");
const withFatigue = stateModelPredictor({ ...DEFAULT_OPTIONS, fatigueGrid: true }, "modelo de estado com fadiga individual");
const withCliff = stateModelPredictor({ ...DEFAULT_OPTIONS, fatigueGrid: true, fatigueKeepLinear: true }, "modelo de estado com precipício individual");
const anchors = [stateModelPredictor({ ...DEFAULT_OPTIONS, seasonal: true, seasonalAnchor: 0.3, seasonalAnchorYear: 0.8 }, "modelo de estado sazonal com âncoras")];

/*
 * Final phase (docs/ml/experiments.md): each experiment is the champion of the moment plus one change.
 * ACCEPTED grows only when an experiment passes the pre-registered rules on the development seeds.
 */
export const ACCEPTED: Partial<StateModelOptions> = { primaryStroke: true, races: true, fatigueGrid: true, fatigueNoVolume: true, fatigueMinSets: 0, breakCalibration: [-1.352, 0.472] };
/** Accepted changes to the calibration layer (P2). */
export const ACCEPTED_CALIBRATION: CalibrationOptions = { scale: "model", tails: 4 };
const finalCandidate = (id: string, label: string, change: Partial<StateModelOptions>, calibration: CalibrationOptions = {}) =>
  calibrated(stateModelPredictor({ ...DEFAULT_OPTIONS, ...ACCEPTED, ...change }, `${id} · ${label}`), `${id} · ${label} + qualidade + conformal`, { ...ACCEPTED_CALIBRATION, ...calibration });
export const FINAL_CHAMPION = calibrated(stateModelPredictor({ ...DEFAULT_OPTIONS, ...ACCEPTED }, "campeão da fase final"), "campeão da fase final + qualidade + conformal", ACCEPTED_CALIBRATION);
const FINAL_CANDIDATES = [
  finalCandidate("E1", "Riegel por troços", { riegelPiecewise: true }),
  finalCandidate("E2", "estilo principal", { primaryStroke: true }),
  finalCandidate("E3", "provas como observações", { races: true }),
  finalCandidate("E6", "caudas pesadas (t, ν = 4)", {}, { tails: 4 }),
  finalCandidate("E7", "conformal por maturidade do atleta", {}, { byMaturity: true }),
  finalCandidate("E8", "contexto individual com sinal e atraso", { context: true, contextLagged: true }),
  finalCandidate("E9", "encolhimento local por fator", { factorCusum: true }),
  finalCandidate("E12", "fadiga individual (tentativa única)", { fatigueGrid: true, fatigueNoVolume: true, fatigueMinSets: 0, breakCalibration: [-1.352, 0.472] }),
  finalCandidate("E5", "variâncias re-estimadas", { levelSdPerDay: 0.00112, dayPhi: 0.0525, daySd: 0.0126, sessionSd: 0.00196, repSdAbs: 0.42 }),
];

/** Every predictor the backtest knows, by name. Candidate models are added here as they are built. */
export const PREDICTORS: Predictor[] = [
  ...REFERENCE_PREDICTORS,
  frontierPredictor,
  qualityBaselinePredictor,
  calibrated(baselinePredictor, "modelo atual + conformal"),
  calibrated(qualityBaselinePredictor, "modelo atual + qualidade + conformal"),
  stateModel,
  calibrated(stateModel, "modelo de estado + qualidade + conformal", { scale: "model" }),
  calibrated(stateModel, "modelo de estado + qualidade + conformal relativo"),
  withContext,
  calibrated(withContext, "modelo de estado + contexto + qualidade + conformal", { scale: "model" }),
  withBanister,
  calibrated(withBanister, "modelo de estado + Banister + qualidade + conformal", { scale: "model" }),
  seasonal,
  withFatigue,
  calibrated(withFatigue, "modelo de estado + fadiga individual + qualidade + conformal", { scale: "model" }),
  calibrated(perAthleteGate(stateModel, withFatigue, "modelo de estado com fadiga individual por atleta"), "modelo de estado + fadiga individual por atleta + qualidade + conformal", { scale: "model" }),
  withCliff,
  calibrated(withCliff, "modelo de estado + precipício individual + qualidade + conformal", { scale: "model" }),
  calibrated(seasonal, "modelo de estado sazonal + qualidade + conformal", { scale: "model" }),
  ...anchors.map((p) => calibrated(p, `${p.name} + qualidade + conformal`, { scale: "model" })),
  FINAL_CHAMPION,
  ...FINAL_CANDIDATES,
  ...[1, 5, 20].map((eta) => calibrated(ensemble([stateModel, levelOnlyPredictor, lastValuePredictor], `ensemble η${eta}`, eta), `ensemble η${eta} + conformal`, { scale: "model" })),
];
