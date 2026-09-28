"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, displayTitle, strokeLabel } from "@/lib/labels";
import { formatDistance } from "@/lib/distances";
import { INTENSITY_LABEL, WORKOUT_STROKE_LABEL, flatRepNumber, formatParts, formatSet, needsClockTime, readySegments } from "@/lib/set";
import { useAppState } from "@/lib/store";
import { formatTime } from "@/lib/swim-time";
import type { TimeLog, WorkoutBlock } from "@/lib/types";
import { IconBack } from "@/components/ui/icons";
import { useT } from "@/i18n/provider";
import { HrAttach } from "@/components/heart-rate/hr-attach";
import { HrChart } from "@/components/heart-rate/hr-chart";
import { sessionFor } from "@/lib/heart-rate";

export default function SwimmerWorkoutPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const { athletes, swimmerId, workouts, timeLogs, hrSessions } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId) ?? athletes[0];
  const workout = workouts.find((item) => item.id === params.id) ?? workouts[0];
  const mine = timeLogs.filter((log) => log.athleteId === me?.id && log.workoutId === workout?.id);

  if (!workout || !me) return null;
  const hr = sessionFor(hrSessions, workout.id, me.id);

  return (
    <div className="space-y-4">
      <Link href="/swimmer" className="inline-flex items-center gap-1 text-sm text-mute">
        <IconBack className="h-4 w-4" />
        {t("Voltar")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{displayTitle(workout.title)}</h1>
      <p className="text-sm text-mute">
        {SHIFT_LABEL[workout.shift]}
        {workout.course === "scm" || workout.course === "lcm" ? ` · ${COURSE_LABEL[workout.course]}` : ""} ·{" "}
        {t("só os teus parciais")}
      </p>
      <HrAttach athleteId={me.id} workoutId={workout.id} session={hr} />
      {hr ? <HrChart session={hr} /> : null}

      {workout.blocks.map((block) => (
        <section key={block.id} className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="font-semibold">{BLOCK_LABEL[block.type]}</h2>
          <p className="text-xs text-mute">{formatSet(block)}</p>
          <BlockTimes block={block} logs={mine.filter((log) => log.blockId === block.id)} />
        </section>
      ))}
    </div>
  );
}

/**
 * Each round, each segment, its own small group of rep chips — never one bar comparing times
 * across different distances, and never a row for a rep that was never going to be timed.
 */
function BlockTimes({ block, logs }: { block: WorkoutBlock; logs: TimeLog[] }) {
  const t = useT();
  const segments = readySegments(block);
  const rounds = Math.max(1, block.rounds);
  const logOf = (repNumber: number) => logs.find((log) => log.repNumber === repNumber);

  const groups: { round: number; segment: (typeof segments)[number]; segmentIndex: number; timed: boolean }[] = [];
  const perRoundSegments = segments.reduce<{ segment: (typeof segments)[number]; segmentIndex: number; startInner: number }[]>(
    (acc, segment, segmentIndex) => {
      const startInner = acc.length ? acc[acc.length - 1].startInner + acc[acc.length - 1].segment.reps : 0;
      return [...acc, { segment, segmentIndex, startInner }];
    },
    [],
  );
  const innerReps = perRoundSegments.reduce((sum, item) => sum + item.segment.reps, 0);
  for (let round = 1; round <= rounds; round += 1) {
    for (const { segment, segmentIndex } of perRoundSegments) {
      const timed = segment.parts?.length
        ? segment.parts.some((part) => needsClockTime(part.intensity, block.type))
        : segment.details.some((detail) => needsClockTime(detail.intensity, block.type));
      groups.push({ round, segment, segmentIndex, timed });
    }
  }

  if (!groups.some((group) => group.timed)) {
    return <p className="mt-3 text-xs text-mute">{t("Sem tempos registados nesta série.")}</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {Array.from({ length: rounds }, (_, index) => index + 1).map((round) => {
        const roundGroups = groups.filter((group) => group.round === round && group.timed);
        if (!roundGroups.length) return null;
        return (
          <div key={round} className={rounds > 1 ? "space-y-2 border-l-2 border-line pl-3" : "space-y-2"}>
            {rounds > 1 ? <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Série {n}", { n: round })}</p> : null}
            {roundGroups.map(({ segment, segmentIndex }) => {
              const start = perRoundSegments.find((item) => item.segmentIndex === segmentIndex)!.startInner;
              const stroke = segment.stroke && segment.stroke !== "free" ? WORKOUT_STROKE_LABEL[segment.stroke] : "";
              return (
                <div key={segmentIndex} className="rounded-xl bg-panel-2 p-2.5">
                  <p className="text-xs font-semibold text-mist">
                    {formatDistance(segment.distanceM)}m ·{" "}
                    {segment.parts?.length ? formatParts(segment.parts) : INTENSITY_LABEL[segment.intensity]}
                    {stroke ? ` · ${stroke}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Array.from({ length: segment.reps }, (_, itemIndex) => {
                      const detail = segment.details[itemIndex];
                      const repTimed = segment.parts?.length
                        ? segment.parts.some((part) => needsClockTime(part.intensity, block.type))
                        : detail
                          ? needsClockTime(detail.intensity, block.type)
                          : false;
                      if (!repTimed) return null;
                      const repNumber = flatRepNumber(round, start + itemIndex + 1, innerReps);
                      const log = logOf(repNumber);
                      return (
                        <span
                          key={itemIndex}
                          className="flex min-w-[64px] flex-col items-center rounded-lg border border-line bg-panel px-2 py-1.5"
                        >
                          <span className="text-[9px] text-mute">{itemIndex + 1}</span>
                          <span className="font-mono text-sm font-semibold text-mist">{log ? formatTime(log.mm, log.ss, log.cc) : "—"}</span>
                          {log && strokeLabel(log.stroke) ? <span className="text-[9px] text-mute">{strokeLabel(log.stroke)}</span> : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
