"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { DateField } from "@/components/ui/date-field";
import { formatApiError, type ApiError } from "@/lib/api";
import { addDays, todayIso, weekStartMonday, WEEKDAYS } from "@/lib/dates";
import { groupLabel, parallelVolume } from "@/lib/groups";
import { SHIFT_LABEL, displayTitle, formatDatePt } from "@/lib/labels";
import { formatMeters, meetEnd, workoutMeters } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";
import { toast } from "@/lib/toast";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { dailyLoadPerAthlete, taperOptions } from "@/lib/ml/load-risk";
import type { Competition, SeasonCycle, SeasonPlan, Workout } from "@/lib/types";

/** Colours the coach picks per macrocycle (stored in the cycle's `type`). */
const COLORS: Record<string, { band: string; soft: string }> = {
  c1: { band: "#1f6feb", soft: "#e8f0fe" },
  c2: { band: "#2fae4a", soft: "#e9f7ec" },
  c3: { band: "#e0a100", soft: "#fdf5dc" },
  c4: { band: "#d9480f", soft: "#fdece4" },
  c5: { band: "#7048e8", soft: "#efeafd" },
  c6: { band: "#6b7280", soft: "#eef0f2" },
};
const COLOR_KEYS = Object.keys(COLORS);
const MACRO_SUGGESTIONS = ["Preparação geral", "Preparação específica", "Competitivo", "Taper", "Transição"];

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function blankPlan(): SeasonPlan {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return { id: "", name: `${year}/${String(year + 1).slice(2)}`, start: `${year}-09-01`, end: `${year + 1}-07-31`, description: "", macros: [], mesos: [], competitions: [], tests: [], weeklyVolumes: [] };
}

const colorOf = (cycle?: SeasonCycle) => COLORS[cycle?.type ?? ""] ?? COLORS.c6;

/**
 * The season on one screen: macrocycles the coach names and colours freely, and every week laid
 * out day by day with what was actually trained and the competitions. No volume targets, no groups.
 */
