"use client";

import Link from "next/link";
import { useMemo } from "react";
import { VerdictTag, raceClock, useSay } from "@/components/analise/coach-text";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import { vsUsual, type Usual } from "@/lib/coach-verdict";
import { addDays, todayIso } from "@/lib/dates";
import { evolution } from "@/lib/evolution";
import { formatDatePt, formatEvent } from "@/lib/labels";
import { finaPoints, raceRecords, workoutMeters } from "@/lib/rankings";
import { athleteSignals } from "@/lib/athlete-signals";
import { SIGNAL_TEXT, UNCERTAINTY } from "@/components/team/signal-text";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import type { Athlete } from "@/lib/types";

/*
 * The athlete at a glance (docs/natacao/benchmark-visualizacao.md §6): three cards — training, load and
 * tiredness, races — each with a status in words against the swimmer's own normal and a link to the detail.
 * Then the training signals (3 at most). Recorded data only, no model output.
 */

const USUAL_WORD: Record<Usual, MessageKey> = {
  "muito-acima": "muito acima do habitual",
  acima: "acima do habitual",
  habitual: "habitual",
  abaixo: "abaixo do habitual",
  "muito-abaixo": "muito abaixo do habitual",
};
const one = (x: number) => x.toFixed(1).replace(".", ",");
const two = (x: number) => x.toFixed(2).replace(".", ",");

