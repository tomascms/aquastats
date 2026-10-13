"use client";

import { useMemo } from "react";
import { POSITION, diffS, raceClock, useSay } from "@/components/analise/coach-text";
import { ReportPoints } from "@/components/analise/report-points";
import { useT } from "@/i18n/provider";
import { expectedTimes } from "@/lib/coach-analysis";
import { formatDatePt } from "@/lib/labels";
import { raceReport, type RaceMark } from "@/lib/race-report";
import type { Audience } from "@/lib/session-report";
import type { TrainingRep } from "@/lib/training-context";
import type { RaceSession, WellnessEntry, Workout } from "@/lib/types";

const one = (x: number) => x.toFixed(1).replace(".", ",");

/** Better/worse against a reference time, with icon + word + colour (never colour alone). */
function Delta({ d, digits = 2, noise = 0.1 }: { d: number; digits?: number; noise?: number }) {
  const t = useT();
  // Under 0.1 s a split difference is noise (reaction, touch): shown as equal. The official final time has none.
  // Rounded first: 0.71 − 0.61 is 0.0999… in floating point, yet it is shown as 0,10 s.
  if (Math.abs(Math.round(d * 100) / 100) < noise || d === 0)
    return (
      <span className="whitespace-nowrap font-semibold text-mute">
        <span aria-hidden>=</span> {diffS(d, digits)}
        <span className="sr-only"> {t("igual")}</span>
      </span>
    );
  const pos = d < 0 ? POSITION.faster : POSITION.slower;
  return (
    <span className={`whitespace-nowrap font-semibold ${pos.className}`}>
      <span aria-hidden>{pos.icon}</span> {diffS(d, digits)}
      <span className="sr-only"> {t(pos.word)}</span>
    </span>
  );
}

