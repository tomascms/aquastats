"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { COURSE_LABEL, GENDER_LABEL, ageFromDob, formatDatePt, formatEvent, initials, strokeLabel } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import { athleteVolumeM, formatMeters, weeklyVolume, workoutMeters } from "@/lib/rankings";
import { personalRecords } from "@/lib/records";
import { formatSet } from "@/lib/set";
import { actions, useAppState } from "@/lib/store";
import { hasClockTime } from "@/lib/swim-time";

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

  const weeks = weeklyVolume(workouts, athlete.id, 10);
  const thisWeek = weeks[weeks.length - 1]?.meters ?? 0;
  const total = athleteVolumeM(workouts, athlete.id);
  const maxWeek = Math.max(...weeks.map((week) => week.meters), 1);
  const raceCount = raceSessions.filter((item) => item.athleteId === athlete.id).length + mineResults.filter((item) => item.result).length;
  const age = ageFromDob(athlete.dateOfBirth);
  const seconds = (mm: number, ss: number, cc: number) => mm * 60 + ss + cc / 100;

  return (
    <div className="space-y-6">
      <Link href="/coach/team" className="text-sm font-semibold text-pool hover:underline">
        ← Equipa
      </Link>

      <section className="overflow-hidden rounded-2xl bg-aqua text-white">
        <div className="flex flex-wrap items-center gap-5 px-6 pb-5 pt-6">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/12 font-display text-3xl font-bold">
            {initials(athlete.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-white">{athlete.name}</h1>
            <p className="mt-1 text-sm text-white/70">
              {[
                strokeLabel(athlete.primaryStroke),
                athlete.gender === "M" || athlete.gender === "F" ? GENDER_LABEL[athlete.gender] : "",
                age != null ? `${age} anos` : "",
              ]
                .filter(Boolean)
                .join(" · ") || "Sem dados de perfil"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/coach/provas?atleta=${athlete.id}`}
              className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-aqua hover:bg-aqua-soft"
            >
              Ver análise
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
              className="min-h-10 rounded-lg border border-white/25 px-4 text-sm font-semibold text-white/85 hover:border-white/60"
            >
              Remover da equipa
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-white/15 sm:grid-cols-4">
          {[
            { label: "Volume total", value: formatMeters(total) },
            { label: "Esta semana", value: formatMeters(thisWeek) },
            { label: "Treinos", value: String(mineWorkouts.length) },
            { label: "Registos de prova", value: String(raceCount) },
          ].map((item) => (
            <div key={item.label} className="border-white/15 px-6 py-4 [&:not(:last-child)]:border-r">
              <dt className="text-xs text-white/65">{item.label}</dt>
              <dd className="font-display text-3xl font-bold tabular">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display text-2xl font-bold">Volume semanal</h2>
          <p className="text-sm text-mute">Últimas 10 semanas.</p>
          <div className="mt-5 flex h-44 items-end gap-2">
            {weeks.map((week, index) => {
              const current = index === weeks.length - 1;
              return (
                <div key={week.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] tabular text-mute">{week.meters ? (week.meters / 1000).toFixed(1) : ""}</span>
                  <div
                    className={`w-full rounded-t-md ${current ? "bg-pool" : week.meters ? "bg-aqua" : "bg-line"}`}
                    style={{ height: `${Math.max(3, (week.meters / maxWeek) * 100)}%` }}
                    title={`${formatDatePt(week.start)} · ${formatMeters(week.meters)}`}
                  />
                  <span className={`text-[11px] tabular ${current ? "font-semibold text-pool" : "text-mute"}`}>
                    {formatDatePt(week.start).slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-mute">Valores em km. A semana atual está destacada.</p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="px-5 pb-3 pt-5">
            <h2 className="font-display text-2xl font-bold">Recordes pessoais</h2>
          </div>
          {records.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute">Ainda não há recordes pessoais.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-xs font-semibold text-mute">
                <tr>
                  <th className="px-5 py-2.5">Prova</th>
                  <th className="px-3 py-2.5">Piscina</th>
                  <th className="px-5 py-2.5 text-right">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={`${record.course}-${record.stroke}-${record.distanceM}`} className="border-t border-line">
                    <td className="px-5 py-3">
                      <span className="font-semibold text-mist">{formatEvent(record.distanceM, record.stroke)}</span>
                      <span className="block text-xs text-mute">{record.date ? formatDatePt(record.date) : "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-mute">{COURSE_LABEL[record.course]}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-display text-2xl font-bold tabular text-mist">
                        {formatRaceClock(seconds(record.mm, record.ss, record.cc))}
                      </span>
                      {record.source === "seed" && record.splits?.length ? (
                        <span className="block text-[11px] text-mute">
                          {record.splits.map((split) => `${split.atM} m ${formatRaceClock(seconds(split.mm, split.ss, split.cc))}`).join(" · ")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <h2 className="px-5 pb-3 pt-5 font-display text-2xl font-bold">Competições</h2>
          {mineResults.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute">Ainda não foi convocado.</p>
          ) : (
            <ul>
              {mineResults.map(({ entry, meet, result }) => (
                <li key={entry.id} className="border-t border-line">
                  <Link
                    href={`/coach/competicoes/${meet?.id}/resultados/${entry.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-panel-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-mist">
                        {formatEvent(entry.distanceM, entry.stroke)} · {meet?.title}
                      </span>
                      <span className="block text-xs text-mute">
                        {formatDatePt(meet?.date ?? "")}
                        {meet ? ` · ${COURSE_LABEL[meet.course]}` : ""}
                      </span>
                    </span>
                    <span className="font-display text-xl font-bold tabular text-mist">
                      {result && hasClockTime(result.mm, result.ss, result.cc)
                        ? formatRaceClock(seconds(result.mm, result.ss, result.cc))
                        : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <h2 className="px-5 pb-3 pt-5 font-display text-2xl font-bold">Treinos</h2>
          {mineWorkouts.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute">Ainda não entrou em nenhum treino.</p>
          ) : (
            <ul className="max-h-[420px] overflow-auto">
              {mineWorkouts.map((workout) => {
                const logs = timeLogs.filter((log) => log.workoutId === workout.id && log.athleteId === athlete.id);
                return (
                  <li key={workout.id} className="border-t border-line">
                    <Link href={`/coach/workouts/${workout.id}`} className="block px-5 py-3 hover:bg-panel-2">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-mist">{workout.title}</span>
                        <span className="font-display text-lg font-bold tabular">{formatMeters(workoutMeters(workout))}</span>
                      </span>
                      <span className="block text-xs text-mute">
                        {formatDatePt(workout.date)} · {logs.length} tempos
                      </span>
                      <span className="mt-1 block truncate text-xs text-sand">{workout.blocks.map((block) => formatSet(block)).join(" · ")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
