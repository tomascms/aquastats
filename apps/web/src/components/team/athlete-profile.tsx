"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { addDays, todayIso } from "@/lib/dates";
import { fadeIndex } from "@/lib/indicators";
import { formatEvent } from "@/lib/labels";
import { finaPoints } from "@/lib/rankings";
import { personalRecords } from "@/lib/records";
import { athleteSignals } from "@/lib/athlete-signals";
import { SIGNAL_TEXT, UNCERTAINTY } from "@/components/team/signal-text";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import type { Athlete } from "@/lib/types";

/*
 * "Que nadador é e o que treinar agora?" — the athlete's performance profile from recorded times only
 * (docs/natacao/produto-treinador.md §B–C). No model output here.
 */

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m ? `${m}:${rest.toFixed(1).padStart(4, "0")}` : rest.toFixed(1);
};

export function AthleteProfile({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const { workouts, timeLogs, competitions, meetEntries, meetResults, seasonPlans } = useAppState();
  const today = todayIso();

  const profile = useMemo(() => {
    const gender = athlete.gender === "M" || athlete.gender === "F" ? athlete.gender : undefined;
    const records = personalRecords(competitions, meetEntries, meetResults, athlete.id, athlete.seedRecords);
    const timeOf = (r: { mm: number; ss: number; cc: number }) => r.mm * 60 + r.ss + r.cc / 100;
    const best = records
      .map((r) => ({ ...r, timeS: timeOf(r), points: finaPoints(timeOf(r), r.course, r.stroke, r.distanceM, gender) }))
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points)[0];

    const reps = annotateTrainingReps(workouts, timeLogs, athlete.id, athlete.wellness ?? []);
    const from = addDays(today, -14);
    const recent = reps.filter((row) => row.date >= from && row.date <= today && isPlausibleRep(row));

    const sets = new Map<string, number[]>();
    for (const row of recent) if (row.blockType === "main") sets.set(`${row.workoutId}|${row.blockId}|${row.round}`, [...(sets.get(`${row.workoutId}|${row.blockId}|${row.round}`) ?? []), row.timeS]);
    const fades = [...sets.values()].map(fadeIndex).filter((x): x is number => x != null);
    const fade = fades.length ? fades.reduce((a, b) => a + b, 0) / fades.length : null;

    const { signals } = athleteSignals({ athleteId: athlete.id, reps, workouts, competitions, seasonPlans: seasonPlans ?? [], today });
    // How the athlete feels (self-report): last 7 days vs the 21 before; descriptive only (referencias §5, Saw 2016).
    const feel = (key: "rpe" | "recovery" | "sleepHours") => {
      const mean = (from: number, to: number) => {
        const values = (athlete.wellness ?? [])
          .filter((w) => w.date > addDays(today, -from) && w.date <= addDays(today, -to) && w[key] != null)
          .map((w) => Number(w[key]));
        return values.length >= 2 ? { mean: values.reduce((a, b) => a + b, 0) / values.length, n: values.length } : null;
      };
      return { now: mean(7, 0), before: mean(28, 7) };
    };
    const selfReport = { rpe: feel("rpe"), recovery: feel("recovery"), sleep: feel("sleepHours") };
    return { best, fade, nFades: fades.length, signals, selfReport };
  }, [athlete, workouts, timeLogs, competitions, meetEntries, meetResults, seasonPlans, today]);

  const best = profile.best;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby="perfil-titulo">
      <h2 id="perfil-titulo" className="font-display text-2xl font-bold">
        {t("Que nadador é e o que treinar agora?")}
      </h2>
      <p className="mt-1 text-sm text-mute">{t("Calculado só a partir dos tempos registados.")}</p>

      <p className="mt-4">
        <span className="text-xs text-mute">{t("Nível (melhor prova)")}</span>
        <span className="block font-semibold">
          {best ? `${formatEvent(best.distanceM, best.stroke)} ${best.course === "lcm" ? "PL" : "PC"} · ${clock(best.timeS)} · ${best.points} ${t("pontos World Aquatics")}` : "—"}
        </span>
      </p>

      <p className="mt-3 text-sm">
        <span className="text-mute">{t("Queda de ritmo média nas séries principais (14 dias):")}</span>{" "}
        <span className="font-semibold tabular-nums">{profile.fade == null ? "—" : `${profile.fade >= 0 ? "+" : ""}${profile.fade.toFixed(1)} %`}</span>{" "}
        <span className="text-xs text-mute">({t("{n} séries", { n: profile.nFades })})</span>
      </p>

      <h3 className="mt-5 text-sm font-semibold text-mist">{t("Como se sente? Últimos 7 dias vs as 3 semanas antes")}</h3>
      <dl className="mt-1 grid grid-cols-3 gap-3 text-sm">
        {(
          [
            ["rpe", t("Esforço (0–10)"), 1],
            ["recovery", t("Recuperação (1–5)"), 1],
            ["sleep", t("Sono (h)"), 1],
          ] as const
        ).map(([key, label, digits]) => {
          const item = profile.selfReport[key];
          return (
            <div key={key}>
              <dt className="text-xs text-mute">{label}</dt>
              <dd className="font-semibold tabular-nums">
                {item.now ? item.now.mean.toFixed(digits) : "—"}
                {item.now && item.before ? (
                  <span className="ml-1 text-xs font-normal text-mute">
                    ({t("antes")} {item.before.mean.toFixed(digits)})
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      {!profile.selfReport.rpe.now ? <p className="text-xs text-mute">{t("O atleta regista o esforço com 1 toque no calendário de sono e recuperação.")}</p> : null}

      <h3 className="mt-5 text-sm font-semibold text-mist">{t("Sinais de treino")}</h3>
      <p className="text-xs text-mute">{t("Sinais, não ordens: o treinador decide.")}</p>
      {profile.signals.length ? (
        <ul className="mt-2 space-y-3">
          {profile.signals.map((signal) => {
            const text = SIGNAL_TEXT[signal.kind];
            return (
              <li key={signal.kind} className="rounded-xl border border-line p-3">
                <p className="font-semibold">
                  {t(text.title)} <span className="text-xs font-normal text-mute">· {t(UNCERTAINTY[signal.uncertainty])}</span>
                </p>
                <p className="text-sm">
                  <span className="text-mute">{t("Dado:")}</span> {signal.data}
                </p>
                <p className="text-sm">
                  <span className="text-mute">{t("Porquê:")}</span> {t(text.why)}
                </p>
                <p className="text-sm">
                  <span className="text-mute">{t("Alternativa:")}</span> {t(text.alt)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-mute">{t("Nada fora do habitual nos dados registados.")}</p>
      )}
    </section>
  );
}
