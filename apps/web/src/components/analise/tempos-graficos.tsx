"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";
import {
  isNoise,
  loadSlope,
  pctText,
  secText,
  sessionChanges,
  sessionKey,
  setCurve,
  setsOf,
  MIN_LOAD_WEEKS,
  type ExplainedRep,
  type LoadPoint,
} from "@/lib/explained-times";
import { courseLabel, formatDatePt, strokeLabel } from "@/lib/labels";
import { formatSeconds } from "@/lib/race";
import { PHASES, phaseOf } from "@/lib/season";
import type { TrainingRep } from "@/lib/training-context";
import { groupKey, learnedPatterns, MIN_FACTOR_SUPPORT } from "@/lib/training-prediction";
import type { WellnessEntry } from "@/lib/types";

export const kindLabel = (row: TrainingRep) =>
  [`${row.distanceM} ${strokeLabel(row.stroke)}`.trim(), row.intensity, row.gearLabel, courseLabel(row.course)].filter(Boolean).join(" · ");

/** Short, plain names for the model's factors (the model's own labels are precise but long). */
const FACTOR_NAME: Record<string, MessageKey> = {
  trend: "Tendência recente",
  morning: "Treino de manhã",
  second: "2.º treino do dia",
  position: "Fim da série",
  sendoff: "Saída mais longa",
  block: "Partida do bloco",
  loadBefore: "Volume antes, no treino",
  weekly: "Volume da semana",
  streak: "Dias seguidos",
  return: "Regresso de paragem",
  sleep: "Sono curto",
  gymStrength: "Ginásio de força",
  gymExplosive: "Ginásio explosivo",
  gymMobility: "Mobilidade",
  "few-data": "Fatores com poucos dados",
  others: "Outros",
};
const WEEKDAYS: MessageKey[] = ["Treino à segunda", "Treino à terça", "Treino à quarta", "Treino à quinta", "Treino à sexta", "Treino ao sábado", "Treino ao domingo"];
/** Lower-case first letter, for a name in the middle of a sentence. */
export const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function useFactorName() {
  const t = useT();
  return (key: string) => (key.startsWith("weekday-") ? t(WEEKDAYS[Number(key.slice(8))]) : FACTOR_NAME[key] ? t(FACTOR_NAME[key]) : key);
}

/** Faster is good news, slower is not: the only two colours with meaning. */
export const dirText = (pct: number) => (pct > 0 ? "text-slower" : "text-faster");
export const dirBg = (pct: number) => (pct > 0 ? "bg-slower" : "bg-faster");

/** One question per card: title, one-sentence answer, a clean chart, the rest folded away. */
export function Card({ id, question, answer, children, details }: { id?: string; question: string; answer: ReactNode; children?: ReactNode; details?: ReactNode }) {
  const t = useT();
  return (
    <article id={id} className="rounded-2xl border border-line p-4 sm:p-5">
      <h3 className="font-display text-lg font-bold">{question}</h3>
      <p className="mt-1 text-[15px] leading-snug text-mist">{answer}</p>
      {children ? <div className="mt-4">{children}</div> : null}
      {details ? (
        <details className="mt-4 overflow-x-auto text-sm">
          <summary className="cursor-pointer text-mute">{t("Ver detalhes")}</summary>
          <div className="mt-2">{details}</div>
        </details>
      ) : null}
    </article>
  );
}

