"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { addDays, weekStartMonday } from "@/lib/dates";
import {
  breakdown,
  formDays,
  isNoise,
  loadPoints,
  pctText,
  secText,
  sessionKey,
  weeklyKm,
  type Breakdown,
  type DayPoint,
  type ExplainedRep,
  type LoadPoint,
} from "@/lib/explained-times";
import { formatDatePt } from "@/lib/labels";
import { formatSeconds } from "@/lib/race";
import { raceRecords } from "@/lib/rankings";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import { explainTrainingTargets } from "@/lib/training-prediction";
import type { Athlete } from "@/lib/types";
import {
  Card,
  ChartFrame,
  CompareSessions,
  DetailsTable,
  dirText,
  FactorProfile,
  kindLabel,
  lowerFirst,
  LoadScatter,
  SetCurveChart,
  Swatch,
  Tip,
  tipProps,
  useFactorName,
  type ChartTip,
} from "./tempos-graficos";

/** 26 weeks shown, plus the 6 weeks each level looks back on. */
const SHOWN_DAYS = 182;
const LOOKBACK_DAYS = 42;
/** The waterfall names the 3 largest factors; the rest is one "Outros" bar. */
const TOP_FACTORS = 3;

type Scope = "week" | "session" | "rep";

/** "Tempos explicados": why a rep, a session or a week was slower or faster than usual, and what it is associated with. */
export function TemposExplicados({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const { workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions, seasonPlans } = useAppState();

  const data = useMemo(() => {
    const wellness = athlete.wellness ?? [];
    const all = annotateTrainingReps(workouts, timeLogs, athlete.id, wellness).filter(isPlausibleRep);
    const last = all.reduce((max, row) => (row.date > max ? row.date : max), "");
    if (!last) return null;
    const from = addDays(last, -SHOWN_DAYS);
    const rows = all.filter((row) => row.date >= addDays(from, -LOOKBACK_DAYS));
    const explained = explainTrainingTargets(rows);
    const list: ExplainedRep[] = rows
      .filter((row) => row.date >= from && explained.has(row.log.id))
      .map((row) => ({ ...explained.get(row.log.id)!, row }));
    const km = weeklyKm(workouts, athlete.id);
    const races = raceRecords(competitions, meetEntries, meetResults, raceSessions, athlete.id, athlete.seedRecords).filter(
      (race, i, all) => race.date >= from && race.date <= last && all.findIndex((other) => other.date === race.date && other.meetTitle === race.meetTitle) === i,
    );
    return {
      rows: rows.filter((row) => row.date >= from),
      list,
      days: formDays(list),
      weeks: loadPoints(list, km, seasonPlans),
      races,
      wellness,
      trainingDays: new Set(all.map((row) => row.date)),
    };
  }, [athlete, workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions, seasonPlans]);

  const sessions = useMemo(() => {
    const out = new Map<string, ExplainedRep[]>();
    for (const rep of data?.list ?? []) out.set(sessionKey(rep.row), [...(out.get(sessionKey(rep.row)) ?? []), rep]);
    return [...out.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [data]);

  const [scope, setScope] = useState<Scope>("week");
  const [week, setWeek] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [repId, setRepId] = useState<string | null>(null);

  if (!data || !data.list.length) {
    return (
      <Section>
        <p className="mt-2 text-sm text-mute">{t("Ainda sem reps com nível habitual (são precisas 2 reps anteriores iguais).")}</p>
      </Section>
    );
  }

  const weekKey = week ?? weekStartMonday(data.list[data.list.length - 1].row.date);
  const sessionId = session ?? sessions[0]?.[0] ?? "";
  const sessionReps = sessions.find(([key]) => key === sessionId)?.[1] ?? [];
  const rep = sessionReps.find((item) => item.row.log.id === repId) ?? sessionReps[0];
  const picked =
    scope === "week"
      ? data.list.filter((item) => weekStartMonday(item.row.date) === weekKey)
      : scope === "session"
        ? sessionReps
        : rep
          ? [rep]
          : [];

  const openWeek = (value: string) => {
    setWeek(value);
    setScope("week");
    document.getElementById("porque")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Section>
      <div className="mt-4 space-y-4">
        <FormChart days={data.days} weeks={data.weeks} races={data.races} selected={scope === "week" ? weekKey : null} onWeek={openWeek} />

        <WhyCard b={breakdown(picked)} single={scope === "rep"}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1" role="group" aria-label={t("Escala")}>
              {(
                [
                  ["week", t("Semana")],
                  ["session", t("Treino")],
                  ["rep", t("Rep")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scope === value}
                  onClick={() => setScope(value)}
                  className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${scope === value ? "bg-aqua text-white" : "text-mute hover:text-mist"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {scope === "week" ? (
              <label className="text-xs text-mute">
                <span className="sr-only">{t("Semana")}</span>
                <select className="field h-11 w-auto py-1 text-sm" value={weekKey} onChange={(event) => setWeek(event.target.value)}>
                  {[...data.weeks].reverse().map((item) => (
                    <option key={item.week} value={item.week}>
                      {t("Semana de {date}", { date: formatDatePt(item.week) })}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-xs text-mute">
                <span className="sr-only">{t("Treino")}</span>
                <select
                  className="field h-11 w-auto max-w-full py-1 text-sm"
                  value={sessionId}
                  onChange={(event) => {
                    setSession(event.target.value);
                    setRepId(null);
                  }}
                >
                  {sessions.map(([key, reps]) => (
                    <option key={key} value={key}>
                      {`${formatDatePt(reps[0].row.date)} · ${reps[0].row.workoutTitle}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {scope === "rep" && sessionReps.length ? (
              <label className="text-xs text-mute">
                <span className="sr-only">{t("Rep")}</span>
                <select className="field h-11 w-auto max-w-full py-1 text-sm" value={rep?.row.log.id} onChange={(event) => setRepId(event.target.value)}>
                  {sessionReps.map((item, index) => (
                    <option key={item.row.log.id} value={item.row.log.id}>
                      {`${index + 1}. ${kindLabel(item.row)} · ${formatSeconds(item.actualS)}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </WhyCard>

        <CompareSessions list={data.list} wellness={data.wellness} trainingDays={data.trainingDays} />
        <SetCurveChart list={data.list} />
        <LoadScatter weeks={data.weeks} />
        <FactorProfile rows={data.rows} />

        <p className="text-xs text-mute">{t("Associações, não causas: a parte de contexto do modelo não passou no backtest, por isso cada valor traz a sua margem.")}</p>
      </div>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <section id="tempos" className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="tempos-titulo">
      <h2 id="tempos-titulo" className="font-display text-xl font-bold">
        {t("Tempos explicados")}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-mute">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** A. Level → the 3 largest factors → others → expected (± margin) → real; details on hover or tap, the full table folded. */
function WhyCard({ b, single, children }: { b: Breakdown | null; single: boolean; children: React.ReactNode }) {
  const t = useT();
  const name = useFactorName();
  const question = t("Porquê este tempo?");
  if (!b) return <Card id="porque" question={question} answer={t("Sem reps com nível habitual neste período.")}>{children}</Card>;

  const pct = (seconds: number) => (seconds / b.levelS) * 100;
  // Weeks and sessions: never a sum of times, always % and the mean per rep.
  const perRep = (seconds: number) => secText(seconds / b.reps);
  const expectedPct = pct(b.expectedS - b.levelS);
  const marginPct = pct(b.marginS);
  const unexplainedPct = pct(b.unexplainedS);
  const sorted = [...b.factors].sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
  const top = sorted.filter((factor) => factor.key !== "few-data").slice(0, TOP_FACTORS);
  const rest = sorted.filter((factor) => !top.includes(factor));
  const restSeconds = rest.reduce((sum, factor) => sum + factor.seconds, 0);
  const bars = [
    ...top.map((factor) => ({ key: factor.key, name: name(factor.key), seconds: factor.seconds, support: factor.support as number | null })),
    ...(rest.length ? [{ key: "others", name: name("others"), seconds: restSeconds, support: null }] : []),
  ];
  const fast = top.find((factor) => factor.pct < 0);
  const slow = top.find((factor) => factor.pct > 0);
  const gap = secText(Math.abs(single ? b.actualS - b.levelS : (b.actualS - b.levelS) / b.reps)).replace("+", "");

  const headline = b.noise
    ? t("Igual ao habitual: a diferença ({pct}) está abaixo de 1 %, é ruído.", { pct: pctText(b.devPct) })
    : single
      ? b.devPct > 0
        ? t("Saiu {s} mais lenta do que o habitual ({pct}).", { s: gap, pct: pctText(b.devPct) })
        : t("Saiu {s} mais rápida do que o habitual ({pct}).", { s: gap, pct: pctText(b.devPct) })
      : b.devPct > 0
        ? t("Em média, cada rep saiu {s} mais lenta do que o habitual ({pct}).", { s: gap, pct: pctText(b.devPct) })
        : t("Em média, cada rep saiu {s} mais rápida do que o habitual ({pct}).", { s: gap, pct: pctText(b.devPct) });
  const why = b.noise
    ? ""
    : fast && slow
      ? t("{fast} associa-se a mais rápido; {slow}, a mais lento.", { fast: name(fast.key), slow: lowerFirst(name(slow.key)) })
      : fast
        ? t("{fast} associa-se a mais rápido.", { fast: name(fast.key) })
        : slow
          ? t("{slow} associa-se a mais lento.", { slow: name(slow.key) })
          : "";
  const mostlyUnexplained = !b.noise && Math.abs(b.unexplainedS) > Math.abs(b.expectedS - b.levelS);

  const edges = [0, b.devPct, expectedPct - marginPct, expectedPct + marginPct];
  let acc = 0;
  const steps = bars.map((bar) => {
    const from = acc;
    acc += pct(bar.seconds);
    edges.push(from, acc);
    return { ...bar, from, to: acc };
  });
  const lo = Math.min(...edges) - 0.2;
  const hi = Math.max(...edges) + 0.2;
  const at = (value: number) => ((value - lo) / (hi - lo)) * 100;
  const secondsTip = (seconds: number) => (single ? secText(seconds) : t("{s} por rep", { s: perRep(seconds) }));

  return (
    <Card
      id="porque"
      question={question}
      answer={
        <>
          <span className={b.noise ? "" : `font-semibold ${dirText(b.devPct)}`}>{headline}</span> {why} {mostlyUnexplained ? t("A maior parte da diferença fica sem explicação.") : ""}
        </>
      }
      details={
        <>
          <DetailsTable
            caption={t("Decomposição do tempo: nível, fatores, esperado, real e parte sem explicação")}
            head={[t("Parte"), single ? t("Segundos") : t("s por rep"), "%", t("Aprendido em (reps)")]}
            rows={[
              [t("Nível habitual"), single ? formatSeconds(b.levelS) : formatSeconds(b.levelS / b.reps), "—", "—"],
              ...sorted.map((factor) => [name(factor.key), single ? secText(factor.seconds) : perRep(factor.seconds), pctText(factor.pct), factor.support]),
              [t("Esperado (± margem)"), `${single ? formatSeconds(b.expectedS) : formatSeconds(b.expectedS / b.reps)} ± ${(single ? secText(b.marginS) : perRep(b.marginS)).replace("+", "")}`, pctText(expectedPct), "—"],
              [t("Real"), single ? formatSeconds(b.actualS) : formatSeconds(b.actualS / b.reps), pctText(b.devPct), "—"],
              [t("Sem explicação"), single ? secText(b.unexplainedS) : perRep(b.unexplainedS), pctText(unexplainedPct), "—"],
            ]}
          />
          <ul className="mt-2 space-y-0.5 text-xs text-mute">
            <li>{t("Reps: {n}. Habitual = mediana ponderada das reps iguais anteriores. Fatores com menos de 8 reps juntam-se em “Fatores com poucos dados”.", { n: b.reps })}</li>
            {b.noSleep ? (
              <li>{b.noSleep === b.reps ? t("Sono não registado: o sono não entra.") : t("Sono não registado em {n} de {total} reps: aí o sono não entra.", { n: b.noSleep, total: b.reps })}</li>
            ) : null}
            {b.reps > 1 ? <li>{t("A margem de várias reps é a soma das margens, porque as reps do mesmo dia variam juntas.")}</li> : null}
          </ul>
        </>
      }
    >
      {children}
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        {single ? (
          <>
            <Stat label={t("Real")} value={formatSeconds(b.actualS)} />
            <Stat label={t("Habitual")} value={formatSeconds(b.levelS)} />
          </>
        ) : (
          <Stat label={t("Reps")} value={String(b.reps)} />
        )}
        <Stat label={t("Diferença")} value={pctText(b.devPct)} tone={b.noise ? "" : dirText(b.devPct)} />
      </div>
      {!b.noise && b.factors.length ? (
        <ul className="mt-4 space-y-1.5">
          {steps.map((step) => (
            <li key={step.key}>
              <Tip
                tip={
                  step.support != null
                    ? t("Associa-se a {s} ({pct}) · aprendido em {n} reps", { s: secondsTip(step.seconds), pct: pctText(step.to - step.from), n: step.support })
                    : t("Associa-se a {s} ({pct}) · soma dos restantes fatores", { s: secondsTip(step.seconds), pct: pctText(step.to - step.from) })
                }
              >
                <Waterfall name={step.name} from={step.from} to={step.to} at={at} />
              </Tip>
            </li>
          ))}
          <li>
            <Tip tip={t("Esperado {pct}, margem ± {m}", { pct: pctText(expectedPct), m: pctText(marginPct).replace("+", "") })}>
              <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-0.5 text-sm sm:grid-cols-[12rem_1fr_4.5rem]">
                <span className="font-semibold">{t("Esperado")}</span>
                <Track at={at}>
                  <span className="absolute inset-y-0 rounded-full bg-line" style={{ left: `${at(expectedPct - marginPct)}%`, width: `${at(expectedPct + marginPct) - at(expectedPct - marginPct)}%` }} />
                  <span className="absolute -inset-y-0.5 w-1 rounded bg-mute" style={{ left: `${at(expectedPct)}%` }} />
                </Track>
                <span className="text-right tabular-nums">{pctText(expectedPct)}</span>
              </span>
            </Tip>
          </li>
          <li>
            <Tip tip={t("Real {pct}; fica sem explicação {rest} ({inside})", { pct: pctText(b.devPct), rest: pctText(unexplainedPct), inside: Math.abs(b.unexplainedS) <= b.marginS ? t("dentro da margem") : t("fora da margem") })}>
              <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-0.5 text-sm sm:grid-cols-[12rem_1fr_4.5rem]">
                <span className="font-semibold">{t("Real")}</span>
                <Track at={at}>
                  <span className="absolute inset-y-0 rounded-full bg-line" style={{ left: `${at(Math.min(expectedPct, b.devPct))}%`, width: `${Math.abs(at(b.devPct) - at(expectedPct))}%` }} />
                  <span className={`absolute -inset-y-1 w-1.5 rounded ${b.devPct > 0 ? "bg-slower" : "bg-faster"}`} style={{ left: `${at(b.devPct)}%` }} />
                </Track>
                <span className={`text-right font-semibold tabular-nums ${dirText(b.devPct)}`}>{pctText(b.devPct)}</span>
              </span>
            </Tip>
          </li>
        </ul>
      ) : null}
      {!b.noise && !b.factors.length ? <p className="mt-3 text-sm text-mute">{t("Ainda poucos dados para pesar fatores: são precisas 8 reps anteriores.")}</p> : null}
      {!b.noise && b.factors.length ? (
        <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-mute">
          <Swatch className="bg-faster" label={t("associa-se a mais rápido")} />
          <Swatch className="bg-slower" label={t("associa-se a mais lento")} />
          <span>{t("Toque ou passe o rato para ver os valores.")}</span>
        </p>
      ) : null}
    </Card>
  );
}

function Track({ at, children }: { at: (pct: number) => number; children?: React.ReactNode }) {
  return (
    <span className="relative order-last col-span-2 block h-3 rounded-full bg-panel-2 sm:order-none sm:col-span-1" aria-hidden>
      <span className="absolute -inset-y-1 w-px bg-line-strong" style={{ left: `${at(0)}%` }} />
      {children}
    </span>
  );
}

function Waterfall({ name, from, to, at }: { name: string; from: number; to: number; at: (pct: number) => number }) {
  const delta = to - from;
  return (
    <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-0.5 text-sm sm:grid-cols-[12rem_1fr_4.5rem]">
      <span className="truncate">{name}</span>
      <Track at={at}>
        <span className={`absolute inset-y-0 rounded-full ${delta > 0 ? "bg-slower" : "bg-faster"}`} style={{ left: `${at(Math.min(from, to))}%`, width: `${Math.max(1, Math.abs(at(to) - at(from)))}%` }} />
      </Track>
      <span className={`text-right tabular-nums ${dirText(delta)}`}>{pctText(delta)}</span>
    </span>
  );
}

/** The 7-day line is cut at breaks of 10+ days instead of bridging them. */
function segments(days: DayPoint[]): DayPoint[][] {
  const out: DayPoint[][] = [];
  for (const day of days) {
    const last = out.at(-1)?.at(-1);
    if (last && addDays(last.date, 10) > day.date) out.at(-1)!.push(day);
    else out.push([day]);
  }
  return out;
}

type Race = { date: string; meetTitle: string };

/** D. Mean gap to level (7-day mean) over the season, weekly km below, races and abnormal days marked; a week opens its breakdown. */
function FormChart({ days, weeks, races, selected, onWeek }: { days: DayPoint[]; weeks: LoadPoint[]; races: Race[]; selected: string | null; onWeek: (week: string) => void }) {
  const t = useT();
  const [tip, setTip] = useState<ChartTip>(null);
  const W = 640;
  const TOP = 130;
  const BARS = 40;
  const H = TOP + BARS + 18;
  const first = Date.parse(weekStartMonday(days[0].date));
  const last = Date.parse(addDays(weekStartMonday(days[days.length - 1].date), 7));
  const x = (iso: string) => 8 + ((Date.parse(iso) - first) / Math.max(1, last - first)) * (W - 16);
  const span = Math.max(2, ...days.map((day) => Math.abs(day.rollingPct)));
  // Slower (positive) goes down, as in the other charts: faster is up.
  const y = (pct: number) => 8 + ((Math.max(-span, Math.min(span, pct)) + span) / (2 * span)) * (TOP - 16);
  const maxKm = Math.max(1, ...weeks.map((week) => week.km));
  const abnormal = days.filter((day) => day.abnormal);
  const recent = weeks.slice(-4);
  const recentPct = recent.length ? recent.reduce((sum, week) => sum + week.devPct, 0) / recent.length : 0;
  const inWeek = (week: string, date: string) => date >= week && date <= addDays(week, 6);

  return (
    <Card
      question={t("Como está a forma ao longo da época?")}
      answer={
        <>
          {isNoise(recentPct) ? (
            t("Nas últimas {n} semanas, os tempos estão ao nível habitual (diferença abaixo de 1 %).", { n: recent.length })
          ) : (
            <>
              {t("Nas últimas {n} semanas, os tempos estão em média", { n: recent.length })}{" "}
              <strong className={dirText(recentPct)}>{recentPct > 0 ? t("{pct} mais lentos", { pct: pctText(recentPct).replace("+", "") }) : t("{pct} mais rápidos", { pct: pctText(recentPct).replace("−", "") })}</strong>{" "}
              {t("do que o habitual.")}
            </>
          )}{" "}
          <span className="text-mute">{t("Toque numa semana para ver porquê.")}</span>
        </>
      }
      details={
        <DetailsTable
          caption={t("Forma por semana")}
          head={[t("Semana"), t("km"), t("Desvio face ao nível"), t("Dias anormais"), t("Provas")]}
          rows={weeks.map((week) => [
            formatDatePt(week.week),
            week.km.toFixed(1).replace(".", ","),
            isNoise(week.devPct) ? t("{dev} (ruído)", { dev: pctText(week.devPct) }) : pctText(week.devPct),
            abnormal.filter((day) => inWeek(week.week, day.date)).length || "—",
            races.filter((race) => inWeek(week.week, race.date)).length || "—",
          ])}
        />
      }
    >
      <ChartFrame tip={tip}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={t("Desvio face ao nível ao longo da época, média de 7 dias; mais rápido em cima. Barras: km por semana.")}>
          <rect x={0} y={y(-1)} width={W} height={y(1) - y(-1)} className="fill-panel-2" />
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-line-strong" strokeDasharray="4 3" />
          {weeks.map((week) => {
            const height = Math.max(1, (week.km / maxKm) * BARS);
            const x0 = x(week.week);
            const width = Math.max(2, x(addDays(week.week, 7)) - x0 - 2);
            const nAbnormal = abnormal.filter((day) => inWeek(week.week, day.date)).length;
            const nRaces = races.filter((race) => inWeek(week.week, race.date)).length;
            const text = [
              t("Semana de {date}: {km} km, {dev}", { date: formatDatePt(week.week), km: week.km.toFixed(1).replace(".", ","), dev: pctText(week.devPct) }),
              nAbnormal ? t("dias anormais: {n}", { n: nAbnormal }) : "",
              nRaces ? t("provas: {n}", { n: nRaces }) : "",
              t("toque para ver porquê"),
            ]
              .filter(Boolean)
              .join(" · ");
            const props = tipProps(text, ((x0 + width / 2) / W) * 100, 8, setTip);
            return (
              <g
                key={week.week}
                {...props}
                role="button"
                onClick={() => onWeek(week.week)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onWeek(week.week);
                  }
                }}
              >
                <rect x={x0} y={0} width={width + 2} height={TOP + BARS} fill="transparent" />
                <rect x={x0 + 1} y={TOP + BARS - height} width={width} height={height} rx={2} className={selected === week.week ? "fill-aqua" : "fill-line"} />
              </g>
            );
          })}
          {races.map((race) => (
            <line key={`${race.date}-${race.meetTitle}`} x1={x(race.date)} x2={x(race.date)} y1={4} y2={TOP} className="stroke-mute" strokeDasharray="2 3" pointerEvents="none" />
          ))}
          {segments(days).map((part) => (
            <polyline key={part[0].date} points={part.map((day) => `${x(day.date)},${y(day.rollingPct)}`).join(" ")} fill="none" className="stroke-aqua" strokeWidth={2.5} pointerEvents="none" />
          ))}
          {abnormal.map((day) => (
            <circle key={day.date} cx={x(day.date)} cy={y(day.rollingPct)} r={4.5} fill="none" className={day.devPct > 0 ? "stroke-slower" : "stroke-faster"} strokeWidth={2} pointerEvents="none" />
          ))}
          <text x={4} y={14} className="fill-mute text-[10px]">
            {t("↑ mais rápido")}
          </text>
          {weeks.filter((_, i) => i % 4 === 0).map((week) => (
            <text key={week.week} x={x(week.week)} y={H - 4} className="fill-mute text-[10px]">
              {formatDatePt(week.week).slice(0, 5)}
            </text>
          ))}
        </svg>
      </ChartFrame>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
        <Swatch line className="bg-aqua" label={t("média de 7 dias")} />
        <Swatch className="rounded-sm bg-line" label={t("km por semana")} />
        <Swatch className="border-2 border-slower bg-transparent" label={t("dia anormal")} />
        <Swatch line className="bg-mute" label={t("prova")} />
        <Swatch className="rounded-sm bg-panel-2" label={t("± 1 %: ruído")} />
      </p>
    </Card>
  );
}
