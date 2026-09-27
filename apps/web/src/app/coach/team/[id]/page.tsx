"use client";

import Link from "next/link";
import { GoalsPanel } from "@/components/goals/goals-panel";
import { SwimRankingsCard } from "@/components/team/swimrankings-card";
import { WellnessCalendar } from "@/components/wellness/wellness-calendar";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { COURSE_LABEL, GENDER_LABEL, ageFromDob, displayTitle, formatDatePt, formatEvent, initials, strokeLabel } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import { athleteVolumeM, formatMeters, weeklyVolume, workoutMeters } from "@/lib/rankings";
import { personalRecords } from "@/lib/records";
import { formatSet } from "@/lib/set";
import { actions, useAppState } from "@/lib/store";
import { hasClockTime } from "@/lib/swim-time";
import { useT } from "@/i18n/provider";

export default function AthletePage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const { athletes, workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const athlete = athletes.find((item) => item.id === params.id);
  const router = useRouter();
  const [openMeet, setOpenMeet] = useState<string | null>(null);

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
        {t("Atleta não encontrado.")}
        <Link href="/coach/team" className="mt-3 block text-aqua">
          {t("Voltar à equipa")}
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
        ← {t("Equipa")}
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
                age != null ? t("{age} anos", { age }) : "",
              ]
                .filter(Boolean)
                .join(" · ") || t("Sem dados de perfil")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">

              {athlete.gender === "M" || athlete.gender === "F" ? null : (
                <>
                  <span className="text-xs text-white/65">{t("Género")}</span>
                  {(["M", "F"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void actions.coachUpdateAthlete(athlete.id, { gender: value })}
                      className="rounded-md border border-white/30 px-2.5 py-1 text-xs font-semibold text-white/80 transition-colors hover:border-white/70"
                    >
                      {GENDER_LABEL[value]}
                    </button>
                  ))}
                  <span className="text-xs text-[#ffd8a8]">{t("Necessário para calcular os pontos FINA.")}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/coach/provas?atleta=${athlete.id}`}
              className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-aqua hover:bg-aqua-soft"
            >
              {t("Ver análise")}
            </Link>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    t("Remover {name} da equipa?", { name: athlete.name }) +
                      "\n\n" +
                      t("Perde acesso à equipa na app, mas o histórico de treinos e provas fica guardado para análises."),
                  )
                ) {
                  void actions.removeAthlete(athlete.id).then(() => router.push("/coach/team"));
                }
              }}
              className="min-h-10 rounded-lg border border-white/25 px-4 text-sm font-semibold text-white/85 hover:border-white/60"
            >
              {t("Remover da equipa")}
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-white/15 sm:grid-cols-4">
          {[
            { label: t("Volume total"), value: formatMeters(total) },
            { label: t("Esta semana"), value: formatMeters(thisWeek) },
            { label: t("Treinos"), value: String(mineWorkouts.length) },
            { label: t("Registos de prova"), value: String(raceCount) },
          ].map((item) => (
            <div key={item.label} className="border-white/15 px-6 py-4 [&:not(:last-child)]:border-r">
              <dt className="text-xs text-white/65">{item.label}</dt>
              <dd className="font-display text-3xl font-bold tabular">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SwimRankingsCard athlete={athlete} role="coach" />

      <WellnessCalendar athlete={athlete} editable={false} />

      <GoalsPanel athleteId={athlete.id} role="coach" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display text-2xl font-bold">{t("Volume semanal")}</h2>
          <p className="text-sm text-mute">{t("Últimas 10 semanas.")}</p>
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
          <p className="mt-2 text-xs text-mute">{t("Valores em km. A semana atual está destacada.")}</p>
        </section>


      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <h2 className="px-5 pb-3 pt-5 font-display text-2xl font-bold">{t("Competições")}</h2>
          {mineResults.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute">{t("Ainda não foi convocado.")}</p>
          ) : (
            <ul>
              {[...new Map(mineResults.map((item) => [item.meet!.id, item.meet!])).values()].map((meet) => {
                const rows = mineResults.filter((item) => item.meet?.id === meet.id);
                const open = openMeet === meet.id;
                return (
                  <li key={meet.id} className="border-t border-line">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenMeet(open ? null : meet.id)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-panel-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-mist">{meet.title}</span>
                        <span className="block text-xs text-mute">
                          {formatDatePt(meet.date)} · {COURSE_LABEL[meet.course]} · {t("{count} provas", { count: rows.length })}
                        </span>
                      </span>
                      <span className="text-mute">{open ? "▾" : "▸"}</span>
                    </button>
                    {open ? (
                      <table className="w-full text-sm tabular">
                        <tbody>
                          {rows.map(({ entry, result }) => {
                            const final = result?.swims?.final ?? result?.swims?.heat;
                            return (
                              <tr key={entry.id} className="border-t border-line bg-panel-2/50">
                                <td className="px-5 py-2 font-semibold text-mist">{formatEvent(entry.distanceM, entry.stroke)}</td>
                                <td className="px-2 py-2 text-right text-xs text-mute">{final?.place ? `${final.place}.º ${final.category ?? ""}` : ""}</td>
                                <td className="px-2 py-2 text-right font-display text-lg font-bold">
                                  {result && hasClockTime(result.mm, result.ss, result.cc) ? formatRaceClock(seconds(result.mm, result.ss, result.cc)) : "—"}
                                </td>
                                <td className="px-5 py-2 text-right text-xs font-semibold">
                                  <Link href={`/coach/competicoes/${meet.id}/resultados/${entry.id}`} className="text-pool hover:underline">
                                    {t("Detalhes")}
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <h2 className="px-5 pb-3 pt-5 font-display text-2xl font-bold">{t("Treinos")}</h2>
          {mineWorkouts.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute">{t("Ainda não entrou em nenhum treino.")}</p>
          ) : (
            <ul className="max-h-[420px] overflow-auto">
              {mineWorkouts.map((workout) => {
                const logs = timeLogs.filter((log) => log.workoutId === workout.id && log.athleteId === athlete.id);
                return (
                  <li key={workout.id} className="border-t border-line">
                    <Link href={`/coach/workouts/${workout.id}`} className="block px-5 py-3 hover:bg-panel-2">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-mist">{displayTitle(workout.title)}</span>
                        <span className="font-display text-lg font-bold tabular">{formatMeters(workoutMeters(workout))}</span>
                      </span>
                      <span className="block text-xs text-mute">
                        {formatDatePt(workout.date)} · {t("{count} tempos", { count: logs.length })}
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
