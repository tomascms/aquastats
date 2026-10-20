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
import { CompareSessions, FactorProfile, kindLabel, LoadScatter, SetCurveChart } from "./tempos-graficos";

/** 26 weeks shown, plus the 6 weeks each level looks back on. */
const SHOWN_DAYS = 182;
const LOOKBACK_DAYS = 42;
/** Factors below this share are pooled in the waterfall, to keep it readable. */
const SMALL_PCT = 0.1;

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
      km,
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
    document.getElementById("porque-titulo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Section>
      <p className="mt-2 text-sm text-mist">
        {t("Associações, não causas: a parte de contexto do modelo não passou no backtest, por isso cada valor traz a sua margem.")}
      </p>

      <h3 className="mt-5 font-display text-lg font-bold">{t("Forma ao longo da época")}</h3>
      <FormChart days={data.days} weeks={data.weeks} races={data.races} selected={scope === "week" ? weekKey : null} onWeek={openWeek} />

      <h3 id="porque-titulo" className="mt-6 font-display text-lg font-bold">
        {t("Porquê este tempo?")}
      </h3>
      <div className="mt-2 flex flex-wrap items-end gap-2">
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
            {t("Semana")}
            <select className="field mt-1 h-11 w-auto py-1 text-sm" value={weekKey} onChange={(event) => setWeek(event.target.value)}>
              {[...data.weeks].reverse().map((item) => (
                <option key={item.week} value={item.week}>
                  {formatDatePt(item.week)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-xs text-mute">
            {t("Treino")}
            <select
              className="field mt-1 h-11 w-auto py-1 text-sm"
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
            {t("Rep")}
            <select className="field mt-1 h-11 w-auto max-w-full py-1 text-sm" value={rep?.row.log.id} onChange={(event) => setRepId(event.target.value)}>
              {sessionReps.map((item, index) => (
                <option key={item.row.log.id} value={item.row.log.id}>
                  {`${index + 1}. ${kindLabel(item.row)} · ${formatSeconds(item.actualS)}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <Cascade b={breakdown(picked)} />

      <h3 className="mt-6 font-display text-lg font-bold">{t("Comparar dois treinos")}</h3>
      <CompareSessions list={data.list} wellness={data.wellness} trainingDays={data.trainingDays} />

      <h3 className="mt-6 font-display text-lg font-bold">{t("Curva dentro da série")}</h3>
      <SetCurveChart list={data.list} />

      <h3 className="mt-6 font-display text-lg font-bold">{t("Tempos e carga semanal")}</h3>
      <LoadScatter weeks={data.weeks} />

      <h3 className="mt-6 font-display text-lg font-bold">{t("Perfil de fatores do atleta")}</h3>
      <FactorProfile rows={data.rows} />
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

type Scale = (pct: number) => number;

/** Sums of a week run past an hour: h:mm:ss.d. */
const clock = (s: number) =>
  s < 3600 ? formatSeconds(s) : `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;

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

function Bar({ at, from, to, tone }: { at: Scale; from: number; to: number; tone: string }) {
  return <span className={`absolute top-0.5 h-2.5 rounded-sm ${tone}`} style={{ left: `${at(Math.min(from, to))}%`, width: `${Math.max(0.8, at(Math.max(from, to)) - at(Math.min(from, to)))}%` }} />;
}

function Track({ at, children }: { at: Scale; children?: React.ReactNode }) {
  return (
    <span className="relative block h-3.5 w-full min-w-24 rounded bg-panel-2" aria-hidden>
      <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${at(0)}%` }} />
      {children}
    </span>
  );
}

/** Waterfall as a table: level → each factor → expected (± margin) → real → what is left unexplained. */
function Cascade({ b }: { b: Breakdown | null }) {
  const t = useT();
  if (!b) return <p className="mt-3 text-sm text-mute">{t("Sem reps com nível habitual neste período.")}</p>;
  const levelPct = (s: number) => (s / b.levelS) * 100;
  const expectedPct = levelPct(b.expectedS - b.levelS);
  const marginPct = levelPct(b.marginS);
  const steps: { key: string; label: string; from: number; to: number; seconds: number; support: number }[] = [];
  let acc = 0;
  const factors = b.noise ? [] : b.factors;
  const small = factors.filter((factor) => Math.abs(factor.pct) < SMALL_PCT);
  const shown = factors.filter((factor) => Math.abs(factor.pct) >= SMALL_PCT);
  if (small.length) {
    const seconds = small.reduce((sum, factor) => sum + factor.seconds, 0);
    shown.push({ key: "small", label: t("Outros fatores (menos de 0,1 % cada)"), pct: levelPct(seconds), seconds, support: Math.min(...small.map((factor) => factor.support)) });
  }
  for (const factor of shown) {
    steps.push({ key: factor.key, label: factor.label, from: acc, to: acc + factor.pct, seconds: factor.seconds, support: factor.support });
    acc += factor.pct;
  }
  const edges = [0, b.devPct, expectedPct - marginPct, expectedPct + marginPct, ...steps.flatMap((step) => [step.from, step.to])];
  const lo = Math.min(...edges) - 0.2;
  const hi = Math.max(...edges) + 0.2;
  const at = (pct: number) => ((pct - lo) / (hi - lo)) * 100;
  const tone = (pct: number) => (pct > 0 ? "bg-slower" : "bg-faster");
  const context = expectedPct;
  const inMargin = Math.abs(b.unexplainedS) <= b.marginS;

  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-mist">
        {b.noise
          ? t("Real {real} face ao nível {level}: {dev}. Abaixo de 1 % é ruído e não se explica.", {
              real: clock(b.actualS),
              level: clock(b.levelS),
              dev: pctText(b.devPct),
            })
          : t("Real {real} face ao nível {level}: {dev}. O contexto associa-se a {ctx} (margem ± {m}); fica sem explicação {rest}.", {
              real: clock(b.actualS),
              level: clock(b.levelS),
              dev: pctText(b.devPct),
              ctx: pctText(context),
              m: pctText(marginPct).replace("+", ""),
              rest: pctText(levelPct(b.unexplainedS)),
            })}
      </p>
      <table className="mt-2 w-full text-[13px] tabular-nums sm:text-sm">
        <caption className="sr-only">{t("Decomposição do tempo: nível, fatores, esperado, real e parte sem explicação")}</caption>
        <thead>
          <tr className="text-left text-xs text-mute">
            <th scope="col" className="py-1 font-medium">
              {t("Parte")}
            </th>
            <th scope="col" className="w-2/5 py-1 font-medium">
              <span className="sr-only">{t("Gráfico")}</span>
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">
              {t("Segundos")}
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line">
            <th scope="row" className="py-1.5 pr-2 text-left font-medium">
              {t("Nível habitual")}
            </th>
            <td>
              <Track at={at} />
            </td>
            <td className="whitespace-nowrap pl-2 text-right">{clock(b.levelS)}</td>
            <td className="pl-2 text-right text-mute">—</td>
          </tr>
          {steps.map((step) => (
            <tr key={step.key} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                {step.label}
                <span className="block text-xs text-mute">
                  {step.key === "few-data" || step.key === "small"
                    ? t("não se mostram em separado")
                    : t("associa-se a {s} · aprendido em {n} reps", { s: secText(step.seconds), n: step.support })}
                </span>
              </th>
              <td>
                <Track at={at}>
                  <Bar at={at} from={step.from} to={step.to} tone={tone(step.to - step.from)} />
                </Track>
              </td>
              <td className={`whitespace-nowrap pl-2 text-right ${step.seconds > 0 ? "text-slower" : "text-faster"}`}>{secText(step.seconds)}</td>
              <td className={`whitespace-nowrap pl-2 text-right ${step.seconds > 0 ? "text-slower" : "text-faster"}`}>{pctText(step.to - step.from)}</td>
            </tr>
          ))}
          {!b.noise ? (
            <tr className="border-t border-line">
              <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                {t("Esperado")}
                <span className="block text-xs font-normal text-mute">{t("margem ± {s}", { s: secText(b.marginS).replace("+", "") })}</span>
              </th>
              <td>
                <Track at={at}>
                  <span className="absolute top-0 h-3.5 rounded-sm bg-pool-soft" style={{ left: `${at(expectedPct - marginPct)}%`, width: `${at(expectedPct + marginPct) - at(expectedPct - marginPct)}%` }} />
                  <span className="absolute top-0 h-3.5 w-0.5 bg-pool" style={{ left: `${at(expectedPct)}%` }} />
                </Track>
              </td>
              <td className="whitespace-nowrap pl-2 text-right">{clock(b.expectedS)}</td>
              <td className="whitespace-nowrap pl-2 text-right">{pctText(expectedPct)}</td>
            </tr>
          ) : null}
          <tr className="border-t border-line">
            <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
              {t("Real")}
            </th>
            <td>
              <Track at={at}>
                <span className="absolute -top-0.5 h-4 w-1 rounded bg-mist" style={{ left: `${at(b.devPct)}%` }} />
              </Track>
            </td>
            <td className="whitespace-nowrap pl-2 text-right font-semibold">{clock(b.actualS)}</td>
            <td className="whitespace-nowrap pl-2 text-right font-semibold">{pctText(b.devPct)}</td>
          </tr>
          {!b.noise ? (
            <tr className="border-t border-line">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                {t("Sem explicação")}
                <span className="block text-xs text-mute">{inMargin ? t("dentro da margem") : t("fora da margem")}</span>
              </th>
              <td>
                <Track at={at}>
                  <Bar at={at} from={expectedPct} to={b.devPct} tone="bg-coral" />
                </Track>
              </td>
              <td className="whitespace-nowrap pl-2 text-right">{secText(b.unexplainedS)}</td>
              <td className="whitespace-nowrap pl-2 text-right">{pctText(levelPct(b.unexplainedS))}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <ul className="mt-2 space-y-0.5 text-xs text-mute">
        <li>{t("Reps: {n} · % face ao nível habitual (mediana ponderada das reps iguais anteriores); + mais lento, − mais rápido.", { n: b.reps })}</li>
        {!b.noise && !b.factors.length ? <li>{t("Ainda poucos dados para pesar fatores: são precisas 8 reps anteriores.")}</li> : null}
        {b.noSleep ? (
          <li>{b.noSleep === b.reps ? t("Sono não registado: o sono não entra.") : t("Sono não registado em {n} de {total} reps: aí o sono não entra.", { n: b.noSleep, total: b.reps })}</li>
        ) : null}
        {b.reps > 1 ? <li>{t("Numa soma as reps longas pesam mais do que na média por rep do gráfico da época; a margem é a soma das margens, porque as reps do mesmo dia variam juntas.")}</li> : null}
      </ul>
    </div>
  );
}

type Race = { date: string; meetTitle: string };

/** Mean gap to level (7-day mean) over the season, weekly km below, races and abnormal days marked; a week opens its breakdown. */
function FormChart({ days, weeks, races, selected, onWeek }: { days: DayPoint[]; weeks: LoadPoint[]; races: Race[]; selected: string | null; onWeek: (week: string) => void }) {
  const t = useT();
  const W = 640;
  const TOP = 150;
  const BARS = 48;
  const H = TOP + BARS + 18;
  const first = Date.parse(weekStartMonday(days[0].date));
  const last = Date.parse(addDays(weekStartMonday(days[days.length - 1].date), 7));
  const x = (iso: string) => 8 + ((Date.parse(iso) - first) / Math.max(1, last - first)) * (W - 16);
  const span = Math.max(2, ...days.map((day) => Math.abs(day.rollingPct)), ...days.map((day) => Math.min(6, Math.abs(day.devPct))));
  // Slower (positive) goes down, as in the other charts: faster is up.
  const y = (pct: number) => 8 + ((Math.max(-span, Math.min(span, pct)) + span) / (2 * span)) * (TOP - 16);
  const maxKm = Math.max(1, ...weeks.map((week) => week.km));
  const abnormal = days.filter((day) => day.abnormal);

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("Desvio face ao nível ao longo da época, média de 7 dias; mais rápido em cima. Barras: km por semana.")}>
        <rect x={0} y={y(-1)} width={W} height={y(1) - y(-1)} className="fill-panel-2" />
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-line-strong" strokeDasharray="4 3" />
        <text x={4} y={y(span) - 2} className="fill-mute text-[10px]">{t("mais lento")}</text>
        <text x={4} y={y(-span) + 10} className="fill-mute text-[10px]">{t("mais rápido")}</text>
        {races.map((race) => (
          <g key={`${race.date}-${race.meetTitle}`}>
            <line x1={x(race.date)} x2={x(race.date)} y1={0} y2={TOP + BARS} className="stroke-pool" strokeDasharray="2 2" />
            <path d={`M${x(race.date) - 4},0 L${x(race.date) + 4},0 L${x(race.date)},6 Z`} className="fill-pool">
              <title>{`${formatDatePt(race.date)} · ${race.meetTitle}`}</title>
            </path>
          </g>
        ))}
        {days.map((day) => (
          <circle key={day.date} cx={x(day.date)} cy={y(day.devPct)} r={1.8} className="fill-mute" opacity={0.6} />
        ))}
        {segments(days).map((part) => (
          <polyline key={part[0].date} points={part.map((day) => `${x(day.date)},${y(day.rollingPct)}`).join(" ")} fill="none" className="stroke-aqua" strokeWidth={2} />
        ))}
        {abnormal.map((day) => (
          <circle key={day.date} cx={x(day.date)} cy={y(day.devPct)} r={4.5} fill="none" className="stroke-coral" strokeWidth={2}>
            <title>{t("{date}: dia anormal ({dev})", { date: formatDatePt(day.date), dev: pctText(day.devPct) })}</title>
          </circle>
        ))}
        {weeks.map((week) => {
          const height = Math.max(1, (week.km / maxKm) * BARS);
          const x0 = x(week.week);
          const width = Math.max(2, x(addDays(week.week, 7)) - x0 - 2);
          return (
            <g
              key={week.week}
              role="button"
              tabIndex={0}
              aria-label={t("Semana de {date}: ver porquê", { date: formatDatePt(week.week) })}
              className="cursor-pointer outline-none [&:focus-visible>rect:last-child]:stroke-pool"
              onClick={() => onWeek(week.week)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onWeek(week.week);
                }
              }}
            >
              <title>{t("Semana de {date}: {km} km, {dev}", { date: formatDatePt(week.week), km: week.km.toFixed(1).replace(".", ","), dev: pctText(week.devPct) })}</title>
              <rect x={x0} y={0} width={width + 2} height={TOP + BARS} fill="transparent" />
              <rect x={x0 + 1} y={TOP + BARS - height} width={width} height={height} rx={2} className={selected === week.week ? "fill-pool" : "fill-aqua"} opacity={selected === week.week ? 1 : 0.45} strokeWidth={2} />
            </g>
          );
        })}
        {weeks.filter((_, i) => i % 4 === 0).map((week) => (
          <text key={week.week} x={x(week.week)} y={H - 4} className="fill-mute text-[10px]">
            {formatDatePt(week.week).slice(0, 5)}
          </text>
        ))}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
        <span>
          <span aria-hidden className="mr-1 inline-block h-0.5 w-4 bg-aqua align-middle" />
          {t("média de 7 dias")}
        </span>
        <span>
          <span aria-hidden className="mr-1 inline-block h-2.5 w-4 bg-panel-2 align-middle" />
          {t("± 1 %: ruído")}
        </span>
        <span>
          <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-coral align-middle" />
          {t("dia anormal: o dia todo no mesmo sentido")}
        </span>
        <span>
          <span aria-hidden className="mr-1 inline-block h-2.5 w-0.5 bg-pool align-middle" />
          {t("prova")}
        </span>
        <span>{t("Clique numa semana para ver porquê.")}</span>
      </p>
      <details className="mt-2 overflow-x-auto text-sm">
        <summary className="cursor-pointer text-mute">{t("Ver em tabela")}</summary>
        <table className="mt-2 w-full text-[13px] tabular-nums">
          <caption className="sr-only">{t("Forma por semana")}</caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="font-medium">{t("Semana")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("km")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Desvio face ao nível")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Dias anormais")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Provas")}</th>
              <th scope="col" className="pl-2 font-medium"><span className="sr-only">{t("Ação")}</span></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const end = addDays(week.week, 6);
              const inWeek = (date: string) => date >= week.week && date <= end;
              return (
                <tr key={week.week} className="border-t border-line">
                  <td className="py-1">{formatDatePt(week.week)}</td>
                  <td className="pl-2 text-right">{week.km.toFixed(1).replace(".", ",")}</td>
                  <td className="pl-2 text-right">{isNoise(week.devPct) ? t("{dev} (ruído)", { dev: pctText(week.devPct) }) : pctText(week.devPct)}</td>
                  <td className="pl-2 text-right">{abnormal.filter((day) => inWeek(day.date)).length || "—"}</td>
                  <td className="pl-2 text-right">{races.filter((race) => inWeek(race.date)).length || "—"}</td>
                  <td className="pl-2 text-right">
                    <button type="button" className="text-aqua underline" onClick={() => onWeek(week.week)}>
                      {t("Porquê?")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
