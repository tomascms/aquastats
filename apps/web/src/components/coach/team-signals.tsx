"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { SIGNAL_TEXT, UNCERTAINTY } from "@/components/team/signal-text";
import { athleteSignals } from "@/lib/athlete-signals";
import { addDays, todayIso } from "@/lib/dates";
import { cssOf } from "@/lib/indicators";
import { personalRecords } from "@/lib/records";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps } from "@/lib/training-context";

/*
 * "Hoje": training signals of the whole team (docs/natacao/produto-treinador.md §C), one line per athlete with a
 * signal, linked to the athlete page where the data, reasoning and alternative are shown. Only athletes who trained
 * in the last 14 days are evaluated; the approaching meet is shown once for the team, not per athlete.
 */
const SHOWN = 8;

export function TeamSignals() {
  const t = useT();
  const { athletes, workouts, timeLogs, competitions, meetEntries, meetResults, seasonPlans } = useAppState();
  const today = todayIso();

  const { items, daysToMeet } = useMemo(() => {
    const from = addDays(today, -14);
    const active = new Set(workouts.filter((w) => w.date >= from && w.date <= today).flatMap((w) => w.athleteIds));
    // Nothing older than 26 weeks feeds CSS or signals: bounded cost however long the history is.
    const horizon = addDays(today, -182);
    const recent = workouts.filter((w) => w.date >= horizon && w.date <= today);
    const ids = new Set(recent.map((w) => w.id));
    const recentLogs = timeLogs.filter((log) => ids.has(log.workoutId));
    const results = athletes
      .filter((athlete) => active.has(athlete.id))
      .map((athlete) => {
        const reps = annotateTrainingReps(recent, recentLogs, athlete.id, athlete.wellness ?? []);
        const css = cssOf(reps, personalRecords(competitions, meetEntries, meetResults, athlete.id, athlete.seedRecords), today);
        const result = athleteSignals({ athleteId: athlete.id, reps, css: css?.value ?? null, cssDate: css?.date, workouts: recent, competitions, seasonPlans: seasonPlans ?? [], today });
        return { athlete, daysToMeet: result.daysToMeet, signals: result.signals.filter((s) => s.kind !== "taper" && s.kind !== "sem-dados") };
      });
    const days = results.map((r) => r.daysToMeet).filter((d): d is number => d != null);
    const items = results.filter((r) => r.signals.length).sort((a, b) => b.signals.length - a.signals.length || a.athlete.name.localeCompare(b.athlete.name, "pt", { numeric: true }));
    return { items, daysToMeet: days.length ? Math.min(...days) : null };
  }, [athletes, workouts, timeLogs, competitions, meetEntries, meetResults, seasonPlans, today]);

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby="sinais-equipa-titulo">
      <h2 id="sinais-equipa-titulo" className="font-display text-xl font-bold">
        {t("Que treino a evidência sugere hoje?")}
      </h2>
      <p className="mt-1 text-sm text-mute">{t("Sinais, não ordens: o treinador decide.")}</p>
      {daysToMeet != null && daysToMeet <= 21 ? (
        <p className="mt-3 rounded-xl border border-line p-3 text-sm">
          <span className="font-semibold">{t("Prova a aproximar-se")}</span> · {t("daqui a {n} dias", { n: daysToMeet })}.{" "}
          {t("Um polimento de cerca de 2 semanas, com 41–60 % menos volume e a mesma intensidade, melhora em média 1–3 % (Bosquet 2007; Mujika 2002).")}
        </p>
      ) : null}
      {items.length ? (
        <ul className="mt-2 divide-y divide-line">
          {items.slice(0, SHOWN).map(({ athlete, signals }) => (
            <li key={athlete.id} className="py-2 text-sm">
              <Link href={`/coach/team/${athlete.id}`} className="font-semibold text-pool hover:underline">
                {athlete.name}
              </Link>
              <ul className="mt-0.5 text-mute">
                {signals.map((signal) => (
                  <li key={signal.kind}>
                    {t(SIGNAL_TEXT[signal.kind].title)}: {signal.data} <span className="text-xs">({t(UNCERTAINTY[signal.uncertainty])})</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length > SHOWN ? <p className="mt-1 text-xs text-mute">{t("+{n} atletas com sinais: ver na página de cada atleta.", { n: items.length - SHOWN })}</p> : null}
      {items.length ? null : (
        <p className="mt-2 text-sm text-mute">{t("Nada fora do habitual nos dados registados.")}</p>
      )}
    </section>
  );
}
