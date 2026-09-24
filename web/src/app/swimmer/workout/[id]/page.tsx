"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, strokeLabel } from "@/lib/labels";
import { formatSet, totalReps } from "@/lib/set";
import { useAppState } from "@/lib/store";
import { formatTime, toCentiseconds } from "@/lib/swim-time";
import { IconBack } from "@/components/ui/icons";

export default function SwimmerWorkoutPage() {
  const params = useParams<{ id: string }>();
  const { athletes, swimmerId, workouts, timeLogs } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId) ?? athletes[0];
  const workout = workouts.find((item) => item.id === params.id) ?? workouts[0];
  const mine = timeLogs.filter((log) => log.athleteId === me?.id && log.workoutId === workout?.id);

  if (!workout || !me) return null;

  return (
    <div className="space-y-4">
      <Link href="/swimmer" className="inline-flex items-center gap-1 text-sm text-mute">
        <IconBack className="h-4 w-4" />
        Voltar
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{workout.title}</h1>
      <p className="text-sm text-mute">
        {SHIFT_LABEL[workout.shift]}
        {workout.course === "scm" || workout.course === "lcm" ? ` · ${COURSE_LABEL[workout.course]}` : ""} · só os teus
        splits
      </p>

      {workout.blocks.map((block) => {
        const logs = [...mine.filter((log) => log.blockId === block.id)].sort((a, b) => a.repNumber - b.repNumber);
        const max = Math.max(...logs.map((log) => toCentiseconds(log.mm, log.ss, log.cc)), 1);
        const min = Math.min(...logs.map((log) => toCentiseconds(log.mm, log.ss, log.cc)), max);
        return (
          <section key={block.id} className="rounded-2xl border border-line bg-panel p-4">
            <h2 className="font-semibold">{BLOCK_LABEL[block.type]}</h2>
            <p className="text-xs text-mute">{formatSet(block)}</p>
            <ol className="mt-3 space-y-2">
              {Array.from({ length: totalReps(block) }, (_, index) => {
                const rep = index + 1;
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
          </section>
        );
      })}
    </div>
  );
}
