"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { MonthCalendar } from "@/components/ui/month-calendar";
import { OnboardingBanner } from "@/components/coach/onboarding-banner";
import { CalendarSkeleton } from "@/components/ui/skeleton";
import { intlLocale } from "@/i18n";
import { WEEKDAYS, addDays, eachIsoDay, inDateRange, todayIso, weekStartMonday } from "@/lib/dates";
import { COURSE_LABEL, SHIFT_LABEL, displayTitle, formatDatePt, formatDateRange } from "@/lib/labels";
import { formatMeters, meetEnd, workoutMeters } from "@/lib/rankings";
import { phaseOf, planContext } from "@/lib/season";
import { formatSet } from "@/lib/set";
import { actions, useAppState, useAuthBoot } from "@/lib/store";
import type { Competition, Workout } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { GROUPS, GROUP_LABEL, groupLabel, parallelVolume, type TrainingGroup } from "@/lib/groups";


export default function CoachHomePage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("A carregar calendário…")}</p>}>
      <CoachCalendar />
    </Suspense>
  );
}

function CoachCalendar() {
  const t = useT();
  const searchParams = useSearchParams();
  const { bootstrapped } = useAuthBoot();
  const { workouts, competitions, meetEntries, athletes } = useAppState();

  const initial = searchParams.get("date") || todayIso();
  const [cursor, setCursor] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const [group, setGroup] = useState<"" | TrainingGroup>("");
  // Sessions without a group are for the whole team, so they show under every group.
  const shownWorkouts = useMemo(
    () => (group ? workouts.filter((workout) => !workout.groups?.length || workout.groups.includes(group)) : workouts),
    [group, workouts],
  );

  const dayWorkouts = useMemo(() => shownWorkouts.filter((workout) => workout.date === selected), [shownWorkouts, selected]);
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
    for (const workout of shownWorkouts) counts[workout.date] = (counts[workout.date] ?? 0) + 1;
    return counts;
  }, [shownWorkouts]);

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
        meta: `${COURSE_LABEL[item.course]} · ${t("{count} atletas", { count: item.athleteIds.length })}`,
        href: `/coach/competicoes/${item.id}`,
      })),
    ]
      .filter((item) => item.date >= todayIso())
      .sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, 4);
  }, [competitions, workouts, t]);

  if (!bootstrapped) return <CalendarSkeleton />;

  return (
    <div className="space-y-6 pb-6">
      <OnboardingBanner />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>{t("Calendário")}</h1>
          <p className="mt-1 text-sm text-mute">{t("Treinos e competições da equipa, dia a dia.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/coach/workouts/new?date=${selected}`} className="btn-primary">
            {t("Novo treino")}
          </Link>
          <Link href="/coach/competicoes" className="btn-ghost">
            {t("Nova competição")}
          </Link>
        </div>
      </header>

      <div role="group" aria-label={t("Grupo")} className="flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-panel p-1">
        {(["", ...GROUPS] as const).map((value) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={group === value}
            onClick={() => setGroup(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${group === value ? "bg-mist text-white" : "text-mute hover:text-mist"}`}
          >
            {value ? GROUP_LABEL[value] : t("Equipa toda")}
          </button>
        ))}
      </div>

      <WeekStrip
        selected={selected}
        onSelect={(iso) => {
          setSelected(iso);
          setCursor(iso);
        }}
        workouts={shownWorkouts}
        competitions={competitions}
        summary={[
          activeAthletes === 1 ? t("1 atleta") : t("{count} atletas", { count: activeAthletes }),
          upcomingWorkouts === 1 ? t("1 treino agendado") : t("{count} treinos agendados", { count: upcomingWorkouts }),
          upcomingCompetitions === 1
            ? t("1 competição por vir")
            : t("{count} competições por vir", { count: upcomingCompetitions }),
        ].join(" · ")}
      />

      {nextEvents.length > 0 ? (
        <section className="data-panel overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 text-xl font-semibold">{t("Próximos eventos")}</h2>
          <ul className="divide-y divide-line">
            {nextEvents.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  href={item.href}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-panel-2"
                >
                  <span className="w-16 text-center">
                    <span className="block font-display text-2xl font-bold leading-none text-mist tabular">{item.date.slice(8, 10)}</span>
                    <span className="mt-0.5 block text-xs text-mute">{new Intl.DateTimeFormat(intlLocale(), { month: "short" }).format(new Date(`${item.date}T12:00:00`)).replace(".", "")}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-mist">{displayTitle(item.title)}</span>
                    <span className="mt-0.5 block truncate text-sm text-mute">{item.meta}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.type === "Prova" ? "bg-[#fdecea] text-coral" : "bg-pool-soft text-pool"
                    }`}
                  >
                    {item.type === "Prova" ? t("Competição") : t("Treino")}
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
              <p className="text-lg font-semibold text-mist">{t("Nada neste dia")}</p>
              <p className="mt-1 text-sm text-mute">{t("Cria um treino ou agenda uma competição.")}</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {dayMeets.map((meet) => {
                const provas = meetEntries.filter((entry) => entry.competitionId === meet.id).length;
                return (
                  <div key={meet.id} className="rounded-xl border border-coral/40 border-l-4 border-l-coral bg-[#fff7f6] px-4 py-3">
                    <span className="rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-white">{t("Competição")}</span>
                    <p className="mt-2 font-semibold text-mist">{meet.title}</p>
                    <p className="mt-1 text-xs text-mute">
                      {formatDateRange(meet.date, meetEnd(meet))} · {COURSE_LABEL[meet.course]} ·{" "}
                      {t("{count} convocados", { count: meet.athleteIds.length })} · {t("{count} provas", { count: provas })}
                    </p>
                    <Link href={`/coach/competicoes/${meet.id}`} className="btn-primary mt-3 h-10 w-full">
                      {t("Informação")}
                    </Link>
                  </div>
                );
              })}

              {dayWorkouts.map((workout) => (
                <div key={workout.id} className="rounded-xl border border-line bg-panel px-4 py-3">
                  <span className="rounded-full bg-pool-soft px-2.5 py-1 text-xs font-semibold text-pool">{t("Treino")}</span>
                  {workout.focus ? <span className="ml-1.5 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">{workout.focus}</span> : null}
                  {(workout.groups ?? []).map((item) => (
                    <span key={item} className="ml-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-mute">
                      {groupLabel(item)}
                    </span>
                  ))}
                  <p className="mt-2 font-semibold text-mist">{displayTitle(workout.title)}</p>
                  <p className="mt-1 text-xs text-mute">
                    {SHIFT_LABEL[workout.shift]}
                    {workout.course && (workout.course === "scm" || workout.course === "lcm") ? ` · ${COURSE_LABEL[workout.course]}` : ""} · {formatMeters(workoutMeters(workout))} ·{" "}
                    {t("{count} na água", { count: workout.athleteIds.length })}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-aqua">{workout.blocks.map((block) => formatSet(block)).join(" · ")}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Link href={`/coach/workouts/${workout.id}`} className="btn-primary h-10">
                      {t("Ver")}
                    </Link>
                    <Link href={`/coach/workouts/${workout.id}/edit`} className="btn-ghost h-10">
                      {t("Editar")}
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost h-10 text-coral"
                      onClick={() => {
                        if (!window.confirm(t("Apagar este treino e os tempos?"))) return;
                        void actions.deleteWorkout(workout.id);
                      }}
                    >
                      {t("Apagar")}
                    </button>
                  </div>
                </div>
              ))}

              {dayWorkouts.length > 0 && (
                <Link href={`/coach/matrix/${dayWorkouts[0].id}`} className="btn-primary mt-1 h-11 w-full">
                  {t("Registar tempos")}
                </Link>
              )}
            </div>
          )}

          <Link href={`/coach/workouts/new?date=${selected}`} className="btn-ghost mt-4 h-10 w-full border-dashed text-mute">
            {dayWorkouts.length ? t("Outro treino") : t("Criar treino")}
          </Link>
        </section>
      </div>
    </div>
  );
}

function WeekStrip({
  selected,
  onSelect,
  workouts,
  competitions,
  summary,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  workouts: Workout[];
  competitions: Competition[];
  summary: string;
}) {
  const t = useT();
  const start = weekStartMonday(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = todayIso();
  const perDay = days.map((iso) => ({
    iso,
    sessions: workouts.filter((workout) => workout.date === iso),
    meets: competitions.filter((meet) => inDateRange(iso, meet.date, meetEnd(meet))),
  }));
  const weekMeters = parallelVolume(
    perDay.flatMap((day) => day.sessions),
    workoutMeters,
  );
  const sessionCount = perDay.reduce((sum, day) => sum + day.sessions.length, 0);
  const { seasonPlans } = useAppState();
  // One season plan for the whole team (load, taper); groups differ only in their sessions.
  const context = planContext(seasonPlans, selected);
  const end = days[6];

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel" aria-label={t("Semana")}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSelect(addDays(selected, -7))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-mute hover:border-aqua hover:text-mist"
            aria-label={t("Semana anterior")}
          >
            ‹
          </button>
          <div>
            <h2 className="font-display text-2xl font-bold leading-none">
              {t("Semana de {from} a {to}", { from: formatDatePt(start).slice(0, 5), to: formatDatePt(end).slice(0, 5) })}
            </h2>
            <p className="mt-1 text-xs text-mute">{summary}</p>
            {context ? (
              <p className="mt-1 text-xs">
                <Link href="/coach/epoca" className="font-semibold text-pool hover:underline">
                  {[
                    t("Semana {n} da época", { n: context.week + 1 }),
                    context.macro ? context.macro.label || t(phaseOf(context.macro.type).label) : "",
                    context.meso?.label ? `${context.meso.label}${context.meso.focus ? ` (${context.meso.focus})` : ""}` : "",
                    context.planned
                      ? t("plano {planned} · feito {done}", { planned: formatMeters(context.planned), done: formatMeters(weekMeters) })
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Link>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onSelect(addDays(selected, 7))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-mute hover:border-aqua hover:text-mist"
            aria-label={t("Semana seguinte")}
          >
            ›
          </button>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs text-mute">{t("Sessões")}</dt>
            <dd className="font-display text-2xl font-bold tabular">{sessionCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{t("Volume")}</dt>
            <dd className="font-display text-2xl font-bold tabular">{formatMeters(weekMeters)}</dd>
          </div>
        </dl>
      </header>
      <ol className="grid grid-cols-7 divide-x divide-line overflow-x-auto">
        {perDay.map((day, index) => {
          const isSelected = day.iso === selected;
          const isToday = day.iso === today;
          const meters = parallelVolume(day.sessions, workoutMeters);
          return (
            <li key={day.iso} className="min-w-[92px]">
              <button
                type="button"
                onClick={() => onSelect(day.iso)}
                aria-pressed={isSelected}
                className={`flex h-full min-h-32 w-full flex-col gap-1.5 px-2.5 py-3 text-left transition-colors ${
                  isSelected ? "bg-aqua text-white" : "hover:bg-panel-2"
                }`}
              >
                <span className="flex items-baseline justify-between gap-1">
                  <span className={`text-xs font-semibold ${isSelected ? "text-white/70" : "text-mute"}`}>{WEEKDAYS[index]}</span>
                  <span
                    className={`font-display text-xl font-bold leading-none tabular ${
                      isToday && !isSelected ? "rounded bg-pool px-1 text-white" : ""
                    }`}
                  >
                    {Number(day.iso.slice(8, 10))}
                  </span>
                </span>
                {day.meets.map((meet) => (
                  <span
                    key={meet.id}
                    title={meet.title}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-bold ${isSelected ? "bg-coral text-white" : "bg-coral text-white"}`}
                  >
                    {meet.title}
                  </span>
                ))}
                {day.sessions.map((workout) => (
                  <span
                    key={workout.id}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      isSelected ? "bg-white/15 text-white" : "bg-pool-soft text-pool"
                    }`}
                  >
                    {workout.focus || SHIFT_LABEL[workout.shift]} · {formatMeters(workoutMeters(workout))}
                  </span>
                ))}
                {meters ? (
                  <span className={`mt-auto text-xs tabular ${isSelected ? "text-white/70" : "text-mute"}`}>{formatMeters(meters)}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
