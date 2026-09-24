"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { COURSE_LABEL, GENDER_LABEL, ageFromDob, formatDatePt, formatEvent, strokeLabel } from "@/lib/labels";
import { athleteVolumeM, formatMeters, weeklyVolume, workoutMeters } from "@/lib/rankings";
import { personalRecords } from "@/lib/records";
import { formatSet } from "@/lib/set";
import { actions, useAppState } from "@/lib/store";
import { formatTime, hasClockTime } from "@/lib/swim-time";

export default function AthletePage() {
  const params = useParams<{ id: string }>();
  const { athletes, workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const athlete = athletes.find((item) => item.id === params.id);
  const router = useRouter();

  const records = useMemo(
    () => personalRecords(competitions, meetEntries, meetResults, athlete?.id, athlete?.seedRecords),
    [athlete?.id, athlete?.seedRecords, competitions, meetEntries, meetResults],
  );
  const mineWorkouts = workouts
    .filter((workout) => athlete && workout.athleteIds.includes(athlete.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const mineResults = meetEntries
    .filter((entry) => entry.athleteId === athlete?.id)
    .map((entry) => {
      const meet = competitions.find((item) => item.id === entry.competitionId);
      const result = meetResults.find((item) => item.entryId === entry.id);
      return { entry, meet, result };
    })
    .filter((item) => item.meet)
    .sort((a, b) => (b.meet?.date ?? "").localeCompare(a.meet?.date ?? ""));

  if (!athlete) {
    return (
      <div className="py-10 text-center text-mute">
        Atleta não encontrado.
        <Link href="/coach/team" className="mt-3 block text-aqua">
          Voltar à equipa
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/coach/team" className="text-sm text-mute">
        ← Equipa
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{athlete.name}</h1>
          <p className="text-sm text-mute">
            {[
              strokeLabel(athlete.primaryStroke),
              athlete.gender === "M" || athlete.gender === "F" ? GENDER_LABEL[athlete.gender] : "",
              ageFromDob(athlete.dateOfBirth) != null ? `${ageFromDob(athlete.dateOfBirth)} anos` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/coach/provas?atleta=${athlete.id}`}
            className="btn-primary h-10"
          >
            Análise
          </Link>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Remover ${athlete.name} da equipa?\n\nPerde acesso à equipa na app, mas o histórico de treinos e provas fica guardado para análises.`,
                )
              ) {
                void actions.removeAthlete(athlete.id).then(() => router.push("/coach/team"));
              }
            }}
            className="btn-ghost h-10 text-coral"
          >
            Remover da equipa
          </button>
        </div>
      </div>

      <section className="card p-4">
        <h2 className="text-lg font-semibold">Volume</h2>
        {(() => {
          const weeks = weeklyVolume(workouts, athlete.id, 8);
          const thisWeek = weeks[weeks.length - 1]?.meters ?? 0;
          const total = athleteVolumeM(workouts, athlete.id);
          const max = Math.max(...weeks.map((week) => week.meters), 1);
          return (
            <>
              <p className="mt-2 text-sm text-mute">
                {formatMeters(total)} acumulados · {formatMeters(thisWeek)} esta semana ·{" "}
                {raceSessions.filter((item) => item.athleteId === athlete.id).length} sessões de prova
              </p>
              <div className="mt-3 flex h-16 items-end gap-1">
                {weeks.map((week) => (
                  <div key={week.start} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-sm bg-aqua/80"
                      style={{ height: `${Math.max(6, (week.meters / max) * 100)}%` }}
                      title={`${week.start} · ${formatMeters(week.meters)}`}
                    />
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-semibold">Recordes pessoais</h2>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Ainda não há recordes pessoais.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {records.map((record) => (
              <li key={`${record.course}-${record.stroke}-${record.distanceM}`} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatEvent(record.distanceM, record.stroke)}</p>
                  <p className="text-[11px] text-mute">
                    {COURSE_LABEL[record.course]} · {record.date ? formatDatePt(record.date) : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg text-aqua">{formatTime(record.mm, record.ss, record.cc)}</p>
                  {record.source === "seed" && record.splits?.length ? (
                    <p className="mt-1 text-[11px] text-mute">
                      {record.splits
                        .map((split) => `${split.atM} m ${formatTime(split.mm, split.ss, split.cc)}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-semibold">Competições</h2>
        {mineResults.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Ainda não foi convocado.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mineResults.map(({ entry, meet, result }) => (
              <li key={entry.id}>
                <Link
                  href={`/coach/competicoes/${meet?.id}/resultados/${entry.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-2 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold">{meet?.title}</p>
                    <p className="text-[11px] text-mute">
                      {formatDatePt(meet?.date ?? "")} · {formatEvent(entry.distanceM, entry.stroke)}
                      {meet ? ` · ${COURSE_LABEL[meet.course]}` : ""}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-mist">
                    {result && hasClockTime(result.mm, result.ss, result.cc)
                      ? formatTime(result.mm, result.ss, result.cc)
                      : "—"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-semibold">Treinos</h2>
        {mineWorkouts.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Ainda não entrou em nenhum treino.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mineWorkouts.map((workout) => {
              const logs = timeLogs.filter((log) => log.workoutId === workout.id && log.athleteId === athlete.id);
              return (
                <li key={workout.id}>
                  <Link href={`/coach/workouts/${workout.id}`} className="block rounded-lg border border-line bg-ink-2 px-3 py-2">
                    <p className="font-semibold">{workout.title}</p>
                    <p className="text-[11px] text-mute">
                      {formatDatePt(workout.date)} · {formatMeters(workoutMeters(workout))} · {logs.length} tempos
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-aqua">
                      {workout.blocks.map((block) => formatSet(block)).join(" · ")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
