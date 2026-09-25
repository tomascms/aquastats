"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { MonthCalendar } from "@/components/ui/month-calendar";
import { OnboardingBanner } from "@/components/coach/onboarding-banner";
import { CalendarSkeleton } from "@/components/ui/skeleton";
import { eachIsoDay, inDateRange, todayIso } from "@/lib/dates";
import { COURSE_LABEL, SHIFT_LABEL, formatDatePt, formatDateRange } from "@/lib/labels";
import { formatMeters, meetEnd, workoutMeters } from "@/lib/rankings";
import { formatSet } from "@/lib/set";
import { actions, useAppState, useAuthBoot } from "@/lib/store";

const MONTH_SHORT = new Intl.DateTimeFormat("pt-PT", { month: "short" });

export default function CoachHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">A carregar calendário…</p>}>
      <CoachCalendar />
    </Suspense>
  );
}

function CoachCalendar() {
  const searchParams = useSearchParams();
  const { bootstrapped } = useAuthBoot();
  const { workouts, competitions, meetEntries, athletes } = useAppState();

  const initial = searchParams.get("date") || todayIso();
  const [cursor, setCursor] = useState(initial);
  const [selected, setSelected] = useState(initial);

  const dayWorkouts = useMemo(() => workouts.filter((workout) => workout.date === selected), [workouts, selected]);
  const dayMeets = useMemo(
    () => competitions.filter((meet) => inDateRange(selected, meet.date, meetEnd(meet))),
    [competitions, selected],
  );
  const empty = dayWorkouts.length === 0 && dayMeets.length === 0;

  const upcomingWorkouts = useMemo(() => workouts.filter((workout) => workout.date >= todayIso()).length, [workouts]);
  const upcomingCompetitions = useMemo(
    () => competitions.filter((meet) => meet.date >= todayIso()).length,
    [competitions],
  );
  const activeAthletes = useMemo(() => athletes.filter((athlete) => athlete.active !== false).length, [athletes]);

  const workoutCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const workout of workouts) counts[workout.date] = (counts[workout.date] ?? 0) + 1;
    return counts;
  }, [workouts]);

  const meetCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const meet of competitions) {
      for (const day of eachIsoDay(meet.date, meetEnd(meet))) counts[day] = (counts[day] ?? 0) + 1;
    }
    return counts;
  }, [competitions]);

  const nextEvents = useMemo(() => {
    const items = [
      ...workouts.map((item) => ({
        id: item.id,
        type: "Treino" as const,
        title: item.title,
        date: item.date,
        meta: `${SHIFT_LABEL[item.shift]} · ${formatMeters(workoutMeters(item))}`,
        href: `/coach/workouts/${item.id}`,
      })),
      ...competitions.map((item) => ({
        id: item.id,
        type: "Prova" as const,
        title: item.title,
        date: item.date,
        meta: `${COURSE_LABEL[item.course]} · ${item.athleteIds.length} atletas`,
        href: `/coach/competicoes/${item.id}`,
      })),
    ]
      .filter((item) => item.date >= todayIso())
      .sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, 4);
  }, [competitions, workouts]);

  if (!bootstrapped) return <CalendarSkeleton />;

  return (
    <div className="space-y-6 pb-6">
      <OnboardingBanner />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Calendário</h1>
          <p className="mt-1 text-sm text-mute">Treinos e competições da equipa, dia a dia.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/coach/workouts/new?date=${selected}`} className="btn-primary">
            Novo treino
          </Link>
          <Link href="/coach/competicoes" className="btn-ghost">
            Nova competição
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo da equipa">
        <div className="stat-card px-5 py-4">
          <p className="metric-label">Treinos agendados</p>
          <p className="metric-value mt-2">{upcomingWorkouts}</p>
        </div>
        <div className="stat-card px-5 py-4">
          <p className="metric-label">Competições por vir</p>
          <p className="metric-value mt-2">{upcomingCompetitions}</p>
        </div>
        <div className="stat-card px-5 py-4">
          <p className="metric-label">Atletas ativos</p>
          <p className="metric-value mt-2">{activeAthletes}</p>
        </div>
      </section>

      {nextEvents.length > 0 ? (
        <section className="data-panel overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 text-xl font-semibold">Próximos eventos</h2>
          <ul className="divide-y divide-line">
            {nextEvents.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  href={item.href}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-panel-2"
                >
                  <span className="w-16 text-center">
                    <span className="block font-display text-2xl font-bold leading-none text-mist tabular">{item.date.slice(8, 10)}</span>
                    <span className="mt-0.5 block text-xs text-mute">{MONTH_SHORT.format(new Date(`${item.date}T12:00:00`)).replace(".", "")}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-mist">{item.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-mute">{item.meta}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.type === "Prova" ? "bg-[#fdecea] text-coral" : "bg-pool-soft text-pool"
                    }`}
                  >
                    {item.type === "Prova" ? "Competição" : "Treino"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
        <MonthCalendar
          cursor={cursor}
          selected={selected}
          workoutCountByDate={workoutCountByDate}
          meetCountByDate={meetCountByDate}
          onCursor={setCursor}
          onSelect={(iso) => {
            setSelected(iso);
            setCursor(iso);
          }}
        />

        <section className="data-panel p-4">
          <h2 className="text-xl font-semibold">{formatDatePt(selected)}</h2>

          {empty ? (
            <div className="mt-4 rounded-xl border border-dashed border-line bg-ink-2 px-4 py-6">
              <p className="text-lg font-semibold text-mist">Nada neste dia</p>
              <p className="mt-1 text-sm text-mute">Cria um treino ou agenda uma competição.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {dayMeets.map((meet) => {
                const provas = meetEntries.filter((entry) => entry.competitionId === meet.id).length;
                return (
                  <div key={meet.id} className="rounded-xl border border-line bg-panel px-4 py-3">
                    <span className="rounded-full bg-[#fdecea] px-2.5 py-1 text-xs font-semibold text-coral">Competição</span>
                    <p className="mt-2 font-semibold text-mist">{meet.title}</p>
                    <p className="mt-1 text-xs text-mute">
                      {formatDateRange(meet.date, meetEnd(meet))} · {COURSE_LABEL[meet.course]} · {meet.athleteIds.length} convocados · {provas} provas
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link href={`/coach/competicoes/${meet.id}`} className="btn-primary h-10">
                        Convocar
                      </Link>
                      <Link href={`/coach/competicoes/${meet.id}/resultados`} className="btn-ghost h-10">
                        Resultados
                      </Link>
                    </div>
                  </div>
                );
              })}

              {dayWorkouts.map((workout) => (
                <div key={workout.id} className="rounded-xl border border-line bg-panel px-4 py-3">
                  <span className="rounded-full bg-pool-soft px-2.5 py-1 text-xs font-semibold text-pool">Treino</span>
                  <p className="mt-2 font-semibold text-mist">{workout.title}</p>
                  <p className="mt-1 text-xs text-mute">
                    {SHIFT_LABEL[workout.shift]}
                    {workout.course && (workout.course === "scm" || workout.course === "lcm") ? ` · ${COURSE_LABEL[workout.course]}` : ""} · {formatMeters(workoutMeters(workout))} · {workout.athleteIds.length} na água
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-aqua">{workout.blocks.map((block) => formatSet(block)).join(" · ")}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Link href={`/coach/workouts/${workout.id}`} className="btn-primary h-10">
                      Ver
                    </Link>
                    <Link href={`/coach/workouts/${workout.id}/edit`} className="btn-ghost h-10">
                      Editar
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost h-10 text-coral"
                      onClick={() => {
                        if (!window.confirm("Apagar este treino e os tempos?")) return;
                        void actions.deleteWorkout(workout.id);
                      }}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))}

              {dayWorkouts.length > 0 && (
                <Link href={`/coach/matrix/${dayWorkouts[0].id}`} className="btn-primary mt-1 h-11 w-full">
                  Registar tempos
                </Link>
              )}
            </div>
          )}

          <Link href={`/coach/workouts/new?date=${selected}`} className="btn-ghost mt-4 h-10 w-full border-dashed text-mute">
            {dayWorkouts.length ? "Outro treino" : "Criar treino"}
          </Link>
        </section>
      </div>
    </div>
  );
}
