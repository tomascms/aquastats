"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INTL_LOCALE, type MessageKey } from "@/i18n";
import { useLocale, useT } from "@/i18n/provider";
import { todayIso } from "@/lib/dates";
import { formatDatePt } from "@/lib/labels";
import { periodComparison, sinceLastSession, whoNeedsAttention, type AttentionReason, type Period } from "@/lib/morning";
import { formatMeters } from "@/lib/rankings";
import { useAppState } from "@/lib/store";

const SHOWN = 5;

const PERIODS = [
  { value: "day", label: "Dia", current: "Hoje", previous: "Ontem", title: "Hoje vs. ontem" },
  { value: "week", label: "Semana", current: "Esta semana", previous: "Semana anterior", title: "Esta semana vs. a anterior (mesmos dias)" },
  { value: "month", label: "Mês", current: "Este mês", previous: "Mês anterior", title: "Este mês vs. o anterior (mesmos dias)" },
  { value: "year", label: "Ano", current: "Este ano", previous: "Ano anterior", title: "Este ano vs. o anterior (mesmos dias)" },
] as const satisfies readonly { value: Period; label: MessageKey; current: MessageKey; previous: MessageKey; title: MessageKey }[];

/** "Who needs attention today and why": first thing on the coach's home, answered in a few seconds. */
export function MorningView() {
  const t = useT();
  const locale = INTL_LOCALE[useLocale()];
  const { athletes, workouts, timeLogs, attendance, historyLoaded } = useAppState();
  const today = todayIso();
  const [period, setPeriod] = useState<Period>("week");
  const shown = PERIODS.find((item) => item.value === period) ?? PERIODS[1];
  const attention = useMemo(() => whoNeedsAttention(athletes, workouts, timeLogs, today), [athletes, workouts, timeLogs, today]);
  const week = useMemo(() => periodComparison(workouts, timeLogs, attendance, today, period), [workouts, timeLogs, attendance, today, period]);
  const since = useMemo(() => sinceLastSession(workouts, timeLogs, today), [workouts, timeLogs, today]);
  if (!athletes.length) return null;

  // Observations only: the coach decides what, if anything, to do about them.
  const reason = (item: AttentionReason) => {
    switch (item.kind) {
      case "load":
        return t("Carga A:C {ratio} ({band})", { ratio: item.ratio.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), band: item.band === "pico" ? t("pico") : t("acima do habitual") });
      case "noTimes":
        return item.days === null ? t("Treina, mas ainda não tem tempos") : t("Sem tempos há {n} dias", { n: item.days });
      case "noWellness":
        return t("Sem registo de bem-estar há {n} dias", { n: item.days });
      case "lowRecovery":
        return t("Recuperação baixa ({r}/5)", { r: item.recovery });
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
                {reasons.map((item) => (
                  <li key={item.kind} className="text-mist">
                    {reason(item)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-mute">{t("Ninguém precisa de atenção especial hoje: cargas no habitual e tempos em dia.")}</p>
      )}
      {attention.length > SHOWN ? <p className="mt-2 text-xs text-mute">{t("+{n} atletas na página da equipa.", { n: attention.length - SHOWN })}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-mist">{t(shown.title)}</h3>
        <div role="group" aria-label={t("Período")} className="flex gap-1 rounded-xl border border-line bg-panel p-1">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={item.value === period}
              onClick={() => setPeriod(item.value)}
              className={`min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold transition-colors ${item.value === period ? "bg-mist text-white" : "text-mute hover:text-mist"}`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>
      {/* The month and year before need the older history, which arrives after the first 42 days. */}
      {!historyLoaded && (period === "month" || period === "year") ? (
        <p className="mt-2 text-sm text-mute" role="status">{t("A carregar…")}</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">{t(shown.title)}</caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="font-medium"><span className="sr-only">{t("Métrica")}</span></th>
              <th scope="col" className="font-medium">{t(shown.current)}</th>
              <th scope="col" className="font-medium">{t(shown.previous)}</th>
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
            {week.current.attendance.marked || week.previous.attendance.marked ? (
              <tr>
                <th scope="row" className="py-1 text-left font-normal text-mute">{t("Presenças")}</th>
                <td>{week.current.attendance.marked ? `${week.current.attendance.present}/${week.current.attendance.marked}` : "—"}</td>
                <td>{week.previous.attendance.marked ? `${week.previous.attendance.present}/${week.previous.attendance.marked}` : "—"}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </section>
  );
}
