"use client";

import { useMemo } from "react";
import { useSay } from "@/components/analise/coach-text";
import { STATE_CHIP, STATE_DOT } from "@/components/analise/tempos-reps";
import { INTL_LOCALE, type MessageKey } from "@/i18n";
import { useLocale, useT } from "@/i18n/provider";
import { addDays } from "@/lib/dates";
import type { ExplainedRep } from "@/lib/explained-times";
import { formatDatePt, formatEvent } from "@/lib/labels";
import { bestBefore, clock, laps50, leadIn, leadInTags, paceCheck, readSplits, resultLine, trainingForm, vsBest, type Tag, type Tone } from "@/lib/race-story";
import { meetEnd, raceRecords } from "@/lib/rankings";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import { explainTrainingTargets } from "@/lib/training-prediction";
import type { Athlete, Competition, MeetEntry, MeetResult } from "@/lib/types";

const TONE_TEXT: Record<Tone, string> = { faster: "text-good", normal: "text-mist", slower: "text-slower" };
const SPLIT_WORD: Record<Tone, MessageKey> = { faster: "mais rápido do que no recorde", normal: "como no recorde", slower: "mais lento do que no recorde" };

const seconds = (result?: MeetResult) => (result && (result.mm || result.ss || result.cc) ? result.mm * 60 + result.ss + result.cc / 100 : null);

/** One card per swum event: the result in a sentence, how the athlete came in, training vs race, splits, and against the best. */
export function RaceStories({ meet, athlete, entries, results }: { meet: Competition; athlete: Athlete; entries: MeetEntry[]; results: MeetResult[] }) {
  const t = useT();
  const { workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions } = useAppState();

  const stories = useMemo(() => {
    const swum = entries.map((entry) => ({ entry, result: results.find((item) => item.entryId === entry.id) })).filter((item) => seconds(item.result) != null);
    if (!swum.length) return [];
    const wellness = athlete.wellness ?? [];
    const records = raceRecords(competitions, meetEntries, meetResults, raceSessions, athlete.id, athlete.seedRecords);
    // 4 weeks of race-pace training before the meet, plus the 6 weeks the usual times look back on.
    const from = addDays(meet.date, -70);
    const windowed = workouts.filter((workout) => workout.date >= addDays(from, -7) && workout.date <= meetEnd(meet));
    const reps = annotateTrainingReps(windowed, timeLogs, athlete.id, wellness).filter((row) => isPlausibleRep(row) && row.date >= from);
    const explained = explainTrainingTargets(reps);
    const list: ExplainedRep[] = reps.filter((row) => explained.has(row.log.id)).map((row) => ({ ...explained.get(row.log.id)!, row }));
    return swum.map(({ entry, result }) => {
      const date = entry.date ?? meet.date;
      const timeS = seconds(result)!;
      const event = formatEvent(entry.distanceM, entry.stroke);
      const pb = bestBefore(records, entry.stroke, entry.distanceM, meet.course, date, entry.id);
      const here = leadIn(date, athlete.id, workouts, wellness);
      const best =
        records
          .filter((record) => record.stroke === entry.stroke && record.distanceM === entry.distanceM && record.course === meet.course && record.entryId !== entry.id && record.timeS > 0 && record.date)
          .sort((a, b) => a.timeS - b.timeS)[0] ?? null;
      return {
        entry,
        timeS,
        result: resultLine(event, timeS, pb),
        tags: leadInTags(here, trainingForm(list, date)),
        lead: here,
        pace: paceCheck(reps, date, entry.stroke, meet.course, entry.distanceM, timeS),
        splits: readSplits(laps50(result!.splits, entry.distanceM, timeS), pb, entry.distanceM),
        lapsOnly: laps50(result!.splits, entry.distanceM, timeS),
        best: best && best.timeS < timeS ? { record: best, diffs: vsBest(here, leadIn(best.date, athlete.id, workouts, wellness)) } : null,
      };
    });
  }, [meet, athlete, entries, results, workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions]);

  if (!stories.length) return null;
  return (
    <div className="space-y-2 border-t border-line px-4 py-3">
      <p className="text-sm font-semibold text-mist">{t("O que a prova diz do treino")}</p>
      {stories.map((story) => (
        <RaceStory key={story.entry.id} story={story} />
      ))}
      <p className="text-xs text-mute">{t("Factos e comparações dos registos, não causas.")}</p>
    </div>
  );
}

type Story = {
  entry: MeetEntry;
  timeS: number;
  result: ReturnType<typeof resultLine>;
  tags: Tag[];
  lead: ReturnType<typeof leadIn>;
  pace: ReturnType<typeof paceCheck>;
  splits: ReturnType<typeof readSplits>;
  lapsOnly: number[] | null;
  best: { record: { date: string; timeS: number }; diffs: ReturnType<typeof vsBest> } | null;
};

