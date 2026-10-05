import type { Predictor } from "./backtest";
import { calibrated } from "./calibration";
import { ensemble } from "./ensemble";
import { baselinePredictor, lastValuePredictor, levelOnlyPredictor, qualityBaselinePredictor, REFERENCE_PREDICTORS, stateModelPredictor } from "./predictors";
import { DEFAULT_OPTIONS } from "./state-model";

const stateModel = stateModelPredictor();
const withContext = stateModelPredictor({ ...DEFAULT_OPTIONS, context: true }, "modelo de estado com contexto");
const withBanister = stateModelPredictor({ ...DEFAULT_OPTIONS, banister: true }, "modelo de estado com Banister");
const seasonal = stateModelPredictor({ ...DEFAULT_OPTIONS, seasonal: true }, "modelo de estado sazonal");
const anchors = [stateModelPredictor({ ...DEFAULT_OPTIONS, seasonal: true, seasonalAnchor: 0.3, seasonalAnchorYear: 0.8 }, "modelo de estado sazonal com âncoras")];

/** Every predictor the backtest knows, by name. Candidate models are added here as they are built. */
export const PREDICTORS: Predictor[] = [
  ...REFERENCE_PREDICTORS,
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
  calibrated(seasonal, "modelo de estado sazonal + qualidade + conformal", { scale: "model" }),
  ...anchors.map((p) => calibrated(p, `${p.name} + qualidade + conformal`, { scale: "model" })),
  ...[1, 5, 20].map((eta) => calibrated(ensemble([stateModel, levelOnlyPredictor, lastValuePredictor], `ensemble η${eta}`, eta), `ensemble η${eta} + conformal`, { scale: "model" })),
];