export function AthleteProfile({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions, seasonPlans, historyLoaded } = useAppState();
  const today = todayIso();

  const data = useMemo(() => {
    const gender = athlete.gender === "M" || athlete.gender === "F" ? athlete.gender : undefined;
    const marks = raceRecords(competitions, meetEntries, meetResults, raceSessions ?? [], athlete.id, athlete.seedRecords);
    const best = marks
      .map((r) => ({ ...r, points: finaPoints(r.timeS, r.course, r.stroke, r.distanceM, gender) }))
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points)[0];
    // Latest race and the best mark of the same event before it.
    const last = marks.filter((m) => m.competitionId).sort((a, b) => b.date.localeCompare(a.date))[0];
    const refBest = last
      ? marks.filter((m) => m.id !== last.id && m.stroke === last.stroke && m.distanceM === last.distanceM && m.course === last.course && m.date < last.date).sort((a, b) => a.timeS - b.timeS)[0]
      : undefined;

    // 16 weeks for the training signals; evolution() keeps only the 2 recent + 6 baseline weeks.
    const from = addDays(today, -112);
    const windowed = workouts.filter((w) => w.date >= addDays(from, -7) && w.date <= today);
    const rows = annotateTrainingReps(windowed, timeLogs, athlete.id, athlete.wellness ?? []).filter((r) => isPlausibleRep(r) && r.date >= from);
    const evo = evolution(rows, today);

    // Load and tiredness: the last 7 days against each of the 4 weeks before, for this swimmer.
    const km = (fromDay: number, toDay: number) =>
      workouts.filter((w) => w.athleteIds.includes(athlete.id) && w.date > addDays(today, -fromDay) && w.date <= addDays(today, -toDay)).reduce((a, w) => a + workoutMeters(w), 0) / 1000;
    const weekKm = km(7, 0);
    const pastWeeks = [1, 2, 3, 4].map((i) => km(7 * (i + 1), 7 * i)).filter((x) => x > 0);
    const well = athlete.wellness ?? [];
    const avg = (key: "rpe" | "sleepHours", fromDay: number, toDay: number) => {
      const xs = well.filter((w) => w.date > addDays(today, -fromDay) && w.date <= addDays(today, -toDay) && w[key] != null).map((w) => Number(w[key]));
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const weekly = (key: "rpe" | "sleepHours") => [1, 2, 3, 4].map((i) => avg(key, 7 * (i + 1), 7 * i)).filter((x): x is number => x != null);
    const effort = avg("rpe", 7, 0);
    const sleep = avg("sleepHours", 7, 0);
    const load = {
      weekKm,
      kmUsual: pastWeeks.length >= 3 ? vsUsual(weekKm, pastWeeks) : null,
      effort,
      effortUsual: effort != null ? vsUsual(effort, weekly("rpe")) : null,
      sleep,
      sleepUsual: sleep != null ? vsUsual(sleep, weekly("sleepHours")) : null,
    };

    const { signals } = athleteSignals({ athleteId: athlete.id, reps: rows, workouts, competitions, seasonPlans: seasonPlans ?? [], today });
    return { best, last, refBest, evo, load, signals: signals.filter((s) => s.kind !== "sem-dados").slice(0, 3) };
  }, [athlete, workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions, seasonPlans, today]);

  const { best, last, refBest, evo, load } = data;
  const judged = evo.kinds.filter((k) => k.verdict.dir !== "unclear");
  // The card's status is the most unusual of volume, effort and (short) sleep.
  const states = [load.kmUsual, load.effortUsual, load.sleepUsual === "abaixo" || load.sleepUsual === "muito-abaixo" ? load.sleepUsual : load.sleepUsual ? "habitual" : null];
  const loadState: Usual | null =
    states.find((x) => x === "muito-acima" || x === "muito-abaixo") ?? states.find((x) => x === "acima" || x === "abaixo") ?? (states.some(Boolean) ? "habitual" : null);

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="perfil-titulo">
      <h2 id="perfil-titulo" className="font-display text-2xl font-bold">
        {t("Como está {name}?", { name: athlete.name })}
      </h2>
      <p className="mt-1 text-sm text-mute">
        {t("Nível (melhor prova)")}:{" "}
        <span className="font-semibold text-mist">
          {best ? `${formatEvent(best.distanceM, best.stroke)} ${best.course === "lcm" ? "PL" : "PC"} · ${raceClock(best.timeS)} · ${best.points} ${t("pontos World Aquatics")}` : historyLoaded ? "—" : t("A carregar…")}
        </span>
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-line p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">{t("Treino")}</h3>
          <p className="mt-1 font-semibold text-mist">{say(evo.headline)}</p>
          {judged.slice(0, 3).map((k) => (
            <p key={k.key} className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <span className="text-mist">
                {k.distanceM} {k.intensity}
                {k.gearLabel ? <span className="text-mute"> · {k.gearLabel}</span> : null}
              </span>
              <VerdictTag verdict={k.verdict} size="xs" />
            </p>
          ))}
          <Link href={`/coach/provas/treino?atleta=${athlete.id}&vista=evolucao`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-pool">
            {t("Ver evolução")} →
          </Link>
        </article>

        <article className="rounded-xl border border-line p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">{t("Carga e cansaço")}</h3>
          <p className="mt-1 font-semibold text-mist">{loadState ? t("Esta semana: {state}.", { state: t(USUAL_WORD[loadState]) }) : t("Ainda sem semanas suficientes para comparar.")}</p>
          <dl className="mt-1 space-y-0.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-mute">{t("Volume (7 dias)")}</dt>
              <dd className="text-right tabular-nums">
                {one(load.weekKm)} km{load.kmUsual ? <span className="block text-xs text-mute">{t(USUAL_WORD[load.kmUsual])}</span> : null}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-mute">{t("Esforço (0–10)")}</dt>
              <dd className="text-right tabular-nums">
                {load.effort != null ? one(load.effort) : "—"}
                {load.effortUsual ? <span className="block text-xs text-mute">{t(USUAL_WORD[load.effortUsual])}</span> : null}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-mute">{t("Sono (h)")}</dt>
              <dd className="text-right tabular-nums">
                {load.sleep != null ? one(load.sleep) : "—"}
                {load.sleepUsual ? <span className="block text-xs text-mute">{t(USUAL_WORD[load.sleepUsual])}</span> : null}
              </dd>
            </div>
          </dl>
          <a href="#carga-titulo" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-pool">
            {t("Ver como reage à carga")} ↓
          </a>
        </article>

        <article className="rounded-xl border border-line p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">{t("Provas")}</h3>
          {last ? (
            <>
              <p className="mt-1 font-semibold text-mist">
                {refBest
                  ? last.timeS < refBest.timeS
                    ? t("Última prova: recorde pessoal ({s} s melhor).", { s: two(refBest.timeS - last.timeS) })
                    : t("Última prova: a {s} s do recorde pessoal.", { s: two(last.timeS - refBest.timeS) })
                  : t("Última prova: primeira marca nesta prova.")}
              </p>
              <p className="mt-1 text-sm text-mute">
                {formatEvent(last.distanceM, last.stroke)} · {raceClock(last.timeS)} · {formatDatePt(last.date)}
              </p>
              <Link href={`/coach/provas?atleta=${athlete.id}&registo=${last.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-pool">
                {t("Ver análise da prova")} →
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-mute" role="status">{historyLoaded ? t("Ainda sem provas registadas.") : t("A carregar…")}</p>
          )}
        </article>
      </div>

      {data.signals.length ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-mist">{t("Sinais de treino")}</h3>
          <p className="text-xs text-mute">{t("Sinais, não ordens: o treinador decide.")}</p>
          <ul className="mt-2 space-y-3">
            {data.signals.map((signal) => {
              const text = SIGNAL_TEXT[signal.kind];
              return (
                <li key={signal.kind} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-semibold">
                    {t(text.title)} <span className="text-xs font-normal text-mute">· {t(UNCERTAINTY[signal.uncertainty])}</span>
                  </p>
                  <p>
                    <span className="text-mute">{t("Dado:")}</span> {signal.data}
                  </p>
                  <p>
                    <span className="text-mute">{t("Porquê:")}</span> {t(text.why)}
                  </p>
                  <p>
                    <span className="text-mute">{t("Alternativa:")}</span> {t(text.alt)}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
