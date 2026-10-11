"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { addDays, todayIso } from "@/lib/dates";
import { formatDatePt } from "@/lib/labels";
import { acwrBand, dailyLoadPerAthlete, ewmaAcwr } from "@/lib/ml/load-risk";
import { useAppState } from "@/lib/store";
import type { Workout } from "@/lib/types";
import { ACWR_LABEL, ACWR_NOTE } from "./season-planner";

const DAYS = 84;
/** Shaded bands at the thresholds of `acwrBand` (0.8 / 1.3 / 1.5). */
const BANDS = [
  { from: 0, to: 0.8, fill: "#eef0f2" },
  { from: 0.8, to: 1.3, fill: "#e3f4ed" },
  { from: 1.3, to: 1.5, fill: "#fff1d6" },
  { from: 1.5, to: Infinity, fill: "#fdd9d5" },
];

/** Acute:chronic load ratio over the last 12 weeks, with the usual bands shaded. Descriptive only. */
export function AcwrChart({ workouts, title }: { workouts: Workout[]; title: string }) {
  const t = useT();
  const { historyLoaded } = useAppState();
  const today = todayIso();
  const points = useMemo(() => {
    const series = ewmaAcwr(dailyLoadPerAthlete(workouts), today);
    const out: { date: string; ratio: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const ratio = series.get(date)?.ratio;
      if (ratio != null) out.push({ date, ratio });
    }
    return out;
  }, [today, workouts]);

  const width = 620;
  const height = 170;
  const pad = { l: 36, r: 12, t: 10, b: 24 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const top = Math.max(2, ...points.map((point) => point.ratio)) * 1.05;
  const x = (date: string) => pad.l + ((DAYS - 1 - Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)) / (DAYS - 1)) * innerW;
  const y = (value: number) => pad.t + innerH - (Math.min(value, top) / top) * innerH;
  // One row per week (the last day of each week ending today) for the table alternative.
  const weekly = points.filter((point) => Math.round((Date.parse(today) - Date.parse(point.date)) / 86_400_000) % 7 === 0);

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-sm text-mute">{t("Últimas 12 semanas.")} {t(ACWR_NOTE)}</p>
      {!historyLoaded ? (
        <p className="mt-4 text-sm text-mute" role="status">{t("A carregar…")}</p>
      ) : points.length < 2 ? (
        <p className="mt-4 text-sm text-mute">{t("Ainda sem dados suficientes: a relação só aparece depois de 4 semanas de treinos.")}</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={t("Carga A:C por dia, últimas 12 semanas")}>
            {BANDS.map((band) => (
              <rect key={band.from} x={pad.l} width={innerW} y={y(Math.min(band.to, top))} height={y(band.from) - y(Math.min(band.to, top))} fill={band.fill} />
            ))}
            {[0.8, 1.3, 1.5].map((tick) => (
              <text key={tick} x={pad.l - 6} y={y(tick) + 4} textAnchor="end" fill="#56697f" fontSize="11">
                {tick.toFixed(1)}
              </text>
            ))}
            <polyline
              fill="none"
              stroke="#1668b8"
              strokeWidth={2}
              points={points.map((point) => `${x(point.date).toFixed(1)},${y(point.ratio).toFixed(1)}`).join(" ")}
            />
            <text x={pad.l} y={height - 6} fill="#56697f" fontSize="11">
              {formatDatePt(addDays(today, -(DAYS - 1))).slice(0, 5)}
            </text>
            <text x={width - pad.r} y={height - 6} textAnchor="end" fill="#56697f" fontSize="11">
              {formatDatePt(today).slice(0, 5)}
            </text>
          </svg>
          <p className="mt-1 text-xs text-mute">
            {t("Faixas: abaixo de 0,8 {below} · 0,8–1,3 {usual} · 1,3–1,5 {above} · acima de 1,5 {spike}.", {
              below: t(ACWR_LABEL.abaixo),
              usual: t(ACWR_LABEL.habitual),
              above: t(ACWR_LABEL.acima),
              spike: t(ACWR_LABEL.pico),
            })}
          </p>
          <details className="mt-2 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-mute">{t("Ver em tabela")}</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead>
                <tr className="text-left text-xs text-mute">
                  <th scope="col" className="font-medium">{t("Data")}</th>
                  <th scope="col" className="font-medium">{t("Carga A:C")}</th>
                  <th scope="col" className="font-medium">{t("Faixa")}</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((point) => (
                  <tr key={point.date}>
                    <td>{formatDatePt(point.date)}</td>
                    <td>{point.ratio.toFixed(2)}</td>
                    <td>{t(ACWR_LABEL[acwrBand(point.ratio)])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
