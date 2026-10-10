"use client";

import Link from "next/link";
import { useMemo } from "react";
import { INTL_LOCALE } from "@/i18n";
import { useLocale, useT } from "@/i18n/provider";
import { todayIso } from "@/lib/dates";
import { formatDatePt } from "@/lib/labels";
import { sinceLastSession, weekComparison, whoNeedsAttention, type AttentionReason } from "@/lib/morning";
import { formatMeters } from "@/lib/rankings";
import { useAppState } from "@/lib/store";

const SHOWN = 5;

/** "Who needs attention today and why": first thing on the coach's home, answered in a few seconds. */
export function MorningView() {
  const t = useT();
  const locale = INTL_LOCALE[useLocale()];
  const { athletes, workouts, timeLogs } = useAppState();
  const today = todayIso();
  const attention = useMemo(() => whoNeedsAttention(athletes, workouts, timeLogs, today), [athletes, workouts, timeLogs, today]);
  const week = useMemo(() => weekComparison(workouts, timeLogs, today), [workouts, timeLogs, today]);
  const since = useMemo(() => sinceLastSession(workouts, timeLogs, today), [workouts, timeLogs, today]);
  if (!athletes.length) return null;

  const reason = (item: AttentionReason) => {
    switch (item.kind) {
      case "load":
        return {
          why: t("Carga A:C {ratio} ({band})", { ratio: item.ratio.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), band: item.band === "pico" ? t("pico") : t("acima do habitual") }),
          action: t("Rever o volume desta semana"),
        };
      case "noTimes":
        return {
          why: item.days === null ? t("Treina, mas ainda não tem tempos") : t("Sem tempos há {n} dias", { n: item.days }),
          action: t("Cronometrar uma série no próximo treino"),
        };
      case "noWellness":
        return { why: t("Sem registo de bem-estar há {n} dias", { n: item.days }), action: t("Pedir o registo de sono e recuperação") };
      case "lowRecovery":
        return { why: t("Recuperação baixa ({r}/5)", { r: item.recovery }), action: t("Ajustar a intensidade de hoje") };
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby="manha-titulo">
      <h2 id="manha-titulo" className="font-display text-xl font-bold">
        {t("Hoje")}
      </h2>
      <p className="mt-1 text-sm text-mute">
        {since.since
          ? t("Desde o treino de {date}: {n} tempos registados.", { date: formatDatePt(since.since), n: since.times })
          : t("Ainda não há treinos anteriores.")}
      </p>

      <h3 className="mt-4 text-sm font-semibold text-mist">{t("Quem merece atenção")}</h3>
      {attention.length ? (
        <ul className="mt-2 divide-y divide-line">
          {attention.slice(0, SHOWN).map(({ athlete, reasons }) => (
            <li key={athlete.id} className="py-2.5">
              <Link href={`/coach/team/${athlete.id}`} prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-mist hover:text-pool">
                {athlete.name}
              </Link>
              <ul className="space-y-1 text-sm">
                {reasons.map((item) => {
                  const text = reason(item);
                  return (
                    <li key={item.kind}>
                      <span className="text-mist">{text.why}</span>
                      <span className="block text-xs text-mute">→ {text.action}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-mute">{t("Ninguém precisa de atenção especial hoje: cargas no habitual e tempos em dia.")}</p>
      )}
      {attention.length > SHOWN ? <p className="mt-2 text-xs text-mute">{t("+{n} atletas na página da equipa.", { n: attention.length - SHOWN })}</p> : null}

      <h3 className="mt-4 text-sm font-semibold text-mist">{t("Esta semana vs. a anterior (mesmos dias)")}</h3>
      <table className="mt-2 w-full text-sm">
        <caption className="sr-only">{t("Esta semana vs. a anterior (mesmos dias)")}</caption>
        <thead>
          <tr className="text-left text-xs text-mute">
            <th scope="col" className="font-medium"><span className="sr-only">{t("Métrica")}</span></th>
            <th scope="col" className="font-medium">{t("Esta semana")}</th>
            <th scope="col" className="font-medium">{t("Semana anterior")}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <tr>
            <th scope="row" className="py-1 text-left font-normal text-mute">{t("Treinos")}</th>
            <td>{week.current.sessions}</td>
            <td>{week.previous.sessions}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1 text-left font-normal text-mute">{t("Volume")}</th>
            <td>{formatMeters(week.current.meters)}</td>
            <td>{formatMeters(week.previous.meters)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1 text-left font-normal text-mute">{t("Tempos registados")}</th>
            <td>{week.current.times}</td>
            <td>{week.previous.times}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
