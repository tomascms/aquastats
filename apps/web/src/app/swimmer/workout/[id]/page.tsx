"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, displayTitle, strokeLabel } from "@/lib/labels";
import { flattenInner, formatSet, needsClockTime, splitRepNumber, totalReps } from "@/lib/set";
import { useAppState } from "@/lib/store";
import { formatTime, toCentiseconds } from "@/lib/swim-time";
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

      {workout.blocks.map((block) => {
        // Warm-up, cool-down, and easy (Suave/A1) reps are never timed — no point listing them.
        const inners = flattenInner(block);
        const timedReps = Array.from({ length: totalReps(block) }, (_, index) => index + 1).filter((rep) => {
          const inner = inners[splitRepNumber(rep, inners.length || 1).innerRep - 1];
          return inner ? needsClockTime(inner.intensity, block.type) : false;
        });
        const logs = [...mine.filter((log) => log.blockId === block.id)].sort((a, b) => a.repNumber - b.repNumber);
        const max = Math.max(...logs.map((log) => toCentiseconds(log.mm, log.ss, log.cc)), 1);
        const min = Math.min(...logs.map((log) => toCentiseconds(log.mm, log.ss, log.cc)), max);
        return (
          <section key={block.id} className="rounded-2xl border border-line bg-panel p-4">
            <h2 className="font-semibold">{BLOCK_LABEL[block.type]}</h2>
            <p className="text-xs text-mute">{formatSet(block)}</p>
            {timedReps.length ? (
              <ol className="mt-3 space-y-2">
                {timedReps.map((rep) => {
                  const log = logs.find((item) => item.repNumber === rep);
                  const cs = log ? toCentiseconds(log.mm, log.ss, log.cc) : 0;
                  const width = log ? Math.max(18, ((max - cs + 1) / (max - min + 1)) * 100) : 0;
                  return (
                    <li key={rep} className="flex items-center gap-3">
                      <span className="w-6 font-mono text-xs text-mute">{rep}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink">
                        <div className="h-full rounded-full bg-aqua" style={{ width: log ? `${width}%` : "0%" }} />
                      </div>
                      <span className="w-[128px] text-right font-mono text-sm">
                        {log
                          ? `${formatTime(log.mm, log.ss, log.cc)}${strokeLabel(log.stroke) ? ` · ${strokeLabel(log.stroke)}` : ""}`
                          : "—"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-mute">{t("Sem tempos registados nesta série.")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
