"use client";

import { useMemo } from "react";
import { useSay } from "@/components/analise/coach-text";
import { useT } from "@/i18n/provider";
import {
  bestsKey,
  expectedTimes,
  loadConclusion,
  loadWeeks,
} from "@/lib/coach-analysis";
import { addDays, todayIso } from "@/lib/dates";
import { formatDatePt } from "@/lib/labels";
import { personalRecords } from "@/lib/records";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import type { Athlete } from "@/lib/types";

const one = (x: number | null) =>
  x == null ? "—" : x.toFixed(1).replace(".", ",");

/** "Carga": km per week, how tired, and how far the times were from what they should be — one row per week. */
export function LoadResponse({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs, competitions, meetEntries, meetResults } =
    useAppState();
  const today = todayIso();

  const { weeks, conclusion } = useMemo(() => {
    const wellness = athlete.wellness ?? [];
    // 12 weeks shown + the 42 days each target looks back.
    const from = addDays(today, -(12 * 7 + 42));
    const windowed = workouts.filter((w) => w.date >= addDays(from, -7));
    const rows = annotateTrainingReps(
      windowed,
      timeLogs,
      athlete.id,
      wellness,
    ).filter((r) => isPlausibleRep(r) && r.date >= from);
    const bests = new Map<string, number>();
    for (const r of personalRecords(
      competitions,
      meetEntries,
      meetResults,
      athlete.id,
      athlete.seedRecords,
    )) {
      const s = r.mm * 60 + r.ss + r.cc / 100;
      if (s > 0 && s < (bests.get(bestsKey(r.stroke, r.distanceM)) ?? Infinity))
        bests.set(bestsKey(r.stroke, r.distanceM), s);
    }
    const weeks = loadWeeks(
      workouts,
      wellness,
      rows,
      expectedTimes(rows, bests),
      athlete.id,
      today,
    );
    return { weeks, conclusion: loadConclusion(weeks) };
  }, [
    athlete,
    workouts,
    timeLogs,
    competitions,
    meetEntries,
    meetResults,
    today,
  ]);

  const maxKm = Math.max(1, ...weeks.map((w) => w.km));

  return (
    <section
      className="rounded-2xl border border-line bg-panel p-4 sm:p-5"
      aria-labelledby="carga-titulo"
    >
      <h2 id="carga-titulo" className="font-display text-xl font-bold">
        {t("Carga: como reage este atleta?")}
      </h2>
      {weeks.length ? (
        <p className="mt-2 font-semibold text-mist">{say(conclusion)}</p>
      ) : (
        <p className="mt-2 text-sm text-mute">
          {t("Ainda sem treinos nas últimas 12 semanas.")}
        </p>
      )}
      {weeks.length ? (
        <table className="mt-3 w-full text-[13px] tabular-nums sm:text-sm">
          <caption className="sr-only">
            {t("Carga, cansaço e tempos por semana")}
          </caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="py-1 font-medium">
                {t("Semana")}
              </th>
              <th scope="col" className="py-1 font-medium">
                {t("km")}
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">
                {t("Tempos")}
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">
                {t("Esforço")}
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">
                {t("Sono (h)")}
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week} className="border-t border-line">
                <td className="whitespace-nowrap py-1.5 pr-2">
                  {formatDatePt(w.week).slice(0, 5)}
                </td>
                <td className="pr-2">
                  <span className="flex items-center gap-1.5">
                    <span className="hidden w-10 shrink-0 sm:inline-block" aria-hidden>
                      <span
                        className="block h-2.5 rounded-full bg-aqua"
                        style={{
                          width: `${Math.max(4, (w.km / maxKm) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="text-xs">{one(w.km)}</span>
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap pl-2 text-right font-semibold ${w.vsDuePct == null ? "text-mute" : Math.abs(w.vsDuePct) <= 0.5 ? "text-good" : w.vsDuePct > 0 ? "text-slower" : "text-faster"}`}
                >
                  {w.vsDuePct == null ? (
                    "—"
                  ) : (
                    <>
                      <span aria-hidden>{Math.abs(w.vsDuePct) <= 0.5 ? "✓ " : w.vsDuePct > 0 ? "▼ " : "▲ "}</span>
                      {Math.abs(w.vsDuePct) <= 0.5
                        ? t("dentro do habitual")
                        : w.vsDuePct > 0
                          ? t("{pct} % lento", { pct: one(w.vsDuePct) })
                          : t("{pct} % rápido", { pct: one(-w.vsDuePct) })}
                    </>
                  )}
                </td>
                <td className="pl-2 text-right">{one(w.rpe)}</td>
                <td className="whitespace-nowrap pl-2 text-right">
                  {one(w.sleep)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="mt-2 text-xs text-mute">
        {t(
          "Esforço: 0–10 dito pelo atleta. Tempos: média das reps da semana face ao que costuma fazer em cada uma.",
        )}
      </p>
    </section>
  );
}
