"use client";

import { useMemo, useState } from "react";
import { AthleteChips } from "@/components/analise/athlete-chips";
import { VERDICT_CLASS, signedS, swimClock, useSay } from "@/components/analise/coach-text";
import { useT } from "@/i18n/provider";
import { analyzeSession, bestsKey, expectedTimes, verdictOf } from "@/lib/coach-analysis";
import { personalRecords } from "@/lib/records";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import { predictTrainingTargets } from "@/lib/training-prediction";
import type { Athlete, Workout } from "@/lib/types";

/** "Como correu o treino?" — every rep of one athlete: done, predicted, should-do, and a short written read. */
export function SessionAnalysis({ workout, athletes }: { workout: Workout; athletes: Athlete[] }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs, competitions, meetEntries, meetResults } = useAppState();
  const [picked, setPicked] = useState(athletes[0]?.id ?? "");
  const athlete = athletes.find((a) => a.id === picked) ?? athletes[0];

  const workoutId = workout.id;
  const data = useMemo(() => {
    if (!athlete) return null;
    const wellness = athlete.wellness ?? [];
    const rows = annotateTrainingReps(workouts, timeLogs, athlete.id, wellness).filter(isPlausibleRep);
    const bests = new Map<string, number>();
    for (const r of personalRecords(competitions, meetEntries, meetResults, athlete.id, athlete.seedRecords)) {
      const s = r.mm * 60 + r.ss + r.cc / 100;
      const key = bestsKey(r.stroke, r.distanceM);
      if (s > 0 && s < (bests.get(key) ?? Infinity)) bests.set(key, s);
    }
    const expected = expectedTimes(rows, bests);
    const predicted = predictTrainingTargets(rows);
    const mine = rows.filter((r) => r.workoutId === workoutId);
    const sets = new Map<string, typeof mine>();
    for (const r of mine) sets.set(`${r.blockId}|${r.segmentIndex}|${r.round}`, [...(sets.get(`${r.blockId}|${r.segmentIndex}|${r.round}`) ?? []), r]);
    const notes = analyzeSession(mine, expected, { workouts, wellness, athleteId: athlete.id });
    return { sets: [...sets.values()].map((s) => [...s].sort((a, b) => a.repInSegment - b.repInSegment)), expected, predicted, notes };
  }, [athlete, workoutId, workouts, timeLogs, competitions, meetEntries, meetResults]);

  if (!athlete || !data) return null;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="analise-treino">
      <h2 id="analise-treino" className="font-display text-xl font-bold">
        {t("Como correu o treino?")}
      </h2>
      {athletes.length > 1 ? (
        <div className="mt-3">
          <AthleteChips athletes={athletes} selectedId={athlete.id} onSelect={setPicked} />
        </div>
      ) : null}

      {data.sets.length ? (
        <>
          {data.sets.map((set) => {
            const head = set[0];
            return (
              <table key={`${head.blockId}|${head.segmentIndex}|${head.round}`} className="mt-4 w-full text-sm tabular-nums">
                <caption className="pb-1 text-left text-sm font-semibold text-mist">
                  {set.length}×{head.distanceM} {head.intensity}
                  {head.gearLabel ? ` · ${head.gearLabel}` : ""}
                </caption>
                <thead>
                  <tr className="text-left text-xs text-mute">
                    <th scope="col" className="py-1 font-medium">{t("Rep")}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t("Fez")}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t("Previsto")}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t("Devia fazer")}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t("Dif.")}</th>
                  </tr>
                </thead>
                <tbody>
                  {set.map((row) => {
                    const exp = data.expected.get(row.log.id);
                    const pred = data.predicted.get(row.log.id);
                    const verdict = exp ? verdictOf(row.timeS, exp) : null;
                    return (
                      <tr key={row.log.id} className="border-t border-line">
                        <td className="py-1.5">{row.repInSegment}</td>
                        <td className="text-right font-semibold">{swimClock(row.timeS)}</td>
                        <td className="text-right text-mute">{pred ? swimClock(pred.targetS) : "—"}</td>
                        <td className="text-right">{exp ? swimClock(exp.targetS) : "—"}</td>
                        <td className={`text-right font-semibold ${verdict ? VERDICT_CLASS[verdict] : ""}`}>{exp ? signedS(row.timeS - exp.targetS) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })}
          <p className="mt-2 text-xs text-mute">{t("Verde: no tempo devido. Âmbar: mais rápido. Vermelho: mais lento.")}</p>

          <h3 className="mt-4 text-sm font-semibold text-mist">{t("Leitura do treino")}</h3>
          {data.notes.length ? (
            <ul className="mt-1 space-y-2 text-sm">
              {data.notes.map((note, i) => (
                <li key={i}>
                  {say(note.what)}: {note.why.length ? note.why.map(say).join("; ") : t("sem causa clara nos dados")}.
                  {note.fix ? <span className="block text-mute">{say(note.fix)}.</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-mute">{t("Tudo dentro do tempo devido, sem quebras.")}</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-mute">{t("Ainda sem tempos registados para este atleta neste treino.")}</p>
      )}
    </section>
  );
}