/** Hover, keyboard focus or a tap shows the detail; the same text is the button's accessible description. */
export function Tip({ tip, children, className = "" }: { tip: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={`group relative block ${className}`}>
      <button type="button" aria-describedby={id} onClick={() => setOpen((value) => !value)} onBlur={() => setOpen(false)} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-pool">
        {children}
      </button>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-64 -translate-x-1/2 rounded-lg bg-mist px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg ${open ? "visible" : "invisible group-hover:visible group-focus-within:visible"}`}
      >
        {tip}
      </span>
    </span>
  );
}

export type ChartTip = { x: number; y: number; text: string } | null;

/** SVG charts keep their marks clean; the hovered or focused mark's detail floats above it (x, y in % of the chart). */
export function ChartFrame({ tip, children }: { tip: ChartTip; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-max max-w-72 -translate-x-1/2 -translate-y-full rounded-lg bg-mist px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg"
          style={{ left: `${Math.min(85, Math.max(15, tip.x))}%`, top: `calc(${tip.y}% - 6px)` }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}

/** Props that make an SVG mark show its tip on hover, focus and tap, and read it to screen readers. */
export const tipProps = (text: string, x: number, y: number, setTip: (tip: ChartTip) => void) => ({
  tabIndex: 0,
  role: "img" as const,
  "aria-label": text,
  onMouseEnter: () => setTip({ x, y, text }),
  onMouseLeave: () => setTip(null),
  onFocus: () => setTip({ x, y, text }),
  onBlur: () => setTip(null),
  onClick: () => setTip({ x, y, text }),
  className: "cursor-pointer outline-none",
});

const W = 640;

/** Times rep by rep for one or two series; faster is up. Hover a rep for its times. */
function RepLines({ series, label, tipFor }: { series: { times: (number | null)[]; stroke: string; fill: string; dashed?: boolean }[]; label: string; tipFor: (i: number) => string }) {
  const [tip, setTip] = useState<ChartTip>(null);
  const H = 150;
  const values = series.flatMap((item) => item.times.filter((v): v is number => v != null));
  const count = Math.max(...series.map((item) => item.times.length));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.15, 0.2);
  const step = (W - 32) / Math.max(1, count - 1);
  const x = (i: number) => 16 + (count > 1 ? i * step : (W - 32) / 2);
  const y = (s: number) => 12 + ((s - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 36);
  return (
    <ChartFrame tip={tip}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={label}>
        {series.map((item, index) => (
          <polyline
            key={index}
            points={item.times.map((value, i) => (value == null ? null : `${x(i)},${y(value)}`)).filter(Boolean).join(" ")}
            fill="none"
            className={item.stroke}
            strokeWidth={item.dashed ? 2 : 2.5}
            strokeDasharray={item.dashed ? "5 4" : undefined}
          />
        ))}
        {series.map((item, index) =>
          item.dashed ? null : item.times.map((value, i) => (value == null ? null : <circle key={`${index}-${i}`} cx={x(i)} cy={y(value)} r={3.5} className={item.fill} />)),
        )}
        {Array.from({ length: count }, (_, i) => (
          <g key={i}>
            <rect x={x(i) - step / 2} y={0} width={step} height={H - 18} fill="transparent" {...tipProps(tipFor(i), (x(i) / W) * 100, 10, setTip)} />
            {count <= 20 || i % 5 === 4 ? (
              <text x={x(i)} y={H - 4} textAnchor="middle" className="fill-mute text-[10px]">
                {i + 1}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}

export function Swatch({ className, label, line = false }: { className: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`inline-block ${line ? "h-0.5 w-4" : "h-2.5 w-2.5 rounded-full"} ${className}`} />
      {label}
    </span>
  );
}

export function DetailsTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-[13px] tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-xs text-mute">
          {head.map((cell, i) => (
            <th key={i} scope="col" className={`py-1 font-medium ${i ? "pl-2 text-right" : ""}`}>
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-t border-line">
            {row.map((cell, i) => (
              <td key={i} className={`py-1 ${i ? "pl-2 text-right" : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** B. Two days of the same kind of set side by side, and what was different: data only. */
export function CompareSessions({ list, wellness, trainingDays }: { list: ExplainedRep[]; wellness: WellnessEntry[]; trainingDays: Set<string> }) {
  const t = useT();
  const groups = useMemo(() => {
    const out = new Map<string, Map<string, ExplainedRep[]>>();
    for (const rep of list) {
      const byGroup = out.get(groupKey(rep.row)) ?? new Map<string, ExplainedRep[]>();
      byGroup.set(sessionKey(rep.row), [...(byGroup.get(sessionKey(rep.row)) ?? []), rep]);
      out.set(groupKey(rep.row), byGroup);
    }
    // Sets swum as a series (3+ reps) first: a single 400 easy says little rep by rep.
    const series = (byDay: Map<string, ExplainedRep[]>) => [...byDay.values()].filter((reps) => reps.length >= 3).length;
    return [...out.entries()].filter(([, sessions]) => sessions.size >= 2).sort(([, a], [, b]) => series(b) - series(a) || b.size - a.size);
  }, [list]);
  const [group, setGroup] = useState<string | null>(null);
  const [pick, setPick] = useState<[string | null, string | null]>([null, null]);
  const question = t("O que mudou entre dois dias iguais?");
  if (!groups.length) return <Card question={question} answer={t("Ainda não há duas sessões com séries iguais.")} />;

  const current = groups.find(([key]) => key === group) ?? groups[0];
  const sessions = [...current[1].entries()].sort(([a], [b]) => b.localeCompare(a));
  const a = sessions.find(([key]) => key === pick[0]) ?? sessions[1];
  const b = sessions.find(([key]) => key === pick[1]) ?? sessions[0];
  const timesA = a[1].map((rep) => rep.actualS);
  const timesB = b[1].map((rep) => rep.actualS);
  const nameA = formatDatePt(a[1][0].row.date);
  const nameB = formatDatePt(b[1][0].row.date);
  const meanA = timesA.reduce((s, v) => s + v, 0) / timesA.length;
  const meanB = timesB.reduce((s, v) => s + v, 0) / timesB.length;
  const diffPct = (meanB / meanA - 1) * 100;
  const gap = secText(Math.abs(meanB - meanA)).replace("+", "");
  const changes = sessionChanges(
    a[1].map((rep) => rep.row),
    b[1].map((rep) => rep.row),
    wellness,
    trainingDays,
  );
  const changed = changes.filter((change) => !change.same);
  const sessionSelect = (index: 0 | 1, value: string) => (
    <label className="text-xs text-mute">
      {index ? t("Dia B") : t("Dia A")}
      <select className="field mt-1 h-11 w-auto py-1 text-sm" value={value} onChange={(event) => setPick(index ? [a[0], event.target.value] : [event.target.value, b[0]])}>
        {sessions.map(([key, reps]) => (
          <option key={key} value={key}>
            {`${formatDatePt(reps[0].row.date)} · ${reps.length} × ${reps[0].row.distanceM}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card
      question={question}
      answer={
        isNoise(diffPct) ? (
          t("Em {b} as reps saíram iguais às de {a}: a diferença média ({pct}) está abaixo de 1 %.", { a: nameA, b: nameB, pct: pctText(diffPct) })
        ) : (
          <>
            {t("Em {b}, cada rep saiu em média", { b: nameB })}{" "}
            <strong className={dirText(diffPct)}>{diffPct > 0 ? t("{s} mais lenta", { s: gap }) : t("{s} mais rápida", { s: gap })}</strong>{" "}
            {t("do que em {a} ({pct}).", { a: nameA, pct: pctText(diffPct) })}
          </>
        )
      }
      details={
        <>
          <DetailsTable
            caption={t("Tempos rep a rep nos dois dias")}
            head={[t("Rep"), nameA, nameB, t("B − A")]}
            rows={Array.from({ length: Math.max(timesA.length, timesB.length) }, (_, i) => [
              i + 1,
              timesA[i] != null ? formatSeconds(timesA[i]) : "—",
              timesB[i] != null ? formatSeconds(timesB[i]) : "—",
              timesA[i] != null && timesB[i] != null ? secText(timesB[i] - timesA[i]) : "—",
            ])}
          />
          <div className="mt-3">
            <DetailsTable caption={t("O que mudou entre os dois dias (só dados)")} head={[t("Dado"), nameA, nameB]} rows={changes.map((change) => [change.label, change.a, change.b])} />
          </div>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-mute">
          {t("Série")}
          <select
            className="field mt-1 h-11 w-auto max-w-full py-1 text-sm"
            value={current[0]}
            onChange={(event) => {
              setGroup(event.target.value);
              setPick([null, null]);
            }}
          >
            {groups.map(([key, byDay]) => (
              <option key={key} value={key}>
                {kindLabel([...byDay.values()][0][0].row)}
              </option>
            ))}
          </select>
        </label>
        {sessionSelect(0, a[0])}
        {sessionSelect(1, b[0])}
      </div>
      <div className="mt-3">
        <RepLines
          label={t("Tempos rep a rep nos dois dias; mais rápido em cima.")}
          series={[
            { times: timesA, stroke: "stroke-line-strong", fill: "fill-line-strong", dashed: true },
            { times: timesB, stroke: "stroke-aqua", fill: "fill-aqua" },
          ]}
          tipFor={(i) =>
            t("Rep {n}: {a} {ta} · {b} {tb}", {
              n: i + 1,
              a: nameA,
              ta: timesA[i] != null ? formatSeconds(timesA[i]) : "—",
              b: nameB,
              tb: timesB[i] != null ? formatSeconds(timesB[i]) : "—",
            })
          }
        />
      </div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-mute">
        <Swatch line className="bg-line-strong" label={nameA} />
        <Swatch line className="bg-aqua" label={nameB} />
        <span>{t("↑ mais rápido")}</span>
      </p>
      {changed.length ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">{t("O que mudou")}</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {changed.map((change) => (
              <li key={change.label} className="rounded-full bg-panel-2 px-3 py-1">
                {`${change.label}: ${change.a} → ${change.b}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mute">{t("Só dados: não diz o que pesou no resultado.")}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-mute">{t("Nos dados registados, nada mudou entre os dois dias.")}</p>
      )}
    </Card>
  );
}

/** E. One set's reps against the athlete's usual curve in equal earlier sets; fade and regularity against their usual. */
export function SetCurveChart({ list }: { list: ExplainedRep[] }) {
  const t = useT();
  const sets = useMemo(() => setsOf(list), [list]);
  const candidates = useMemo(() => sets.filter((set) => set.reps.length >= 4).reverse().slice(0, 60), [sets]);
  const [key, setKey] = useState<string | null>(null);
  const question = t("Como se aguentou ao longo da série?");
  if (!candidates.length) return <Card question={question} answer={t("Ainda sem séries de 4 ou mais reps.")} />;
  const set = candidates.find((item) => item.key === key) ?? candidates.find((item) => setCurve(item, sets).usualN > 0) ?? candidates[0];
  const curve = setCurve(set, sets);
  const fade = curve.fadePct ?? 0;
  const answer =
    curve.usualFadePct == null
      ? t("Da 1.ª para a 2.ª metade: {pct}. Ainda não há séries iguais anteriores para comparar.", { pct: pctText(fade) })
      : isNoise(fade - curve.usualFadePct)
        ? t("Aguentou como costuma: da 1.ª para a 2.ª metade {pct}, o habitual é {usual}.", { pct: pctText(fade), usual: pctText(curve.usualFadePct) })
        : fade > curve.usualFadePct
          ? t("Quebrou mais do que costuma: da 1.ª para a 2.ª metade {pct}, o habitual é {usual}.", { pct: pctText(fade), usual: pctText(curve.usualFadePct) })
          : t("Quebrou menos do que costuma: da 1.ª para a 2.ª metade {pct}, o habitual é {usual}.", { pct: pctText(fade), usual: pctText(curve.usualFadePct) });

  return (
    <Card
      question={question}
      answer={answer}
      details={
        <>
          <ul className="mb-3 space-y-0.5">
            <li>{t("Índice de queda: média da 2.ª metade ÷ 1.ª metade − 1 (+ abrandou). Diferenças abaixo de 1 pp são ruído.")}</li>
            {curve.cvPct != null ? (
              <li>
                {t("Irregularidade (variação entre reps): {now}, habitual {usual}.", {
                  now: pctText(curve.cvPct).replace("+", ""),
                  usual: curve.usualCvPct != null ? pctText(curve.usualCvPct).replace("+", "") : "—",
                })}
              </li>
            ) : null}
            <li>{t("Habitual: séries iguais anteriores (mesmo tipo e n.º de reps): {n}.", { n: curve.usualN })}</li>
          </ul>
          <DetailsTable
            caption={t("Reps da série e curva habitual")}
            head={[t("Rep"), t("Tempo"), t("Habitual"), t("Diferença")]}
            rows={curve.times.map((time, i) => [
              i + 1,
              formatSeconds(time),
              curve.usual[i] != null ? formatSeconds(curve.usual[i]!) : "—",
              curve.usual[i] != null ? secText(time - curve.usual[i]!) : "—",
            ])}
          />
        </>
      }
    >
      <label className="text-xs text-mute">
        {t("Série")}
        <select className="field mt-1 h-11 w-auto max-w-full py-1 text-sm" value={set.key} onChange={(event) => setKey(event.target.value)}>
          {candidates.map((item) => (
            <option key={item.key} value={item.key}>
              {`${formatDatePt(item.date)} · ${item.reps.length} × ${kindLabel(item.reps[0].row)}`}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3">
        <RepLines
          label={t("Reps da série e curva habitual do atleta em séries iguais; mais rápido em cima.")}
          series={[
            ...(curve.usualN ? [{ times: curve.usual, stroke: "stroke-line-strong", fill: "fill-line-strong", dashed: true }] : []),
            { times: curve.times, stroke: "stroke-aqua", fill: "fill-aqua" },
          ]}
          tipFor={(i) =>
            curve.usual[i] != null
              ? t("Rep {n}: {time} · habitual {usual}", { n: i + 1, time: formatSeconds(curve.times[i]), usual: formatSeconds(curve.usual[i]!) })
              : t("Rep {n}: {time}", { n: i + 1, time: formatSeconds(curve.times[i]) })
          }
        />
      </div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-mute">
        <Swatch line className="bg-aqua" label={t("esta série")} />
        {curve.usualN ? <Swatch line className="bg-line-strong" label={t("habitual")} /> : null}
        <span>{t("↑ mais rápido")}</span>
      </p>
    </Card>
  );
}

const PHASE_FILL: Record<string, string> = { general: "fill-pool", specific: "fill-good", competitive: "fill-sand", taper: "fill-lane", transition: "fill-mute" };
const PHASE_BG: Record<string, string> = { general: "bg-pool", specific: "bg-good", competitive: "bg-sand", taper: "bg-lane", transition: "bg-mute" };

/** C. Weekly km against the week's mean gap to level, coloured by season phase, with the fitted association. */
export function LoadScatter({ weeks }: { weeks: LoadPoint[] }) {
  const t = useT();
  const [tip, setTip] = useState<ChartTip>(null);
  const question = t("Mais volume associa-se a tempos piores?");
  const slope = loadSlope(weeks);
  if (weeks.length < 2) return <Card question={question} answer={t("Ainda sem semanas com carga e tempos.")} />;
  const H = 190;
  const kms = weeks.map((week) => week.km);
  const devs = weeks.map((week) => week.devPct);
  const kLo = Math.min(...kms);
  const kHi = Math.max(...kms, kLo + 1);
  const span = Math.max(2, ...devs.map(Math.abs));
  const x = (km: number) => 24 + ((km - kLo) / (kHi - kLo)) * (W - 48);
  const y = (pct: number) => 12 + ((pct + span) / (2 * span)) * (H - 36);
  const meanKm = kms.reduce((s, v) => s + v, 0) / kms.length;
  const meanDev = devs.reduce((s, v) => s + v, 0) / devs.length;
  const fit = (km: number) => meanDev + ((slope?.per10Pct ?? 0) / 10) * (km - meanKm);
  const phases = PHASES.filter((phase) => weeks.some((week) => week.phase === phase.kind));
  const vars = slope ? { x: pctText(slope.per10Pct), m: pctText(slope.marginPct).replace("+", ""), n: slope.n } : null;

  return (
    <Card
      question={question}
      answer={
        !slope || !vars
          ? t("São precisas pelo menos {min} semanas com carga e tempos (há {n}).", { min: MIN_LOAD_WEEKS, n: weeks.length })
          : Math.abs(slope.per10Pct) <= slope.marginPct
            ? t("Sem associação clara: cada +10 km associa-se a {x} (± {m}, {n} semanas).", vars)
            : slope.per10Pct > 0
              ? t("Semanas com mais km associam-se a tempos mais lentos: {x} por cada +10 km (± {m}, {n} semanas).", vars)
              : t("Semanas com mais km associam-se a tempos mais rápidos: {x} por cada +10 km (± {m}, {n} semanas).", vars)
      }
      details={
        <>
          <p className="mb-2">{t("Associação entre semanas, não efeito da carga: a forma e a fase também mudam. Margem: ± 2 erros-padrão do declive.")}</p>
          <DetailsTable
            caption={t("Km e desvio por semana")}
            head={[t("Semana"), t("km"), t("Desvio face ao nível"), t("Fase")]}
            rows={weeks.map((week) => [formatDatePt(week.week), week.km.toFixed(1).replace(".", ","), pctText(week.devPct), week.phase ? t(phaseOf(week.phase).label) : "—"])}
          />
        </>
      }
    >
      <ChartFrame tip={tip}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={t("Km por semana contra o desvio médio face ao nível; mais rápido em cima; cor = fase da época.")}>
          <line x1={24} x2={W - 24} y1={y(0)} y2={y(0)} className="stroke-line" />
          {slope ? <line x1={x(kLo)} x2={x(kHi)} y1={y(fit(kLo))} y2={y(fit(kHi))} className="stroke-mist" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} /> : null}
          {weeks.map((week) => {
            const text = t("Semana de {date}: {km} km, {dev}", { date: formatDatePt(week.week), km: week.km.toFixed(1).replace(".", ","), dev: pctText(week.devPct) });
            return (
              <g key={week.week} {...tipProps(text, (x(week.km) / W) * 100, (y(week.devPct) / H) * 100, setTip)}>
                <circle cx={x(week.km)} cy={y(week.devPct)} r={12} fill="transparent" />
                <circle cx={x(week.km)} cy={y(week.devPct)} r={5} className={PHASE_FILL[week.phase ?? ""] ?? "fill-aqua"} />
              </g>
            );
          })}
          <text x={24} y={H - 4} className="fill-mute text-[10px]">{`${Math.round(kLo)} km`}</text>
          <text x={W - 24} y={H - 4} textAnchor="end" className="fill-mute text-[10px]">{`${Math.round(kHi)} km`}</text>
        </svg>
      </ChartFrame>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
        {phases.map((phase) => (
          <Swatch key={phase.kind} className={PHASE_BG[phase.kind]} label={t(phase.label)} />
        ))}
        {weeks.some((week) => !week.phase) ? <Swatch className="bg-aqua" label={t("sem fase no plano")} /> : null}
        <span>{t("↑ mais rápido")}</span>
      </p>
    </Card>
  );
}

const TOP_FACTORS = 5;

/** F. What the model has learned for this athlete, largest first; factors with fewer than 8 reps are left out. */
export function FactorProfile({ rows }: { rows: TrainingRep[] }) {
  const t = useT();
  const name = useFactorName();
  const { effects, residualSd } = useMemo(() => learnedPatterns(rows), [rows]);
  // ponytail: margin ≈ ± 2 residual SD / √(sessions with the factor): reps of one session move together, so a session counts once.
  // Ignores the ridge shrinkage and correlated factors; bootstrap by session if it matters.
  const repsPerSession = rows.length / Math.max(1, new Set(rows.map(sessionKey)).size);
  const all = effects
    .filter((effect) => effect.support >= MIN_FACTOR_SUPPORT)
    .map((effect) => ({ ...effect, name: name(effect.key), marginPct: (200 * residualSd) / Math.sqrt(Math.max(1, effect.support / repsPerSession)) }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const shown = all.filter((effect) => Math.abs(effect.pct) > effect.marginPct).slice(0, TOP_FACTORS);
  const noSleep = !rows.some((row) => row.sleepHours != null);
  const question = t("Que fatores mais se associam aos tempos do atleta?");
  if (!all.length) return <Card question={question} answer={t("Ainda poucos dados para pesar fatores: são precisas 8 reps anteriores.")} />;
  const slow = shown.find((effect) => effect.pct > 0);
  const fast = shown.find((effect) => effect.pct < 0);
  const span = Math.max(1, ...shown.map((effect) => Math.abs(effect.pct)));
  const at = (pct: number) => 50 + (Math.max(-span, Math.min(span, pct)) / span) * 50;

  return (
    <Card
      question={question}
      answer={
        !shown.length
          ? t("Nenhum fator se destaca da margem: os tempos variam pouco com o contexto registado.")
          : slow && fast
            ? t("{slow} associa-se a tempos mais lentos ({sp}); {fast}, a mais rápidos ({fp}).", { slow: slow.name, sp: pctText(slow.pct), fast: lowerFirst(fast.name), fp: pctText(fast.pct) })
            : slow
              ? t("{slow} associa-se a tempos mais lentos ({sp}).", { slow: slow.name, sp: pctText(slow.pct) })
              : t("{fast} associa-se a tempos mais rápidos ({fp}).", { fast: fast!.name, fp: pctText(fast!.pct) })
      }
      details={
        <>
          <p className="mb-2">
            {t("Mudança no tempo associada a cada fator (+ mais lento). Fatores com menos de 8 reps não aparecem. Margem aproximada.")}
            {noSleep ? ` ${t("Sono não registado: o sono não se pode pesar.")}` : ""}
          </p>
          <DetailsTable
            caption={t("Peso de cada fator nos tempos do atleta")}
            head={[t("Fator"), t("Associa-se a"), t("Margem"), t("Reps")]}
            rows={all.map((effect) => [effect.name, pctText(effect.pct), `± ${pctText(effect.marginPct).replace("+", "")}`, effect.support])}
          />
        </>
      }
    >
      {shown.length ? (
        <ul className="space-y-2.5">
          {shown.map((effect) => (
            <li key={effect.key}>
              <Tip tip={t("{pct} ± {m} · aprendido em {n} reps", { pct: pctText(effect.pct), m: pctText(effect.marginPct).replace("+", ""), n: effect.support })}>
                <FactorBar name={effect.name} pct={effect.pct} at={at} />
              </Tip>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-mute">
        <Swatch className="bg-faster" label={t("mais rápido")} />
        <Swatch className="bg-slower" label={t("mais lento")} />
        <span>{t("Toque ou passe o rato para ver a margem.")}</span>
      </p>
    </Card>
  );
}

/** A row of name, diverging bar from the centre line, and the signed %. */
export function FactorBar({ name, pct, at, strong = false }: { name: string; pct: number; at: (pct: number) => number; strong?: boolean }) {
  return (
    <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-0.5 text-sm sm:grid-cols-[12rem_1fr_4.5rem]">
      <span className={`truncate ${strong ? "font-semibold" : ""}`}>{name}</span>
      <span className="relative order-last col-span-2 block h-3 rounded-full bg-panel-2 sm:order-none sm:col-span-1" aria-hidden>
        <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${at(0)}%` }} />
        <span className={`absolute inset-y-0 rounded-full ${dirBg(pct)}`} style={{ left: `${Math.min(at(0), at(pct))}%`, width: `${Math.max(1, Math.abs(at(pct) - at(0)))}%` }} />
      </span>
      <span className={`text-right font-semibold tabular-nums ${dirText(pct)}`}>{pctText(pct)}</span>
    </span>
  );
}