/** "Porque correu assim?" — the result against the best mark before it, the splits, then why (coach) or one focus (swimmer). */
export function RaceAnalysisPanel({
  mark,
  sameEvent,
  session,
  sessions,
  workouts,
  wellness,
  reps,
  audience = "coach",
}: {
  mark: RaceMark;
  sameEvent: RaceMark[];
  session: RaceSession;
  sessions: RaceSession[];
  workouts: Workout[];
  wellness: WellnessEntry[];
  reps: TrainingRep[];
  audience?: Audience;
}) {
  const t = useT();
  const say = useSay();
  const r = useMemo(
    () => raceReport(mark, sameEvent, session, sessions, workouts, wellness, reps, expectedTimes(reps), audience),
    [mark, sameEvent, session, sessions, workouts, wellness, reps, audience],
  );
  const toneClass = r.tone === "good" ? "border-good" : r.tone === "improve" ? "border-slower" : "border-line-strong";
  const prep = r.prep;
  const trendWord = (p: number) => (Math.abs(p) <= 0.5 ? t("no devido") : p > 0 ? t("{pct} % mais lento", { pct: one(p) }) : t("{pct} % mais rápido", { pct: one(-p) }));

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="prova-analise">
      <h3 id="prova-analise" className="font-display text-xl font-bold">
        {audience === "athlete" ? t("Como correu a tua prova?") : t("Porque correu assim?")}
      </h3>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-3xl font-bold tabular-nums text-mist">{raceClock(mark.timeS)}</span>
        {r.pb ? <span className="rounded-full bg-good px-2 py-0.5 text-xs font-bold text-white">{t("MP")}</span> : null}
        {r.ref && r.deltaS != null ? (
          <span className="text-sm text-mute">
            <Delta d={r.deltaS} noise={0} /> {r.pb ? t("face ao MP anterior ({date})", { date: formatDatePt(r.ref.date) }) : t("face ao MP de {date}", { date: formatDatePt(r.ref.date) })}
            {r.ref.meetTitle ? ` · ${r.ref.meetTitle}` : ""}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 border-l-4 pl-3 font-semibold text-mist ${toneClass}`}>{say(r.headline)}</p>

      <ReportPoints points={r.points} />

      {r.reaction ? (
        <p className="mt-4 text-sm tabular-nums text-mist">
          {t("Reação")}: <span className="font-semibold">{one2(r.reaction.now)} s</span>
          {r.reaction.ref ? (
            <span className="text-mute">
              {" · "}
              {t("No MP")} {one2(r.reaction.ref)} s · <Delta d={r.reaction.now - r.reaction.ref} />
            </span>
          ) : null}
        </p>
      ) : null}

      {r.splits.length ? (
        <>
          <h4 className="mt-4 text-sm font-semibold text-mist">{t("Parciais")}</h4>
          <table className="mt-1 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-mute">
                <th scope="col" className="py-1 font-medium">{t("Parcial")}</th>
                <th scope="col" className="py-1 text-right font-medium">{t("Esta prova")}</th>
                <th scope="col" className="py-1 text-right font-medium">{t("No MP")}</th>
                <th scope="col" className="py-1 pl-2 text-right font-medium">{t("Dif.")}</th>
              </tr>
            </thead>
            <tbody>
              {r.splits.map((s) => (
                <tr key={`${s.fromM}-${s.toM}`} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {s.fromM}–{s.toM} m
                  </th>
                  <td className="text-right font-semibold">{one2(s.thisS)}</td>
                  <td className="text-right text-mute">{s.refS != null ? one2(s.refS) : "—"}</td>
                  <td className="pl-2 text-right">{s.refS != null ? <Delta d={s.thisS - s.refS} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.pacing ? (
            <p className="mt-2 text-sm text-mist">
              {t("Ritmo: 1.ª metade {a} · 2.ª metade {b} (+{d} s)", { a: one2(r.pacing.now.firstS), b: one2(r.pacing.now.secondS), d: one2(r.pacing.now.secondS - r.pacing.now.firstS) })}
              {r.pacing.ref ? (
                <span className="block text-mute">
                  {t("No MP: {a} · {b} (+{d} s)", { a: one2(r.pacing.ref.firstS), b: one2(r.pacing.ref.secondS), d: one2(r.pacing.ref.secondS - r.pacing.ref.firstS) })}
                </span>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}

      {audience === "coach" ? (
        <>
          <h4 className="mt-4 text-sm font-semibold text-mist">{t("Preparação")}</h4>
          <dl className="mt-1 grid gap-3 text-sm sm:grid-cols-2">
            {prep.taper ? (
              <div>
                <dt className="text-xs text-mute">{t("Polimento (2 semanas antes vs as 4 anteriores)")}</dt>
                <dd>
                  <span className={`font-semibold ${prep.taper.verdict === "adequada" ? "text-good" : "text-slower"}`}>
                    <span aria-hidden>{prep.taper.verdict === "adequada" ? "✓ " : "▼ "}</span>
                    {t(prep.taper.verdict === "adequada" ? "adequado" : prep.taper.reductionPct < 0 ? "sem polimento" : prep.taper.verdict === "pouca" ? "curto" : "excessivo")}
                  </span>
                  {" · "}
                  {prep.taper.reductionPct < 0 ? t("volume +{pct} %", { pct: -prep.taper.reductionPct }) : t("volume −{pct} %", { pct: prep.taper.reductionPct })} · {t("trabalho rápido {now} % (antes {before} %)", { now: prep.taper.speedShareNow, before: prep.taper.speedShareBefore })}
                </dd>
              </div>
            ) : null}
            {prep.trend ? (
              <div>
                <dt className="text-xs text-mute">{t("Treinos antes da prova, face ao devido")}</dt>
                <dd>{t("Última semana: {now}; 2 semanas antes: {before}.", { now: trendWord(prep.trend.recentPct), before: trendWord(prep.trend.beforePct) })}</dd>
              </div>
            ) : null}
            {prep.profile ? (
              <div>
                <dt className="text-xs text-mute">{t("Perfil nas 2 semanas antes")}</dt>
                <dd>{t("25/50: {short}. Séries de 200 ou mais: {long}.", { short: trendWord(prep.profile.shortPct), long: trendWord(prep.profile.longPct) })}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-mute">{t("Contexto nas 2 semanas antes")}</dt>
              <dd>
                {prep.context.sleep != null ? t("Sono {h} h por noite", { h: one(prep.context.sleep) }) : t("Sem registo de sono")}
                {prep.context.recovery != null ? ` · ${t("recuperação {r}/5", { r: one(prep.context.recovery) })}` : ""}
                {` · ${t("{n} sessões de ginásio de força", { n: prep.context.gym })}`}
              </dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  );
}

const one2 = (s: number) => (s >= 60 ? raceClock(s) : s.toFixed(2).replace(".", ","));
