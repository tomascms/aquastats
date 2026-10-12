"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { addDays, todayIso } from "@/lib/dates";
import { PHASE_BANDS } from "@/lib/indicators";
import { BANDS, phaseOf, planContext, workoutBands, type Band, type PhaseKind } from "@/lib/season";
import { useAppState } from "@/lib/store";

/*
 * "A distribuição de zonas está certa para a fase?" — share of the team's volume per intensity band in the
 * last 4 weeks against the indicative range for the current plan phase (docs/natacao/indicadores.md).
 */
export function ZoneDistribution() {
  const t = useT();
  const { workouts, seasonPlans } = useAppState();
  const today = todayIso();

  const { share, total, phase } = useMemo(() => {
    const from = addDays(today, -28);
    const meters: Record<Band, number> = { easy: 0, aerobic: 0, threshold: 0, high: 0, race: 0 };
    for (const workout of workouts) {
      if (workout.date < from || workout.date > today) continue;
      const { bands } = workoutBands(workout);
      for (const band of Object.keys(meters) as Band[]) meters[band] += bands[band] ?? 0;
    }
    const total = Object.values(meters).reduce((a, b) => a + b, 0);
    const share = Object.fromEntries((Object.keys(meters) as Band[]).map((band) => [band, total ? (meters[band] / total) * 100 : 0])) as Record<Band, number>;
    const phase = (planContext(seasonPlans ?? [], today)?.macro?.type as PhaseKind | undefined) ?? null;
    return { share, total, phase };
  }, [workouts, seasonPlans, today]);

  const ranges = phase ? PHASE_BANDS[phase] : null;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby="zonas-titulo">
      <h2 id="zonas-titulo" className="font-display text-2xl font-bold">
        {t("A distribuição de zonas está certa para a fase?")}
      </h2>
      <p className="mt-1 text-sm text-mute">
        {t("Volume da equipa nas últimas 4 semanas, por zona.")}{" "}
        {phase ? `${t("Fase do plano:")} ${t(phaseOf(phase).label)}.` : t("Sem fase no plano: só a distribuição.")}
      </p>
      {total ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-xs tabular-nums sm:text-sm">
            <thead className="text-left text-xs text-mute">
              <tr>
                <th className="py-1 pr-3 font-medium">{t("Zona")}</th>
                <th className="py-1 pr-3 font-medium">{t("Feito")}</th>
                <th className="py-1 pr-3 font-medium">{t("Referência indicativa")}</th>
                <th className="py-1 font-medium" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {BANDS.map(({ band, label, color }) => {
                const range = ranges?.[band];
                const out = range ? share[band] < range[0] || share[band] > range[1] : false;
                return (
                  <tr key={band}>
                    <td className="py-1 pr-3">{t(label)}</td>
                    <td className={`py-1 pr-3 tabular-nums ${out ? "font-semibold text-[#b3261e]" : ""}`}>{Math.round(share[band])} %</td>
                    <td className="py-1 pr-3 tabular-nums">{range ? `${range[0]}–${range[1]} %` : "—"}</td>
                    <td className="w-1/3 py-1" aria-hidden>
                      <div className="h-2 rounded bg-panel-2">
                        <div className="h-2 rounded" style={{ width: `${Math.min(100, share[band])}%`, background: color }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-mute">{t("Sem treinos nas últimas 4 semanas.")}</p>
      )}
      <p className="mt-2 text-xs text-mute">
        {t("Referência da prática de treino, sem fonte científica verificada: fora do intervalo não é um erro, é algo a confirmar.")}
      </p>
    </section>
  );
}
