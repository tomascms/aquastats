"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { formatDatePt } from "@/lib/labels";
import { FACTORS, METRICS, findings, raceFacts, type FactorKey, type MetricKey } from "@/lib/race-factors";
import type { RaceSession, WellnessEntry, Workout } from "@/lib/types";

const fmt = (value: number | undefined, digits: number) => (value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits));

/**
 * Every race metric of this swim next to the athlete's usual value for the event, the preparation
 * that led to it, and the relationships that repeat across their analysed races.
 */
export function PreparationImpact({
  session,
  sessions,
  workouts,
  wellness,
}: {
  session: RaceSession;
  sessions: RaceSession[];
  workouts: Workout[];
  wellness: WellnessEntry[];
}) {
  const t = useT();
  const sameEvent = useMemo(
    () => sessions.filter((item) => item.stroke === session.stroke && item.distanceM === session.distanceM && item.course === session.course),
    [session, sessions],
  );
  const rows = useMemo(() => raceFacts(sameEvent, workouts, wellness), [sameEvent, wellness, workouts]);
  // Reaction and 15 m say something about the start whatever the event; use all races for those links.
  const allRows = useMemo(() => raceFacts(sessions, workouts, wellness), [sessions, wellness, workouts]);
  const current = rows.find((row) => row.session.id === session.id);
  const others = rows.filter((row) => row.session.id !== session.id);
  const found = useMemo(() => {
    const byEvent = findings(rows);
    const start = findings(allRows).filter((item) => item.metric === "reaction" || item.metric === "flight");
    const seen = new Set(byEvent.map((item) => `${item.metric}:${item.factor}`));
    return [...byEvent, ...start.filter((item) => !seen.has(`${item.metric}:${item.factor}`))].slice(0, 6);
  }, [allRows, rows]);
  if (!current) return null;

  const usual = (key: MetricKey) => {
    const values = others.map((row) => row.metrics[key]).filter((value): value is number => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
  };
  const metricMeta = (key: MetricKey) => METRICS.find((item) => item.key === key)!;
  const factorMeta = (key: FactorKey) => FACTORS.find((item) => item.key === key)!;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="border-b border-line px-5 py-4">
        <h3 className="font-display text-2xl font-bold">{t("Métricas e preparação")}</h3>
        <p className="text-sm text-mute">{t("Cada métrica desta prova face ao habitual do atleta, e o que veio antes dela.")}</p>
      </header>

      <div className="grid gap-0 lg:grid-cols-2">
        <table className="w-full text-sm tabular">
          <thead>
            <tr className="bg-panel-2 text-[11px] font-semibold uppercase tracking-wide text-mute">
              <th className="px-4 py-1.5 text-left">{t("Métrica")}</th>
              <th className="px-2 py-1.5 text-right">{t("Esta prova")}</th>
              <th className="px-2 py-1.5 text-right">{t("Habitual")}</th>
              <th className="px-4 py-1.5 text-right">{t("Dif.")}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.filter((metric) => current.metrics[metric.key] != null).map((metric) => {
              const value = current.metrics[metric.key]!;
              const base = usual(metric.key);
              const diff = base != null ? value - base : undefined;
              const better = diff != null && diff !== 0 ? (metric.lowerIsBetter ? diff < 0 : diff > 0) : null;
              return (
                <tr key={metric.key} className="border-t border-line">
                  <td className="px-4 py-1.5 font-semibold text-mist">{t(metric.label)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {fmt(value, metric.digits)} <span className="text-[10px] text-mute">{metric.unit}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-mute">{fmt(base, metric.digits)}</td>
                  <td className={`px-4 py-1.5 text-right font-mono font-semibold ${better == null ? "text-mute" : better ? "text-good" : "text-coral"}`}>
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(metric.digits)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <table className="w-full border-t border-line text-sm tabular lg:border-l lg:border-t-0">
          <thead>
            <tr className="bg-panel-2 text-[11px] font-semibold uppercase tracking-wide text-mute">
              <th className="px-4 py-1.5 text-left">{t("Preparação")}</th>
              <th className="px-4 py-1.5 text-right">{t("Antes desta prova")}</th>
            </tr>
          </thead>
          <tbody>
            {FACTORS.map((factor) => {
              const value = current.factors[factor.key];
              return (
                <tr key={factor.key} className="border-t border-line">
                  <td className="px-4 py-1.5 text-mist">{t(factor.label)}</td>
                  <td className="px-4 py-1.5 text-right font-mono">
                    {`${fmt(value, factor.digits)} ${value == null ? "" : factor.unit}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line px-5 py-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("O que se repete nas provas deste atleta")}</h4>
        {found.length ? (
          <ul className="mt-2 space-y-1.5 text-sm">
            {found.map((item) => (
              <li key={`${item.metric}-${item.factor}`} className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.helps ? "bg-good" : "bg-coral"}`} />
                <span className="text-mist">
                  {t(item.helps ? "Com mais «{factor}», {metric} foi melhor" : "Com mais «{factor}», {metric} foi pior", {
                    factor: t(factorMeta(item.factor).label).toLowerCase(),
                    metric: t(metricMeta(item.metric).label).toLowerCase(),
                  })}{" "}
                  <span className="text-xs text-mute">{t("(r = {r}, {n} provas)", { r: item.r.toFixed(2), n: item.n })}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mute">
            {t("Ainda poucas provas analisadas para ver padrões fiáveis (precisa de pelo menos 4 com «Adicionar informação» e registo de sono/recuperação).")}
          </p>
        )}
      </div>

      {rows.length > 1 ? (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[1100px] text-xs tabular">
            <thead>
              <tr className="bg-panel-2 text-[10px] font-semibold uppercase tracking-wide text-mute">
                <th className="px-3 py-1.5 text-left">{t("Data")}</th>
                {METRICS.map((metric) => (
                  <th key={metric.key} className="px-2 py-1.5 text-right" title={t(metric.label)}>
                    {t(metric.label).split(" ")[0]}
                  </th>
                ))}
                {FACTORS.map((factor) => (
                  <th key={factor.key} className="border-l border-line px-2 py-1.5 text-right" title={t(factor.label)}>
                    {t(factor.label).split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.session.id} className={`border-t border-line ${row.session.id === session.id ? "bg-pool-soft" : ""}`}>
                  <td className="px-3 py-1.5 font-semibold text-mist">{formatDatePt(row.session.date)}</td>
                  {METRICS.map((metric) => (
                    <td key={metric.key} className="px-2 py-1.5 text-right font-mono">
                      {fmt(row.metrics[metric.key], metric.digits)}
                    </td>
                  ))}
                  {FACTORS.map((factor) => (
                    <td key={factor.key} className="border-l border-line px-2 py-1.5 text-right font-mono text-mute">
                      {fmt(row.factors[factor.key], factor.digits)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
