/*
 * Runtime switches for the prediction models (no rebuild needed: `wrangler secret put` and the next
 * request sees it).
 *   ML_CHAMPION = "atual" | "estado"  → which model the coach sees; unset = the build's default.
 *                                      Setting it to "atual" is the kill switch: immediate revert.
 *   ML_SHADOW   = "off"              → stop recording the challenger's predictions in shadow.
 *   ML_YEAR_ANCHORS = "on"           → year-ahead forecasts use the seasonal anchors (v1.ts, shadow only).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const value = process.env.ML_CHAMPION;
  const champion = value === "estado" || value === "atual" ? value : null;
  return Response.json({ champion, shadow: process.env.ML_SHADOW !== "off", yearAnchors: process.env.ML_YEAR_ANCHORS === "on" }, { headers: { "cache-control": "no-store" } });
}
