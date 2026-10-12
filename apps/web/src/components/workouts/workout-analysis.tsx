"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/provider";
import { cssOf, fadeIndex, intensityAdherence, lcmPaceS100, paceS100, SCM_TO_LCM, zoneTargets, type Adherence } from "@/lib/indicators";
import { personalRecords } from "@/lib/records";
import { formatSet } from "@/lib/set";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import type { Workout } from "@/lib/types";

/*
 * "O treino foi feito ao ritmo pedido?" — per main set and per athlete: pace vs the athlete's zone target (from
 * their CSS), fade within the set and whether the send-off left at least 5 s of rest (docs/natacao/indicadores.md).
 */

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m ? `${m}:${rest.toFixed(1).padStart(4, "0")}` : rest.toFixed(1);
};

const TONE: Record<Adherence, string> = { dentro: "text-[#117a59]", rapido: "text-[#9a6200]", lento: "text-[#b3261e]" };

export function WorkoutAnalysis({ workout }: { workout: Workout }) {
  const t = useT();
  const { athletes, workouts, timeLogs, competitions, meetEntries, meetResults } = useAppState();

  const rows = useMemo(() => {
    return workout.athleteIds.flatMap((athleteId) => {
      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) return [];
      const reps = annotateTrainingReps(workouts, timeLogs, athleteId, athlete.wellness ?? []);
      const css = cssOf(reps, personalRecords(competitions, meetEntries, meetResults, athleteId, athlete.seedRecords), workout.date);
      const targets = new Map((css ? zoneTargets(css.value) : []).map((z) => [z.intensity, z]));
      const mine = reps.filter((row) => row.workoutId === workout.id && isPlausibleRep(row) && row.blockType === "main");
      const byBlock = new Map<string, typeof mine>();
      for (const row of mine) byBlock.set(row.blockId, [...(byBlock.get(row.blockId) ?? []), row]);
      return [...byBlock.entries()].map(([blockId, list]) => {
        const target = targets.get(list[0].intensity);
        const comparable = list.filter((row) => row.stroke === "free" && !row.gear.length);
        const verdict: Record<Adherence, number> = { dentro: 0, rapido: 0, lento: 0 };
        if (target) for (const row of comparable) verdict[intensityAdherence(lcmPaceS100(row), target)] += 1;
        const withSendOff = list.filter((row) => row.restSeconds != null && row.restSeconds > 0);
        const keptSendOff = withSendOff.filter((row) => row.restSeconds! - row.timeS >= 5).length;
        const main = (Object.entries(verdict) as [Adherence, number][]).sort((a, b) => b[1] - a[1])[0];
        return {
          athlete: athlete.name,
          blockId,
          n: list.length,
          pace: list.reduce((sum, row) => sum + paceS100(row), 0) / list.length,
          target: comparable.length ? target : undefined,
          verdict: target && comparable.length ? main[0] : null,
          share: target && comparable.length ? main[1] / comparable.length : null,
          fade: fadeIndex(list.map((row) => row.timeS)),
          sendOff: withSendOff.length ? keptSendOff / withSendOff.length : null,
        };
      });
    });
  }, [workout, athletes, workouts, timeLogs, competitions, meetEntries, meetResults]);

  const blocks = workout.blocks.filter((block) => block.type === "main" && rows.some((row) => row.blockId === block.id));
  if (!blocks.length) return null;
  // Targets are in 50 m pool terms; shown in this workout's pool so they read against the pace column.
  const pool = workout.course === "scm" ? SCM_TO_LCM : 1;
  const judged = rows.filter((row) => row.verdict);
  const onTarget = judged.filter((row) => row.verdict === "dentro").length;
  const label: Record<Adherence, string> = { dentro: t("Dentro"), rapido: t("Rápido"), lento: t("Lento") };

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby="analise-sessao-titulo">
      <h2 id="analise-sessao-titulo" className="font-display text-2xl font-bold">
        {t("O treino foi feito ao ritmo pedido?")}
      </h2>
      <p className="mt-1 text-sm text-mute">
        {judged.length
          ? t("{n} de {total} séries por atleta dentro do alvo da zona (livres sem material).", { n: onTarget, total: judged.length })
          : t("Sem CSS dos atletas ou sem séries de livres sem material: só ritmos e queda.")}
      </p>
      {blocks.map((block) => (
        <div key={block.id} className="mt-4">
          <h3 className="text-sm font-semibold text-mist">{formatSet(block)}</h3>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-xs tabular-nums sm:text-sm">
              <thead className="text-left text-xs text-mute">
                <tr>
                  <th className="py-1 pr-3 font-medium">{t("Atleta")}</th>
                  <th className="py-1 pr-3 font-medium">{t("Ritmo /100 m")}</th>
                  <th className="py-1 pr-3 font-medium">{t("Alvo /100 m")}</th>
                  <th className="py-1 pr-3 font-medium">{t("Intensidade")}</th>
                  <th className="py-1 pr-3 font-medium">{t("Queda")}</th>
                  <th className="py-1 font-medium">{t("Saída cumprida")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows
                  .filter((row) => row.blockId === block.id)
                  .map((row) => (
                    <tr key={row.athlete}>
                      <td className="py-1 pr-3">{row.athlete}</td>
                      <td className="py-1 pr-3">{clock(row.pace)}</td>
                      <td className="py-1 pr-3">{row.target ? `${clock(row.target.fromS100 / pool)}–${clock(row.target.toS100 / pool)}` : "—"}</td>
                      <td className={`py-1 pr-3 font-semibold ${row.verdict ? TONE[row.verdict] : ""}`}>
                        {row.verdict ? `${label[row.verdict]} ${Math.round(row.share! * 100)} %` : "—"}
                      </td>
                      <td className="py-1 pr-3">{row.fade == null ? "—" : `${row.fade >= 0 ? "+" : ""}${row.fade.toFixed(1)} %`}</td>
                      <td className="py-1">{row.sendOff == null ? "—" : `${Math.round(row.sendOff * 100)} %`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="mt-2 text-xs text-mute">
        {t("Alvo = % da velocidade CSS do atleta por zona, em piscina de 50 m (25 m convertidos × 1,03), com 1 s/100 m de tolerância. Saída cumprida = reps com pelo menos 5 s de descanso. Queda = 2.ª metade da série vs 1.ª.")}
      </p>
    </section>
  );
}