function TagList({ tags }: { tags: Tag[] }) {
  const say = useSay();
  const t = useT();
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag.key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${STATE_CHIP[tag.tone]}`}>
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${STATE_DOT[tag.tone]}`} />
          {say(tag.msg)}
          <span className="sr-only">{t(tag.tone === "faster" ? "(a favor)" : tag.tone === "slower" ? "(contra)" : "(neutro)")}</span>
        </li>
      ))}
    </ul>
  );
}

function RaceStory({ story }: { story: Story }) {
  const t = useT();
  const say = useSay();
  const locale = INTL_LOCALE[useLocale()];
  const { result, pace, splits, best, lead } = story;
  const month = best ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${best.record.date}T12:00:00Z`)) : "";
  return (
    <details className="rounded-xl border border-line bg-panel">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2">
        <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATE_DOT[result.tone]}`} />
        <span className={`font-semibold ${TONE_TEXT[result.tone]}`}>{say(result.msg)}</span>
      </summary>
      <div className="space-y-4 border-t border-line px-3 py-3 text-sm">
        <section>
          <h4 className="font-semibold">{t("Como chegou à prova")}</h4>
          <TagList tags={story.tags} />
        </section>

        <section>
          <h4 className="font-semibold">{t("O treino batia com a prova?")}</h4>
          <p className={`mt-1 ${pace.kind ? TONE_TEXT[pace.tone] : "text-mute"}`}>{say(pace.msg)}</p>
        </section>

        <section>
          <h4 className="font-semibold">{t("Parciais")}</h4>
          {splits ? (
            <>
              <ul className="mt-1.5 flex flex-wrap gap-1.5 tabular-nums" aria-label={t("Cada 50 face ao recorde")}>
                {splits.laps.map((lap, i) => (
                  <li key={i} className={`rounded-full px-3 py-1 font-semibold ${STATE_CHIP[splits.tones[i]]}`}>
                    <span className="mr-1 text-xs font-normal opacity-70">{`${(i + 1) * 50} m`}</span>
                    {clock(lap)}
                    <span className="sr-only"> ({t(SPLIT_WORD[splits.tones[i]])})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-mist">{say(splits.msg)}</p>
            </>
          ) : (
            <p className="mt-1 text-mute">{story.lapsOnly ? t("Sem recorde anterior para comparar os parciais.") : t("Sem parciais registados nesta prova.")}</p>
          )}
        </section>

        <section>
          <h4 className="font-semibold">{best ? t("O que foi diferente do recorde de {month}", { month }) : t("Contra a melhor marca")}</h4>
          {!best ? (
            <p className="mt-1 text-mist">{t("Esta é a melhor marca nesta prova.")}</p>
          ) : best.diffs.length ? (
            <ul className="mt-1 space-y-0.5">
              {best.diffs.map((diff) => (
                <li key={diff.label}>{t("{label}: {now} (no recorde: {before})", { label: t(diff.label), now: diff.now, before: diff.best })}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-mist">{t("Nos dados registados, a preparação foi parecida com a do recorde.")}</p>
          )}
        </section>

        <details className="overflow-x-auto">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-mute">{t("Ver detalhes")}</summary>
          <table className="mt-1 w-full text-[13px] tabular-nums">
            <caption className="sr-only">{t("Números por trás da prova")}</caption>
            <tbody>
              {[
                [t("Tempo"), clock(story.timeS)],
                [t("Volume na semana antes"), `${Math.round(lead.weekKm)} km`],
                [t("Média das 2 semanas antes"), `${Math.round(lead.lastTwoKm)} km/sem.`],
                [t("Média das 4 semanas antes dessas"), `${Math.round(lead.baseKm)} km/sem.`],
                [t("Taper"), `${lead.taperWeeks} sem.`],
                [t("Sono nos 3 dias antes"), lead.sleepH == null ? t("não registado") : `${lead.sleepH.toFixed(1).replace(".", ",")} h`],
                [t("Paragem nas 3 semanas antes"), lead.breakDays ? `${lead.breakDays} d` : "—"],
                [t("Treino: média por 50"), pace.trainingPer50 ? `${clock(pace.trainingPer50)} (${pace.n} reps)` : "—"],
                [t("Prova: média por 50"), clock(pace.racePer50)],
                ...(splits ? splits.laps.map((lap, i) => [`${(i + 1) * 50} m`, `${clock(lap)} · ${splits.refKind === "pb" ? t("recorde") : t("plano")} ${clock(splits.ref[i])}`]) : []),
                ...(best ? [[t("Melhor marca"), `${clock(best.record.timeS)} · ${formatDatePt(best.record.date)}`]] : []),
              ].map(([label, value], i) => (
                <tr key={i} className="border-t border-line">
                  <th scope="row" className="py-1 pr-2 text-left font-normal text-mute">{label}</th>
                  <td className="py-1 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </details>
  );
}
