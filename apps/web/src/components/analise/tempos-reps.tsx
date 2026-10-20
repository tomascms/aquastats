"use client";

import { useId, useState } from "react";
import { swimClock, useSay } from "@/components/analise/coach-text";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";
import type { Msg } from "@/lib/coach-analysis";
import {
  curveLine,
  gapPct,
  stateOf,
  lastTime,
  readRep,
  sessionLine,
  setsOf,
  type ExplainedRep,
  type LastTime,
  type RepRead,
  type RepState,
  type Who,
} from "@/lib/explained-times";
import type { SetSummary } from "@/lib/session-report";
import type { TrainingRep } from "@/lib/training-context";
import { explainTrainingTargets } from "@/lib/training-prediction";
import type { WellnessEntry } from "@/lib/types";

/** Three states, three colours, nothing else coloured: green faster, grey normal, orange slower than usual. */
export const STATE_CHIP: Record<RepState, string> = {
  faster: "bg-good-soft text-good",
  normal: "bg-panel-2 text-mist",
  slower: "bg-slower-soft text-slower",
};
export const STATE_DOT: Record<RepState, string> = { faster: "bg-good", normal: "bg-line-strong", slower: "bg-slower" };
const NORMAL_FOR: Record<Who, MessageKey> = { F: "normal para ela", M: "normal para ele", "": "normal para o atleta" };

export type ChipRep = { id: string; timeS: number; read: RepRead | null };
export type SetExplain = { state: RepState | null; chips: ChipRep[]; curve: Msg | null; last: LastTime | null };
export type SessionExplain = { who: Who; line: Msg | null; sets: Map<string, SetExplain> };

/** The model's read of one session, per set of the session report (coach only). */
export function explainSession(rows: TrainingRep[], workoutId: string, sets: SetSummary[], wellness: WellnessEntry[], who: Who): SessionExplain {
  const explained = explainTrainingTargets(rows);
  const list: ExplainedRep[] = rows.filter((row) => explained.has(row.log.id)).map((row) => ({ ...explained.get(row.log.id)!, row }));
  const days = new Set(rows.map((row) => row.date));
  const byId = new Map(list.map((rep) => [rep.row.log.id, rep]));
  const history = setsOf(list);
  const out = new Map<string, SetExplain>();
  for (const set of sets) {
    const info = history.find((item) => item.reps.some((rep) => rep.row.log.id === set.rows[0]?.log.id));
    const reps = set.rows.map((row) => byId.get(row.log.id)).filter((rep): rep is ExplainedRep => rep != null);
    out.set(set.key, {
      state: reps.length ? stateOf(reps.reduce((sum, rep) => sum + gapPct(rep), 0) / reps.length) : null,
      chips: set.rows.map((row) => {
        const rep = byId.get(row.log.id);
        return { id: row.log.id, timeS: row.timeS, read: rep ? readRep(rep, days, who) : null };
      }),
      curve: info ? curveLine(info, history) : null,
      last: info && info.reps.length >= 2 ? lastTime(info, history, wellness, days) : null,
    });
  }
  return { who, line: sessionLine(list.filter((rep) => rep.row.workoutId === workoutId), days), sets: out };
}

export function StateLegend({ who }: { who: Who }) {
  const t = useT();
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
      {(
        [
          ["faster", t("mais rápido do que costuma")],
          ["normal", t(NORMAL_FOR[who] ?? NORMAL_FOR[""])],
          ["slower", t("mais lento do que costuma")],
        ] as const
      ).map(([state, label]) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${STATE_DOT[state]}`} />
          {label}
        </span>
      ))}
    </p>
  );
}

/** A. Every time as a chip in its state's colour; hover, focus or tap opens the box with the time and why. */
export function RepChips({ chips }: { chips: ChipRep[] }) {
  const t = useT();
  const say = useSay();
  const [active, setActive] = useState<number | null>(null);
  const box = useId();
  const chip = active != null ? chips[active] : null;
  return (
    <div className="mt-2">
      <div role="group" aria-label={t("Tempos da série")} className="flex flex-wrap gap-1.5">
        {chips.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={active === i}
            aria-controls={box}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold tabular-nums ${item.read ? STATE_CHIP[item.read.state] : "border border-dashed border-line-strong text-mute"} ${active === i ? "ring-2 ring-pool ring-offset-1" : ""}`}
          >
            {swimClock(item.timeS)}
          </button>
        ))}
      </div>
      <div id={box} aria-live="polite" className={chip ? "mt-2 rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm" : "sr-only"}>
        {chip ? (
          <>
            <p className="font-semibold">
              {swimClock(chip.timeS)} · {chip.read ? say(chip.read.line) : t("ainda sem tempos iguais suficientes para comparar")}
            </p>
            {chip.read?.why ? <p className="mt-0.5 text-mist">{say(chip.read.why)}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

const STATE_TEXT: Record<RepState, string> = { faster: "text-good", normal: "text-mist", slower: "text-slower" };
const STATE_WORDS: Record<RepState, MessageKey> = { faster: "mais rápido do que costuma", normal: "dentro do habitual", slower: "mais lento do que costuma" };

/** The set's state in the three colours, in place of the old verdict tag. */
export function StateTag({ state }: { state: RepState }) {
  const t = useT();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${STATE_TEXT[state]}`}>
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${STATE_DOT[state]}`} />
      {t(STATE_WORDS[state])}
    </span>
  );
}

/** E (the curve in one sentence) and B (this time against the last time of the same set). */
export function SetStory({ explain }: { explain: SetExplain }) {
  const t = useT();
  const say = useSay();
  const { curve, last } = explain;
  return (
    <>
      {curve ? <p className="mt-2 text-sm text-mist">{say(curve)}</p> : null}
      {last ? (
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-2.5">
            <span className="text-mute">{t("Esta vez vs a última:")}</span>{" "}
            <span className={`font-semibold ${STATE_TEXT[last.state]}`}>{say(last.title)}</span>
          </summary>
          <ul className="mt-1 flex flex-wrap gap-1.5 tabular-nums" aria-label={t("Rep a rep: a última vez → esta vez")}>
            {last.pairs.map(([before, now], i) => (
              <li key={i} className="rounded-full bg-panel-2 px-2.5 py-1">
                {`${swimClock(before)} → ${swimClock(now)}`}
              </li>
            ))}
          </ul>
          <div className="mt-2 rounded-xl border border-line px-3 py-2">
            <p className="font-semibold">{t("O que foi diferente")}</p>
            {last.changes.length ? (
              <ul className="mt-1 space-y-0.5">
                {last.changes.map((change) => (
                  <li key={change.label}>{t("{label}: {now} (antes {before})", { label: change.label, now: change.b, before: change.a })}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-mute">{t("Nos dados registados, nada mudou entre os dois dias.")}</p>
            )}
            <p className="mt-1 text-xs text-mute">{t("Só dados: não diz o que pesou no resultado.")}</p>
          </div>
        </details>
      ) : null}
    </>
  );
}
