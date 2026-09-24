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
    ].sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, 4);
  }, [competitions, workouts]);

  if (!bootstrapped) return <CalendarSkeleton />;

  return (
    <div className="space-y-5 pb-6">
      <OnboardingBanner />

      <div className="card p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="metric-label mb-2">Painel</p>
            <h1 className="text-2xl font-semibold tracking-tight text-mist">Calendário da equipa</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/coach/workouts/new?date=${selected}`} className="btn-primary h-9 px-3 text-xs">
              Novo treino
            </Link>
            <Link href={`/coach/competicoes/new`} className="btn-ghost h-9 px-3 text-xs">
              Nova prova
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="stat-card p-4">
            <p className="metric-label">Treinos</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <span className="metric-value">{upcomingWorkouts}</span>
              <span className="metric-trend"><span className="metric-trend-dot" />ativos</span>
            </div>
          </div>

          <div className="stat-card p-4">
            <p className="metric-label">Competições</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <span className="metric-value">{upcomingCompetitions}</span>
              <span className="metric-trend"><span className="metric-trend-dot" />próximas</span>
            </div>
          </div>

          <div className="stat-card p-4">
            <p className="metric-label">Atletas</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <span className="metric-value">{activeAthletes}</span>
              <span className="metric-trend"><span className="metric-trend-dot" />ativos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="data-panel p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="metric-label">Agenda</p>
              <h2 className="mt-1 text-lg font-semibold text-mist">Próximos eventos</h2>
            </div>
            <span className="soft-pill">{nextEvents.length} items</span>
          </div>

          <div className="space-y-3">
            {nextEvents.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                className="block rounded-xl border border-line bg-ink px-3 py-3 transition hover:border-aqua/30 hover:bg-ink-2"
              >
                <div className="data-row">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">{item.type}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-mist">{item.title}</p>
                  </div>

                  <div className="text-sm text-mute">{item.date}</div>
                  <div className="text-sm text-mute">{item.meta}</div>
                  <span className="btn-ghost h-8 px-2 text-[11px]">Abrir</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="data-panel p-4">
          <div className="mb-3">
            <p className="metric-label">Ações</p>
            <h2 className="mt-1 text-lg font-semibold text-mist">Atalhos</h2>
          </div>

          <div className="space-y-2">
            <Link href={`/coach/workouts/new?date=${selected}`} className="btn-primary w-full justify-center">
              Criar treino
            </Link>
            <Link href="/coach/competicoes" className="btn-ghost w-full justify-center">
              Ver competições
            </Link>
            <Link href="/coach/team" className="btn-ghost w-full justify-center">
              Gerir equipa
            </Link>
          </div>
        </div>
      </div>

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
          <p className="metric-label">Selecionado</p>
          <h2 className="mt-1 text-lg font-semibold text-mist">{formatDatePt(selected)}</h2>

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
                  <div key={meet.id} className="rounded-xl border border-line bg-ink-2 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand">Competição</p>
                    <p className="mt-1 font-semibold text-mist">{meet.title}</p>
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
                <div key={workout.id} className="rounded-xl border border-line bg-ink-2 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">Treino</p>
                  <p className="mt-1 font-semibold text-mist">{workout.title}</p>
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
