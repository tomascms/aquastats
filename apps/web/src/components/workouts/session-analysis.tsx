"use client";

import { useEffect, useMemo, useState } from "react";
import { AthleteChips, type ChipMark } from "@/components/analise/athlete-chips";
import { useSay } from "@/components/analise/coach-text";
import { ReportPoints } from "@/components/analise/report-points";
import { SetCard } from "@/components/workouts/set-card";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";
import { bestsKey, expectedTimes } from "@/lib/coach-analysis";
import { addDays } from "@/lib/dates";
import { personalRecords } from "@/lib/records";
import { sessionReport, type Audience, type SessionReport } from "@/lib/session-report";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import { predictTrainingTargets, type TrainingTarget } from "@/lib/training-prediction";
import type { Athlete, Competition, MeetEntry, MeetResult, TimeLog, Workout } from "@/lib/types";

type State = { workouts: Workout[]; timeLogs: TimeLog[]; competitions: Competition[]; meetEntries: MeetEntry[]; meetResults: MeetResult[] };

/** One athlete's session read: report + per-rep model estimate. 90 days before is enough (targets look back 42). */
export function readSession(athlete: Athlete, workout: Workout, state: State, audience: Audience, withPrediction: boolean, days = 90): { report: SessionReport; predicted: Map<string, TrainingTarget> } {
  const wellness = athlete.wellness ?? [];
  const from = addDays(workout.date, -days);
  // Annotation only needs the same week before each rep, so a week of margin is enough.
  const windowed = state.workouts.filter((w) => w.date >= addDays(from, -7) && w.date <= workout.date);
  const rows = annotateTrainingReps(windowed, state.timeLogs, athlete.id, wellness).filter((r) => isPlausibleRep(r) && r.date >= from);
  const bests = new Map<string, number>();
  for (const r of personalRecords(state.competitions, state.meetEntries, state.meetResults, athlete.id, athlete.seedRecords)) {
    const s = r.mm * 60 + r.ss + r.cc / 100;
    const key = bestsKey(r.stroke, r.distanceM);
    if (s > 0 && s < (bests.get(key) ?? Infinity)) bests.set(key, s);
  }
  const expected = expectedTimes(rows, bests);
  const mine = rows.filter((r) => r.workoutId === workout.id);
  return {
    report: sessionReport(mine, expected, { workouts: state.workouts, wellness, athleteId: athlete.id }, audience),
    predicted: withPrediction ? predictTrainingTargets(rows) : new Map(),
  };
}

const TONE_MARK: Record<SessionReport["tone"], { icon: string; className: string; label: MessageKey }> = {
  good: { icon: "✓", className: "text-good", label: "ao nível ou acima do habitual" },
  mixed: { icon: "●", className: "text-mute", label: "misto" },
  improve: { icon: "▼", className: "text-slower", label: "abaixo do habitual ou com quebra" },
  unclear: { icon: "○", className: "text-mute", label: "ainda não dá para dizer" },
};

/** "Como correu o treino?" — verdict, what went well, what to improve, then each set. */
export function SessionAnalysis({ workout, athletes, audience = "coach" }: { workout: Workout; athletes: Athlete[]; audience?: Audience }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs, competitions, meetEntries, meetResults } = useAppState();
  const [picked, setPicked] = useState(athletes[0]?.id ?? "");
  const athlete = athletes.find((a) => a.id === picked) ?? athletes[0];
  const athleteIds = athletes.map((a) => a.id).join(",");

  // The logs of the 97 days before this session, filtered once for every athlete read below.
  const windowLogs = useMemo(() => {
    const from = addDays(workout.date, -97);
    const ids = new Set(workouts.filter((w) => w.date >= from && w.date <= workout.date).map((w) => w.id));
    return timeLogs.filter((log) => ids.has(log.workoutId));
  }, [workout, workouts, timeLogs]);

  const data = useMemo(
    () => (athlete ? readSession(athlete, workout, { workouts, timeLogs: windowLogs, competitions, meetEntries, meetResults }, audience, audience === "coach") : null),
    [athlete, workout, workouts, windowLogs, competitions, meetEntries, meetResults, audience],
  );

  // Each athlete's verdict on the chips, one athlete per tick after the page is shown (no long task).
  const [marks, setMarks] = useState<Map<string, ChipMark>>(new Map());
  useEffect(() => {
    if (audience !== "coach" || athletes.length < 2) return;
    let alive = true;
    const out = new Map<string, ChipMark>();
    const state = { workouts, timeLogs: windowLogs, competitions, meetEntries, meetResults };
    const queue = [...athletes];
    let id = 0;
    const step = () => {
      const next = queue.shift();
      if (!alive || !next) return;
      // 42 days is all the targets need; no model estimate for a chip.
      const { report } = readSession(next, workout, state, "coach", false, 42);
      if (report.sets.length) out.set(next.id, { icon: TONE_MARK[report.tone].icon, className: TONE_MARK[report.tone].className, label: t(TONE_MARK[report.tone].label) });
      setMarks(new Map(out));
      id = window.setTimeout(step, 0);
    };
    id = window.setTimeout(step, 50);
    return () => {
      alive = false;
      clearTimeout(id);
    };
    // athleteIds stands in for `athletes`, a new array on every render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteIds, workout, workouts, windowLogs, competitions, meetEntries, meetResults, audience, t]);

  if (!athlete || !data) return null;
  const { report, predicted } = data;
  const toneClass = report.tone === "good" ? "border-good" : report.tone === "improve" ? "border-slower" : "border-line-strong";

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="analise-treino">
      <h2 id="analise-treino" className="font-display text-xl font-bold">
        {audience === "athlete" ? t("Como correu o teu treino?") : t("Como correu o treino?")}
      </h2>
      {athletes.length > 1 ? (
        <div className="mt-3">
          <AthleteChips athletes={athletes} selectedId={athlete.id} onSelect={setPicked} marks={marks} />
        </div>
      ) : null}

      {report.sets.length ? (
        <>
          <p className={`mt-3 border-l-4 pl-3 text-base font-semibold text-mist ${toneClass}`}>{say(report.headline)}</p>
          <ReportPoints points={report.points} />

          <h3 className="mt-4 text-sm font-semibold text-mist">{t("Série a série")}</h3>
          <p className="text-xs text-mute">
            {audience === "athlete"
              ? t("Devia fazer: a mediana das tuas reps nesta série (mesma distância, zona, material e descanso) nas últimas 6 semanas.")
              : t("Devia fazer: a mediana das reps do atleta nesta série (mesma distância, zona, material e descanso) nas últimas 6 semanas.")}
          </p>
          <div className="mt-2 space-y-2">
            {report.sets.map((set) => (
              <SetCard key={set.key} set={set} predicted={predicted} showPredicted={audience === "coach"} />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-mute">{audience === "athlete" ? t("Ainda sem tempos teus neste treino.") : t("Ainda sem tempos registados para este atleta neste treino.")}</p>
      )}
    </section>
  );
}
