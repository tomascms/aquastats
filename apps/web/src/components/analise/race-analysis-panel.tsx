"use client";

import { useMemo } from "react";
import { signedS, swimClock, useSay } from "@/components/analise/coach-text";
import { useT } from "@/i18n/provider";
import { analyzeRace, expectedTimes } from "@/lib/coach-analysis";
import { formatDatePt } from "@/lib/labels";
import type { TrainingRep } from "@/lib/training-context";
import type { RaceSession, WellnessEntry, Workout } from "@/lib/types";

const one = (x: number) => x.toFixed(1).replace(".", ",");

/** "Porque correu assim?" — race vs personal best, taper, speed in training, profile and context; 3–5 sentences on top. */
export function RaceAnalysisPanel({
  session,
  sessions,
  bestBefore,
  workouts,
  wellness,
  reps,
}: {
  session: RaceSession;
  sessions: RaceSession[];
  /** Best mark of the same event before this race, from the results list (may have no splits). */
  bestBefore: { date: string; timeS: number } | null;
  workouts: Workout[];
  wellness: WellnessEntry[];
  reps: TrainingRep[];
}) {
  const t = useT();
  const say = useSay();
  const a = useMemo(() => analyzeRace(session, sessions, workouts, wellness, reps, expectedTimes(reps), bestBefore), [session, sessions, workouts, wellness, reps, bestBefore]);
  const pctWord = (p: number) => (Math.abs(p) <= 0.5 ? t("no devido") : p > 0 ? t("{pct} % mais lento", { pct: one(p) }) : t("{pct} % mais rápido", { pct: one(-p) }));

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="prova-analise">
      <h3 id="prova-analise" className="font-display text-xl font-bold">
        {t("Porque correu assim?")}
      </h3>
      {a.summary.length ? (
        <ul className="mt-2 space-y-1 font-semibold text-mist">
          {a.summary.map((m, i) => (
            <li key={i}>{say(m)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-mute">{t("Ainda sem dados suficientes antes desta prova.")}</p>
      )}

      {a.vsBest ? (
        <>
          <h4 className="mt-4 text-sm font-semibold text-mist">
            {t("Contra o recorde pessoal ({time}, {date})", { time: swimClock(a.vsBest.bestS), date: formatDatePt(a.vsBest.bestDate) })}
          </h4>
          <table className="mt-1 w-full text-sm tabular-nums">
            <tbody>
              {a.vsBest.reactionS != null ? (
                <tr className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-normal">{t("Reação")}</th>
                  <td className={`text-right font-semibold ${a.vsBest.reactionS > 0 ? "text-coral" : "text-good"}`}>{signedS(a.vsBest.reactionS)}</td>
                </tr>
              ) : null}
              {a.vsBest.gains.map((g) => (
                <tr key={`${g.from}-${g.to}`} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-normal">{g.from}–{g.to} m</th>
                  <td className={`text-right font-semibold ${Math.abs(g.delta) < 0.05 ? "" : g.delta > 0 ? "text-coral" : "text-good"}`}>{signedS(g.delta)}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <th scope="row" className="py-1.5 text-left font-semibold">{t("Total")}</th>
                <td className={`text-right font-bold ${a.vsBest.deltaS > 0 ? "text-coral" : "text-good"}`}>{signedS(a.vsBest.deltaS)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-xs text-mute">{t("Verde: ganhou tempo ao recorde. Vermelho: perdeu.")}</p>
        </>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {a.taper ? (
          <div>
            <dt className="text-xs text-mute">{t("O polimento resultou?")}</dt>
            <dd>
              {t("Volume desceu {pct} %: redução {verdict}.", { pct: a.taper.reductionPct, verdict: t(a.taper.verdict) })}{" "}
              {t("Velocidade (A3 e ritmo de prova): {now} % do volume, antes {before} %.", { now: a.taper.speedShareNow, before: a.taper.speedShareBefore })}
            </dd>
          </div>
        ) : null}
        {a.trend ? (
          <div>
            <dt className="text-xs text-mute">{t("Últimos treinos")}</dt>
            <dd>{t("Última semana: {now}; 2 semanas antes: {before}.", { now: pctWord(a.trend.recentPct), before: pctWord(a.trend.beforePct) })}</dd>
          </div>
        ) : null}
        {a.profile ? (
          <div>
            <dt className="text-xs text-mute">{t("Perfil nas 2 semanas antes")}</dt>
            <dd>{t("25/50: {short}. Séries de 200 ou mais: {long}.", { short: pctWord(a.profile.shortPct), long: pctWord(a.profile.longPct) })}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-mute">{t("Contexto nas 2 semanas antes")}</dt>
          <dd>
            {a.context.sleep != null ? t("Sono {h} h por noite", { h: one(a.context.sleep) }) : t("Sem registo de sono")}
            {a.context.recovery != null ? ` · ${t("recuperação {r}/5", { r: one(a.context.recovery) })}` : ""}
            {` · ${t("{n} sessões de ginásio de força", { n: a.context.gym })}`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