export function SeasonPlanner() {
  const t = useT();
  const { seasonPlans, workouts, competitions } = useAppState();
  const stored = seasonPlans[0];
  const [draft, setDraft] = useState<SeasonPlan | null>(null);
  const plan = draft ?? stored ?? null;
  const [busy, setBusy] = useState(false);

  function edit(patch: Partial<SeasonPlan> | ((current: SeasonPlan) => SeasonPlan)) {
    const base = draft ?? stored ?? blankPlan();
    setDraft(typeof patch === "function" ? patch(base) : { ...base, ...patch });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await actions.saveSeasonPlan({ ...draft, competitions: [], tests: [], weeklyVolumes: [] });
      setDraft(null);
      toast.success(t("Época guardada."));
    } catch (error) {
      toast.error(formatApiError(error as ApiError) || t("Não foi possível guardar."));
    } finally {
      setBusy(false);
    }
  }

  if (!plan) {
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
        <p className="font-display text-2xl font-bold">{t("Ainda não há época")}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-mute">{t("Define as datas e os macrociclos. Os treinos e as competições aparecem sozinhos em cada semana.")}</p>
        <button type="button" className="btn-primary mt-4" onClick={() => setDraft(blankPlan())}>
          {t("Criar época")}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel px-4 py-3">
        <label className="text-xs font-semibold text-mute">
          {t("Época")}
          <input className="field mt-1 h-9 w-32 py-1" value={plan.name} onChange={(event) => edit({ name: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-mute">
          {t("De")}
          <DateField value={plan.start} onChange={(iso) => edit({ start: iso })} className="mt-1" inputClassName="field h-9 py-1" />
        </label>
        <label className="text-xs font-semibold text-mute">
          {t("Até")}
          <DateField value={plan.end} min={plan.start} onChange={(iso) => edit({ end: iso })} className="mt-1" inputClassName="field h-9 py-1" />
        </label>
        <div className="ml-auto flex gap-2">
          {draft ? (
            <>
              <button type="button" className="btn-ghost h-9" onClick={() => setDraft(null)} disabled={busy}>
                {t("Descartar")}
              </button>
              <button type="button" className="btn-primary h-9" onClick={() => void save()} disabled={busy}>
                {busy ? t("A guardar…") : t("Guardar")}
              </button>
            </>
          ) : null}
        </div>
      </section>

      <MacroEditor plan={plan} kind="macros" onChange={(macros) => edit({ macros })} />
      <MacroEditor plan={plan} kind="mesos" onChange={(mesos) => edit({ mesos })} />
      <SeasonWeeks plan={plan} workouts={workouts} competitions={competitions} />
      <TaperCard workouts={workouts} competitions={competitions} />
    </div>
  );
}

/** Macrocycles, or mesocycles (same fields; mesos are shorter blocks shown under the macro on the timeline). */
function MacroEditor({ plan, kind, onChange }: { plan: SeasonPlan; kind: "macros" | "mesos"; onChange: (cycles: SeasonCycle[]) => void }) {
  const t = useT();
  const all = plan[kind];
  const meso = kind === "mesos";
  const macros = [...all].sort((a, b) => a.start.localeCompare(b.start));
  const update = (id: string, patch: Partial<SeasonCycle>) => onChange(all.map((cycle) => (cycle.id === id ? { ...cycle, ...patch } : cycle)));

  function add() {
    const last = macros[macros.length - 1];
    const start = last ? addDays(last.end, 1) : plan.start;
    const length = meso ? 20 : 27;
    const end = addDays(start, length) < plan.end ? addDays(start, length) : plan.end;
    onChange([...all, { id: uid(), type: COLOR_KEYS[all.length % COLOR_KEYS.length], label: "", focus: "", start, end }]);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-mute">{meso ? t("Mesociclos") : t("Macrociclos")}</h2>
        <button type="button" className="min-h-11 text-xs font-semibold text-pool hover:underline" onClick={add}>
          + {meso ? t("Mesociclo") : t("Macrociclo")}
        </button>
      </header>
      {macros.length === 0 ? (
        <p className="px-4 py-3 text-sm text-mute">{meso ? t("Sem mesociclos.") : t("Sem macrociclos. Acrescenta o primeiro (ex.: Preparação geral).")}</p>
      ) : null}
      {meso ? null : <datalist id="macro-names">
        {MACRO_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>}
      <table className="w-full text-sm">
        <tbody>
          {macros.map((cycle) => (
            <tr key={cycle.id} className="border-t border-line first:border-t-0">
              <td className="w-2 p-0" style={{ background: colorOf(cycle).band }} />
              <td className="px-3 py-1.5">
                <input
                  className="field h-8 py-1 text-sm font-semibold"
                  list={meso ? undefined : "macro-names"}
                  placeholder={meso ? t("Nome (ex.: Bloco aeróbio)") : t("Nome (ex.: Preparação geral)")}
                  value={cycle.label ?? ""}
                  onChange={(event) => update(cycle.id, { label: event.target.value })}
                />
              </td>
              <td className="px-2 py-1.5">
                <DateField value={cycle.start} onChange={(iso) => update(cycle.id, { start: iso })} inputClassName="field h-8 py-1 text-sm" />
              </td>
              <td className="px-2 py-1.5">
                <DateField value={cycle.end} min={cycle.start} onChange={(iso) => update(cycle.id, { end: iso })} inputClassName="field h-8 py-1 text-sm" />
              </td>
              <td className="px-2 py-1.5">
                <span className="flex gap-1" role="group" aria-label={t("Cor")}>
                  {COLOR_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={cycle.type === key}
                      aria-label={key}
                      onClick={() => update(cycle.id, { type: key })}
                      className={`h-5 w-5 rounded-full ${cycle.type === key ? "ring-2 ring-offset-1 ring-ink" : ""}`}
                      style={{ background: COLORS[key].band }}
                    />
                  ))}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right">
                <ConfirmButton
                  label={t("Eliminar")}
                  className="rounded px-1 text-xs font-semibold text-coral"
                  onConfirm={() => onChange(all.filter((item) => item.id !== cycle.id))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SeasonWeeks({ plan, workouts, competitions }: { plan: SeasonPlan; workouts: Workout[]; competitions: Competition[] }) {
  const t = useT();
  const today = todayIso();
  const currentRef = useRef<HTMLTableRowElement>(null);
  const weeks = useMemo(() => {
    const out: string[] = [];
    for (let week = weekStartMonday(plan.start); week <= plan.end && out.length < 60; week = addDays(week, 7)) out.push(week);
    return out;
  }, [plan.end, plan.start]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[980px] table-fixed text-xs">
          <thead className="sticky top-0 z-10 bg-panel-2 text-[11px] font-semibold uppercase tracking-wide text-mute">
            <tr>
              <th className="w-24 px-3 py-2 text-left">{t("Semana")}</th>
              <th className="w-36 px-2 py-2 text-left">{t("Macro / mesociclo")}</th>
              {WEEKDAYS.map((day) => (
                <th key={day} className="px-2 py-2 text-left">
                  {day}
                </th>
              ))}
              <th className="w-20 px-3 py-2 text-right">{t("Volume")}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((start, index) => {
              const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
              const end = days[6];
              const macro = plan.macros.find((cycle) => cycle.start <= end && cycle.end >= start);
              const meso = plan.mesos.find((cycle) => cycle.start <= end && cycle.end >= start);
              const weekWorkouts = workouts.filter((workout) => workout.date >= start && workout.date <= end);
              const current = today >= start && today <= end;
              return (
                <tr key={start} ref={current ? currentRef : undefined} className={`border-t border-line align-top ${current ? "bg-pool-soft/40" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="block font-semibold text-mist">{t("Sem. {n}", { n: index + 1 })}</span>
                    <span className="text-mute">
                      {formatDatePt(start).slice(0, 5)}–{formatDatePt(end).slice(0, 5)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {macro ? (
                      <span
                        className="block truncate rounded px-2 py-1 font-semibold"
                        style={{ background: colorOf(macro).soft, color: colorOf(macro).band, borderLeft: `3px solid ${colorOf(macro).band}` }}
                        title={macro.label}
                      >
                        {macro.label || "—"}
                      </span>
                    ) : null}
                    {meso ? (
                      <span
                        className="mt-1 block truncate rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{ color: colorOf(meso).band, borderLeft: `3px dashed ${colorOf(meso).band}` }}
                        title={meso.focus ? `${meso.label} · ${meso.focus}` : meso.label}
                      >
                        {meso.label || "—"}
                      </span>
                    ) : null}
                  </td>
                  {days.map((iso) => {
                    const dayWorkouts = weekWorkouts.filter((workout) => workout.date === iso).sort((a, b) => a.shift.localeCompare(b.shift));
                    const dayMeets = competitions.filter((meet) => meet.date <= iso && meetEnd(meet) >= iso);
                    return (
                      <td key={iso} className={`border-l border-line px-1.5 py-1.5 ${iso === today ? "bg-pool-soft" : ""}`}>
                        <Link href={`/coach?date=${iso}`} className="block space-y-1 rounded hover:bg-panel-2">
                          <span className="block text-[10px] text-mute">{Number(iso.slice(8, 10))}</span>
                          {dayMeets.map((meet) => (
                            <span key={meet.id} className="block truncate rounded bg-coral px-1.5 py-0.5 font-bold text-white" title={meet.title}>
                              {meet.title}
                            </span>
                          ))}
                          {dayWorkouts.map((workout) => (
                            <span key={workout.id} className="block truncate rounded bg-panel-2 px-1.5 py-0.5 text-mist" title={displayTitle(workout.title)}>
                              <span className="font-semibold">{workout.focus || SHIFT_LABEL[workout.shift]}</span>{" "}
                              <span className="text-mute">{formatMeters(workoutMeters(workout))}</span>
                              {workout.groups?.length ? <span className="block text-[10px] text-mute">{workout.groups.map(groupLabel).join(" · ")}</span> : null}
                            </span>
                          ))}
                        </Link>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-semibold tabular text-mist">
                    {weekWorkouts.length ? formatMeters(parallelVolume(weekWorkouts, workoutMeters)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Taper options for the next competition: freshness on race day from a fitness–fatigue model with typical parameters. */
function TaperCard({ workouts, competitions }: { workouts: Workout[]; competitions: Competition[] }) {
  const t = useT();
  const today = todayIso();
  const meet = useMemo(() => [...competitions].filter((item) => item.date > today).sort((a, b) => a.date.localeCompare(b.date))[0], [competitions, today]);
  const options = useMemo(() => (meet ? taperOptions(dailyLoadPerAthlete(workouts), today, meet.date) : []), [meet, today, workouts]);
  if (!meet || options.length < 2) return null;
  const none = options[0].freshness;
  const ranked = options.slice(1).sort((a, b) => b.freshness - a.freshness);
  const best = ranked[0];
  const scale = Math.max(...ranked.map((option) => Math.abs(option.freshness - none)), 0.01);
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Taper antes de {meet}", { meet: meet.title })}</h2>
      <p className="mt-1 text-sm text-mist">
        {t("Frescura prevista no dia da prova (forma − fadiga) para cada opção, face a manter a carga habitual. Maior frescura prevista nesta simulação: {weeks} semana(s) de taper, −{drop}% de carga.", {
          weeks: best.weeks,
          drop: Math.round(best.dropPct),
        })}
      </p>
      <ul className="mt-3 space-y-1">
        {ranked.slice(0, 6).map((option) => {
          const gain = option.freshness - none;
          return (
            <li key={`${option.weeks}-${option.dropPct}`} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 text-xs">
              <span className="text-mist">{t("{weeks} sem. a −{drop}%", { weeks: option.weeks, drop: Math.round(option.dropPct) })}</span>
              <span className="h-3 rounded bg-panel-2">
                <span className={`block h-3 rounded ${option === best ? "bg-good" : "bg-pool/60"}`} style={{ width: `${Math.max(2, (Math.abs(gain) / scale) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-mute">
        {t("Modelo fitness–fadiga com parâmetros típicos (não ajustados aos teus atletas: o ajuste individual não melhorou as previsões nos testes). Serve para comparar opções, não para prever tempos.")}
      </p>
    </section>
  );
}
