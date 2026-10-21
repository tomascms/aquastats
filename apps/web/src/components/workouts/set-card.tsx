"use client";

import { POSITION, PositionLegend, VerdictTag, diffS, swimClock } from "@/components/analise/coach-text";
import { RepChips, SetStory, StateTag, type SetExplain } from "@/components/analise/tempos-reps";
import { useT } from "@/i18n/provider";
import { TE_PRIOR, repPosition } from "@/lib/coach-verdict";
import type { SetSummary } from "@/lib/session-report";
import { INTENSITY_LABEL } from "@/lib/set";
import type { Intensity } from "@/lib/types";
import type { TrainingTarget } from "@/lib/training-prediction";

/**
 * One set as a coach reads it (docs/natacao/benchmark-visualizacao.md D5): title, the verdict against the
 * swimmer's normal, two simple numbers (regularity, end vs start), every rep as a dot against the normal band,
 * and the exact times behind "ver reps".
 */
export function SetCard({ set, predicted, showPredicted = true, openReps = false, explain }: { set: SetSummary; predicted?: Map<string, TrainingTarget>; showPredicted?: boolean; openReps?: boolean; explain?: SetExplain }) {
  const t = useT();
  const easy = set.intensity === "SUAVE";
  const due = set.dueS;
  // Without history, the training prior (coach-verdict TE_PRIOR) keeps "2.ª metade mais lenta" from firing on noise.
  const te = set.te ?? TE_PRIOR * set.meanS;
  // With the coach's explanation shown, these numbers move into the reps' details.
  const numbers = (
    <p className="mt-1 text-sm tabular-nums text-mute">
      {t("Média {time}", { time: swimClock(set.meanS) })}
      {due != null ? ` · ${t("habitual {time}", { time: swimClock(due) })}` : ""}
      {set.reps >= 3 ? ` · ${t("regularidade {s}", { s: diffS(set.spreadS) })}` : ""}
      {set.endDeltaS != null && !easy ? ` · ${set.endDeltaS > te / 2 ? t("no fim {s} mais lento", { s: diffS(set.endDeltaS) }) : set.endDeltaS < -te / 2 ? t("no fim {s} mais rápido", { s: diffS(set.endDeltaS) }) : t("ritmo mantido")}` : ""}
    </p>
  );
  return (
    <article className="rounded-xl border border-line p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="font-semibold text-mist">
          {set.reps}×{set.distanceM} {INTENSITY_LABEL[set.intensity as Intensity] ?? set.intensity}
          {set.gearLabel ? <span className="font-normal text-mute"> · {set.gearLabel}</span> : null}
        </h4>
        {explain ? explain.state ? <StateTag state={explain.state} /> : null : !easy ? <VerdictTag verdict={set.verdict} size="xs" /> : null}
      </header>
      {explain ? null : numbers}
      {explain ? (
        <>
          <RepChips chips={explain.chips} />
          <SetStory explain={explain} />
        </>
      ) : due != null && !easy && set.reps >= 2 ? (
        <RepStrip set={set} />
      ) : null}
      <details className="mt-2" open={openReps}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-pool">{explain ? t("Ver detalhes") : set.reps === 1 ? t("Ver o tempo") : t("Ver as {n} reps", { n: set.reps })}</summary>
        {explain ? numbers : null}
        <table className="mt-1 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="py-1 font-medium">{t("Rep")}</th>
              <th scope="col" className="py-1 text-right font-medium">{t("Fez")}</th>
              {showPredicted ? <th scope="col" className="py-1 text-right font-medium">{t("Previsto")}</th> : null}
              <th scope="col" className="py-1 text-right font-medium">{t("Habitual")}</th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">{t("Dif.")}</th>
            </tr>
          </thead>
          <tbody>
            {set.rows.map((row) => {
              const pred = predicted?.get(row.log.id);
              const pos = due != null ? POSITION[repPosition(row.timeS, due, te)] : null;
              return (
                <tr key={row.log.id} className="border-t border-line">
                  <td className="py-1.5">{row.repInSegment}</td>
                  <td className="text-right font-semibold">{swimClock(row.timeS)}</td>
                  {showPredicted ? <td className="text-right text-mute">{pred ? swimClock(pred.targetS) : "—"}</td> : null}
                  <td className="text-right">{due != null ? swimClock(due) : "—"}</td>
                  <td className={`whitespace-nowrap pl-2 text-right font-semibold ${pos?.className ?? ""}`}>
                    {pos && due != null ? (
                      <>
                        <span aria-hidden>{pos.icon}</span> {diffS(row.timeS - due)}
                        <span className="sr-only"> {t(pos.word)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {due != null ? <div className="mt-1"><PositionLegend /></div> : null}
      </details>
    </article>
  );
}

/** Every rep as a dot; faster is up. The shaded band is this swimmer's normal around the usual time. */
function RepStrip({ set }: { set: SetSummary }) {
  const t = useT();
  const due = set.dueS!;
  const te = set.te ?? 0;
  const times = set.rows.map((r) => r.timeS);
  const lo = Math.min(...times, due - te) - te * 0.5;
  const hi = Math.max(...times, due + te) + te * 0.5;
  const W = 300;
  const H = 56;
  const y = (s: number) => 6 + ((s - lo) / Math.max(hi - lo, 0.01)) * (H - 12);
  const x = (i: number) => (set.reps === 1 ? W / 2 : 10 + (i * (W - 20)) / (set.reps - 1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" role="img" aria-label={t("Cada rep face à faixa normal do atleta; mais rápido fica em cima.")}>
      <rect x={0} y={y(due - te)} width={W} height={Math.max(1, y(due + te) - y(due - te))} className="fill-panel-2" />
      <line x1={0} x2={W} y1={y(due)} y2={y(due)} className="stroke-line-strong" strokeDasharray="4 3" />
      {set.rows.map((row, i) => {
        const pos = repPosition(row.timeS, due, te);
        return (
          <circle
            key={row.log.id}
            cx={x(i)}
            cy={y(row.timeS)}
            r={5}
            className={pos === "faster" ? "fill-faster" : pos === "slower" ? "fill-slower" : "fill-good"}
          />
        );
      })}
    </svg>
  );
}
