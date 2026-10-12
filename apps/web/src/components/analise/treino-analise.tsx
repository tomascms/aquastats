"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnaliseTabs } from "@/components/analise/analise-tabs";
import { AthleteChips, NoAthletes } from "@/components/analise/athlete-chips";
import { EvolutionView } from "@/components/analise/evolution-view";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { SessionAnalysis } from "@/components/workouts/session-analysis";
import { SHIFT_LABEL, displayTitle, formatDatePt } from "@/lib/labels";
import { todayIso } from "@/lib/dates";
import { formatMeters, workoutMeters } from "@/lib/rankings";
import { useAppState } from "@/lib/store";
import { useT } from "@/i18n/provider";

/**
 * Análise de treino: "Sessão" (one day read like a report, the same as on the workout page) and
 * "Evolução" (is the swimmer getting faster, per kind of set). docs/natacao/benchmark-visualizacao.md §6.
 */
export function TreinoAnalise({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { athletes, workouts, timeLogs, swimmerId } = useAppState();
  const audience = role === "swimmer" ? "athlete" : "coach";
  const locked = role === "swimmer" ? swimmerId : "";
  const athleteId = locked || search.get("atleta") || athletes[0]?.id || "";
  const athlete = athletes.find((item) => item.id === athleteId);
  const initial = search.get("date") || todayIso();
  const [cursor, setCursor] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const [view, setView] = useState<"session" | "evolution">(search.get("vista") === "evolucao" ? "evolution" : "session");
  const [workoutId, setWorkoutId] = useState("");

  // Days with this athlete's times (a dot on the calendar), newest first.
  const timed = useMemo(() => {
    const ids = new Set(timeLogs.filter((log) => log.athleteId === athleteId).map((log) => log.workoutId));
    return workouts.filter((w) => ids.has(w.id) && w.athleteIds.includes(athleteId)).sort((a, b) => b.date.localeCompare(a.date));
  }, [athleteId, timeLogs, workouts]);
  const workoutCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const workout of timed) counts[workout.date] = (counts[workout.date] ?? 0) + 1;
    return counts;
  }, [timed]);
  const dayWorkouts = timed.filter((workout) => workout.date === selected);
  const workout = dayWorkouts.find((item) => item.id === workoutId) ?? dayWorkouts[0];

  const latestDate = timed[0]?.date;
  const hasDateParam = Boolean(search.get("date"));
  useEffect(() => {
    if (hasDateParam || !latestDate) return;
    setSelected(latestDate);
    setCursor(latestDate);
  }, [athleteId, hasDateParam, latestDate]);

  function setAthlete(id: string) {
    const next = new URLSearchParams(search.toString());
    if (id) next.set("atleta", id);
    else next.delete("atleta");
    next.delete("date");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t("Análise de treino")}</h1>
          <p className="mt-1 text-sm text-mute">{role === "swimmer" ? t("Como correu cada treino e se estás a melhorar.") : t("Como correu cada treino e se o atleta está a melhorar.")}</p>
        </div>
        <div className="w-full max-w-md">
          <AnaliseTabs role={role} />
        </div>
      </header>

      {role === "coach" ? <AthleteChips athletes={athletes} selectedId={athleteId} onSelect={setAthlete} /> : null}

      {!athlete ? (
        <NoAthletes />
      ) : (
        <>
          <div className="grid max-w-xs grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1" role="group" aria-label={t("Vista")}>
            {(
              [
                ["session", t("Sessão")],
                ["evolution", t("Evolução")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${view === value ? "bg-aqua text-white" : "text-mute hover:text-mist"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "evolution" ? (
            <EvolutionView athlete={athlete} audience={audience} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
              <div className="space-y-2">
                <MonthCalendar
                  cursor={cursor}
                  selected={selected}
                  workoutCountByDate={workoutCountByDate}
                  onCursor={setCursor}
                  onSelect={(iso) => {
                    setSelected(iso);
                    setCursor(iso);
                    setWorkoutId("");
                  }}
                />
              </div>
              <div className="min-w-0 space-y-3">
                <p className="text-sm text-mute">
                  {formatDatePt(selected)}
                  {dayWorkouts.length ? ` · ${formatMeters(dayWorkouts.reduce((sum, item) => sum + workoutMeters(item), 0))}` : ""}
                </p>
                {dayWorkouts.length > 1 ? (
                  <div className="flex flex-wrap gap-1">
                    {dayWorkouts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={workout?.id === item.id}
                        onClick={() => setWorkoutId(item.id)}
                        className={`min-h-11 rounded-full px-3 text-sm font-semibold ${workout?.id === item.id ? "bg-aqua text-white" : "border border-line text-mute hover:text-mist"}`}
                      >
                        {SHIFT_LABEL[item.shift]}
                        {item.title ? ` · ${displayTitle(item.title)}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
                {workout ? (
                  <SessionAnalysis key={`${workout.id}-${athlete.id}`} workout={workout} athletes={[athlete]} audience={audience} />
                ) : (
                  <p className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-sm text-mute">{t("Sem tempos neste dia.")}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
