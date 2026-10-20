"use client";

import { useMemo, useState } from "react";
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

const W = 640;

// Literal class names, so Tailwind generates them.
const TONE = {
  coral: { fill: "fill-coral", stroke: "stroke-coral", bg: "bg-coral" },
  aqua: { fill: "fill-aqua", stroke: "stroke-aqua", bg: "bg-aqua" },
  line: { fill: "fill-line-strong", stroke: "stroke-line-strong", bg: "bg-line-strong" },
  pool: { fill: "fill-pool", stroke: "stroke-pool", bg: "bg-pool" },
  good: { fill: "fill-good", stroke: "stroke-good", bg: "bg-good" },
  sand: { fill: "fill-sand", stroke: "stroke-sand", bg: "bg-sand" },
  lane: { fill: "fill-lane", stroke: "stroke-lane", bg: "bg-lane" },
  mute: { fill: "fill-mute", stroke: "stroke-mute", bg: "bg-mute" },
} as const;
type Tone = keyof typeof TONE;

/** Times of a few series against rep number; faster is up. */
function RepLines({ series, label }: { series: { name: string; times: (number | null)[]; tone: Tone; dashed?: boolean }[]; label: string }) {
  const H = 160;
  const values = series.flatMap((item) => item.times.filter((v): v is number => v != null));
  const count = Math.max(...series.map((item) => item.times.length));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.15, 0.2);
  const x = (i: number) => 36 + (count > 1 ? (i / (count - 1)) * (W - 56) : (W - 56) / 2);
  const y = (s: number) => 10 + ((s - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 30);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={label}>
      {[lo, hi].map((value) => (
        <g key={value}>
          <line x1={32} x2={W} y1={y(value)} y2={y(value)} className="stroke-line" />
          <text x={0} y={y(value) + 3} className="fill-mute text-[10px]">
            {formatSeconds(value, 1)}
          </text>
        </g>
      ))}
      {Array.from({ length: count }, (_, i) => (
        <text key={i} x={x(i) - 3} y={H - 4} className="fill-mute text-[10px]">
          {i + 1}
        </text>
      ))}
      {series.map((item, index) => {
        const points = item.times.map((value, i) => (value == null ? null : `${x(i)},${y(value)}`)).filter(Boolean);
        return (
          <g key={index}>
            <polyline points={points.join(" ")} fill="none" className={TONE[item.tone].stroke} strokeWidth={2} strokeDasharray={item.dashed ? "5 4" : undefined} />
            {item.dashed
              ? null
              : item.times.map((value, i) => (value == null ? null : <circle key={i} cx={x(i)} cy={y(value)} r={3.5} className={TONE[item.tone].fill} />))}
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ items }: { items: { name: string; tone: Tone; dashed?: boolean }[] }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
      {items.map((item, index) => (
        <span key={index}>
          <span aria-hidden className={`mr-1 inline-block h-0.5 w-4 align-middle ${TONE[item.tone].bg} ${item.dashed ? "opacity-60" : ""}`} />
          {item.name}
        </span>
      ))}
    </p>
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
  if (!groups.length) return <p className="mt-2 text-sm text-mute">{t("Ainda não há duas sessões com séries iguais.")}</p>;

  const current = groups.find(([key]) => key === group) ?? groups[0];
  const sessions = [...current[1].entries()].sort(([a], [b]) => b.localeCompare(a));
  const a = sessions.find(([key]) => key === pick[0]) ?? sessions[1];
  const b = sessions.find(([key]) => key === pick[1]) ?? sessions[0];
  const timesA = a[1].map((rep) => rep.actualS);
  const timesB = b[1].map((rep) => rep.actualS);
  const nameA = formatDatePt(a[1][0].row.date);
  const nameB = formatDatePt(b[1][0].row.date);
  const changes = sessionChanges(
    a[1].map((rep) => rep.row),
    b[1].map((rep) => rep.row),
    wellness,
    trainingDays,
  );
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
    <div className="mt-2">
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
                {`${kindLabel([...byDay.values()][0][0].row)} · ${byDay.size} ${t("sessões")}`}
              </option>
            ))}
          </select>
        </label>
        {sessionSelect(0, a[0])}
        {sessionSelect(1, b[0])}
      </div>
      <RepLines
        label={t("Tempos rep a rep nos dois dias; mais rápido em cima.")}
        series={[
          { name: nameA, times: timesA, tone: "coral" },
          { name: nameB, times: timesB, tone: "aqua" },
        ]}
      />
      <Legend items={[{ name: `${t("Dia A")} ${nameA}`, tone: "coral" }, { name: `${t("Dia B")} ${nameB}`, tone: "aqua" }]} />
      <details className="mt-2 overflow-x-auto text-sm">
        <summary className="cursor-pointer text-mute">{t("Ver em tabela")}</summary>
        <table className="mt-2 w-full text-[13px] tabular-nums">
          <caption className="sr-only">{t("Tempos rep a rep nos dois dias")}</caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="font-medium">{t("Rep")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{nameA}</th>
              <th scope="col" className="pl-2 text-right font-medium">{nameB}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("B − A")}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(timesA.length, timesB.length) }, (_, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1">{i + 1}</td>
                <td className="pl-2 text-right">{timesA[i] != null ? formatSeconds(timesA[i]) : "—"}</td>
                <td className="pl-2 text-right">{timesB[i] != null ? formatSeconds(timesB[i]) : "—"}</td>
                <td className="pl-2 text-right">{timesA[i] != null && timesB[i] != null ? secText(timesB[i] - timesA[i]) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <table className="mt-3 w-full text-[13px] sm:text-sm">
        <caption className="text-left text-xs font-semibold text-mist">{t("O que mudou entre os dois dias (só dados)")}</caption>
        <thead>
          <tr className="text-left text-xs text-mute">
            <th scope="col" className="py-1 font-medium">{t("Dado")}</th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">{nameA}</th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">{nameB}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.label} className={`border-t border-line ${change.same ? "text-mute" : "font-semibold"}`}>
              <th scope="row" className="py-1 text-left font-normal">
                {change.label}
                {change.same ? <span className="sr-only"> {t("(igual)")}</span> : null}
              </th>
              <td className="pl-2 text-right">{change.a}</td>
              <td className="pl-2 text-right">{change.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** E. One set's reps against the athlete's usual curve in equal earlier sets; fade and regularity against their usual. */
export function SetCurveChart({ list }: { list: ExplainedRep[] }) {
  const t = useT();
  const sets = useMemo(() => setsOf(list), [list]);
  const candidates = useMemo(() => sets.filter((set) => set.reps.length >= 4).reverse().slice(0, 60), [sets]);
  const [key, setKey] = useState<string | null>(null);
  if (!candidates.length) return <p className="mt-2 text-sm text-mute">{t("Ainda sem séries de 4 ou mais reps.")}</p>;
  const set = candidates.find((item) => item.key === key) ?? candidates.find((item) => setCurve(item, sets).usualN > 0) ?? candidates[0];
  const curve = setCurve(set, sets);
  const compare = (now: number | null, usual: number | null, label: string, fmt: (v: number) => string = pctText) => {
    if (now == null) return null;
    if (usual == null) return t("{label}: {now} (sem séries iguais anteriores)", { label, now: fmt(now) });
    const diff = now - usual;
    return isNoise(diff)
      ? t("{label}: {now}, habitual {usual} (diferença abaixo de 1 pp: ruído)", { label, now: fmt(now), usual: fmt(usual) })
      : t("{label}: {now}, habitual {usual} ({diff} pp)", { label, now: fmt(now), usual: fmt(usual), diff: pctText(diff).replace(" %", "") });
  };
  const usualName = t("habitual (séries iguais anteriores: {n})", { n: curve.usualN });

  return (
    <div className="mt-2">
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
      <RepLines
        label={t("Reps da série e curva habitual do atleta em séries iguais; mais rápido em cima.")}
        series={[
          ...(curve.usualN ? [{ name: usualName, times: curve.usual, tone: "line" as const, dashed: true }] : []),
          { name: t("esta série"), times: curve.times, tone: "aqua" as const },
        ]}
      />
      <Legend items={[{ name: t("esta série"), tone: "aqua" as const }, ...(curve.usualN ? [{ name: usualName, tone: "line" as const, dashed: true }] : [])]} />
      <ul className="mt-2 space-y-0.5 text-sm">
        <li>{compare(curve.fadePct, curve.usualFadePct, t("Índice de queda")) ?? t("Índice de queda: precisa de 4 reps.")}</li>
        <li>{compare(curve.cvPct, curve.usualCvPct, t("Irregularidade (variação entre reps)"), (v) => pctText(v).replace("+", "")) ?? t("Irregularidade: precisa de 3 reps.")}</li>
        {!curve.usualN ? <li className="text-mute">{t("Sem séries iguais anteriores (mesmo tipo e número de reps): não há curva habitual.")}</li> : null}
      </ul>
      <details className="mt-2 overflow-x-auto text-sm">
        <summary className="cursor-pointer text-mute">{t("Ver em tabela")}</summary>
        <table className="mt-2 w-full text-[13px] tabular-nums">
          <caption className="sr-only">{t("Reps da série e curva habitual")}</caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="font-medium">{t("Rep")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Tempo")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Habitual")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Diferença")}</th>
            </tr>
          </thead>
          <tbody>
            {curve.times.map((time, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1">{i + 1}</td>
                <td className="pl-2 text-right">{formatSeconds(time)}</td>
                <td className="pl-2 text-right">{curve.usual[i] != null ? formatSeconds(curve.usual[i]!) : "—"}</td>
                <td className="pl-2 text-right">{curve.usual[i] != null ? secText(time - curve.usual[i]!) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const PHASE_TONE: Record<string, Tone> = { general: "pool", specific: "good", competitive: "sand", taper: "lane", transition: "mute" };

/** C. Weekly km against the week's mean gap to level, coloured by season phase, with the fitted association. */
export function LoadScatter({ weeks }: { weeks: LoadPoint[] }) {
  const t = useT();
  const slope = loadSlope(weeks);
  if (weeks.length < 2) return <p className="mt-2 text-sm text-mute">{t("Ainda sem semanas com carga e tempos.")}</p>;
  const H = 200;
  const kms = weeks.map((week) => week.km);
  const devs = weeks.map((week) => week.devPct);
  const kLo = Math.min(...kms);
  const kHi = Math.max(...kms, kLo + 1);
  const span = Math.max(2, ...devs.map(Math.abs));
  const x = (km: number) => 40 + ((km - kLo) / (kHi - kLo)) * (W - 56);
  const y = (pct: number) => 10 + ((pct + span) / (2 * span)) * (H - 34);
  const meanKm = kms.reduce((s, v) => s + v, 0) / kms.length;
  const meanDev = devs.reduce((s, v) => s + v, 0) / devs.length;
  const fit = (km: number) => meanDev + ((slope?.per10Pct ?? 0) / 10) * (km - meanKm);
  const phases = PHASES.filter((phase) => weeks.some((week) => week.phase === phase.kind));

  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-mist">
        {slope
          ? Math.abs(slope.per10Pct) <= slope.marginPct
            ? t("Cada +10 km na semana associa-se a {x} nos tempos (margem ± {m}, n = {n} semanas): a margem cobre os dois sentidos, sem associação clara.", {
                x: pctText(slope.per10Pct),
                m: pctText(slope.marginPct).replace("+", ""),
                n: slope.n,
              })
            : t("Cada +10 km na semana associa-se a {x} nos tempos (margem ± {m}, n = {n} semanas).", {
                x: pctText(slope.per10Pct),
                m: pctText(slope.marginPct).replace("+", ""),
                n: slope.n,
              })
          : t("São precisas pelo menos {min} semanas com carga e tempos (há {n}).", { min: MIN_LOAD_WEEKS, n: weeks.length })}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={t("Km por semana contra o desvio médio face ao nível; mais rápido em cima; cor = fase da época.")}>
        <rect x={40} y={y(-1)} width={W - 56} height={y(1) - y(-1)} className="fill-panel-2" />
        <line x1={40} x2={W - 16} y1={y(0)} y2={y(0)} className="stroke-line-strong" strokeDasharray="4 3" />
        <text x={0} y={y(span) - 2} className="fill-mute text-[10px]">{t("mais lento")}</text>
        <text x={0} y={y(-span) + 10} className="fill-mute text-[10px]">{t("mais rápido")}</text>
        {slope ? <line x1={x(kLo)} x2={x(kHi)} y1={y(fit(kLo))} y2={y(fit(kHi))} className="stroke-mist" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6} /> : null}
        {weeks.map((week) => (
          <circle key={week.week} cx={x(week.km)} cy={y(week.devPct)} r={4.5} className={TONE[PHASE_TONE[week.phase ?? ""] ?? "aqua"].fill} opacity={0.85}>
            <title>{`${formatDatePt(week.week)} · ${week.km.toFixed(1).replace(".", ",")} km · ${pctText(week.devPct)}`}</title>
          </circle>
        ))}
        {[kLo, kHi].map((km) => (
          <text key={km} x={x(km) - 8} y={H - 4} className="fill-mute text-[10px]">
            {`${Math.round(km)} km`}
          </text>
        ))}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
        {phases.map((phase) => (
          <span key={phase.kind}>
            <span aria-hidden className={`mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle ${TONE[PHASE_TONE[phase.kind]].bg}`} />
            {t(phaseOf(phase.kind).label)}
          </span>
        ))}
        {weeks.some((week) => !week.phase) ? (
          <span>
            <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-aqua align-middle" />
            {t("sem fase no plano")}
          </span>
        ) : null}
        <span>{t("Associação entre semanas, não efeito da carga: a forma e a fase também mudam.")}</span>
      </p>
      <details className="mt-2 overflow-x-auto text-sm">
        <summary className="cursor-pointer text-mute">{t("Ver em tabela")}</summary>
        <table className="mt-2 w-full text-[13px] tabular-nums">
          <caption className="sr-only">{t("Km e desvio por semana")}</caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th scope="col" className="font-medium">{t("Semana")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("km")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Desvio face ao nível")}</th>
              <th scope="col" className="pl-2 text-right font-medium">{t("Reps")}</th>
              <th scope="col" className="pl-2 font-medium">{t("Fase")}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.week} className="border-t border-line">
                <td className="py-1">{formatDatePt(week.week)}</td>
                <td className="pl-2 text-right">{week.km.toFixed(1).replace(".", ",")}</td>
                <td className="pl-2 text-right">{pctText(week.devPct)}</td>
                <td className="pl-2 text-right">{week.n}</td>
                <td className="pl-2">{week.phase ? t(phaseOf(week.phase).label) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** F. What the model has learned for this athlete, largest first; factors with fewer than 8 reps are left out. */
export function FactorProfile({ rows }: { rows: TrainingRep[] }) {
  const t = useT();
  const { effects, residualSd } = useMemo(() => learnedPatterns(rows), [rows]);
  // ponytail: margin ≈ ± 2 residual SD / √(sessions with the factor): reps of one session move together, so a session counts once.
  // Ignores the ridge shrinkage and correlated factors; bootstrap by session if it matters.
  const repsPerSession = rows.length / Math.max(1, new Set(rows.map(sessionKey)).size);
  const shown = effects
    .filter((effect) => effect.support >= MIN_FACTOR_SUPPORT)
    .map((effect) => ({ ...effect, marginPct: (200 * residualSd) / Math.sqrt(Math.max(1, effect.support / repsPerSession)) }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const noSleep = !rows.some((row) => row.sleepHours != null);
  if (!shown.length) return <p className="mt-2 text-sm text-mute">{t("Ainda poucos dados para pesar fatores: são precisas 8 reps anteriores.")}</p>;
  const span = Math.max(1, ...shown.map((effect) => Math.abs(effect.pct) + effect.marginPct));
  const at = (pct: number) => 50 + (Math.max(-span, Math.min(span, pct)) / span) * 50;

  return (
    <div className="mt-2">
      <table className="w-full text-[13px] tabular-nums sm:text-sm">
        <caption className="sr-only">{t("Peso de cada fator nos tempos do atleta")}</caption>
        <thead>
          <tr className="text-left text-xs text-mute">
            <th scope="col" className="py-1 font-medium">{t("Fator")}</th>
            <th scope="col" className="w-2/5 py-1 font-medium"><span className="sr-only">{t("Gráfico")}</span></th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">{t("Associa-se a")}</th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">{t("Reps")}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((effect) => {
            const unclear = Math.abs(effect.pct) <= effect.marginPct;
            return (
              <tr key={effect.key} className={`border-t border-line ${unclear ? "text-mute" : ""}`}>
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  {effect.label}
                  {unclear ? <span className="block text-xs">{t("dentro da margem")}</span> : null}
                </th>
                <td>
                  <span className="relative block h-3.5 w-full min-w-24 rounded bg-panel-2" aria-hidden>
                    <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: "50%" }} />
                    <span className="absolute top-1.5 h-0.5 bg-line-strong" style={{ left: `${at(effect.pct - effect.marginPct)}%`, width: `${at(effect.pct + effect.marginPct) - at(effect.pct - effect.marginPct)}%` }} />
                    <span className={`absolute top-0.5 h-2.5 rounded-sm ${effect.pct > 0 ? "bg-slower" : "bg-faster"}`} style={{ left: `${Math.min(50, at(effect.pct))}%`, width: `${Math.max(0.8, Math.abs(at(effect.pct) - 50))}%` }} />
                  </span>
                </td>
                <td className={`whitespace-nowrap pl-2 text-right ${unclear ? "" : effect.pct > 0 ? "text-slower" : "text-faster"}`}>
                  {`${pctText(effect.pct)} ± ${pctText(effect.marginPct).replace("+", "")}`}
                </td>
                <td className="pl-2 text-right">{effect.support}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="mt-2 space-y-0.5 text-xs text-mute">
        <li>{t("Mudança no tempo associada a cada fator (+ mais lento). Fatores com menos de 8 reps não aparecem. Margem aproximada.")}</li>
        {noSleep ? <li>{t("Sono não registado: o sono não se pode pesar.")}</li> : null}
      </ul>
    </div>
  );
}
