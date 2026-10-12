"use client";

import { useMemo, useState } from "react";
import { VerdictTag, diffS, swimClock, useSay } from "@/components/analise/coach-text";
import { useT } from "@/i18n/provider";
import { addDays, todayIso } from "@/lib/dates";
import { evolution, type SetKind } from "@/lib/evolution";
import { formatDatePt, strokeLabel } from "@/lib/labels";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import { formTimeline } from "@/lib/training-prediction";
import type { Athlete } from "@/lib/types";

const SHOWN = 6;

/** "Está a melhorar?" — per kind of set, each session's mean against the swimmer's normal of 1–2 months ago. */
export function EvolutionView({ athlete, audience = "coach" }: { athlete: Athlete; audience?: "coach" | "athlete" }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs } = useAppState();
  const today = todayIso();
  const [all, setAll] = useState(false);

  const data = useMemo(() => {
    // 16 weeks for the breaks; evolution() itself keeps only the 8 weeks it compares.
    const from = addDays(today, -112);
    const windowed = workouts.filter((w) => w.date >= addDays(from, -7) && w.date <= today);
    const rows = annotateTrainingReps(windowed, timeLogs, athlete.id, athlete.wellness ?? []).filter((r) => isPlausibleRep(r) && r.date >= from);
    const breaks = formTimeline(rows).breaks.slice(-2);
    return { ...evolution(rows, today), breaks };
  }, [athlete, workouts, timeLogs, today]);

  const bests = data.kinds.filter((k) => k.newBest);
  const shown = all ? data.kinds : data.kinds.slice(0, SHOWN);

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="evolucao-titulo">
      <h2 id="evolucao-titulo" className="font-display text-xl font-bold">
        {audience === "athlete" ? t("Estás a melhorar?") : t("Está a melhorar?")}
      </h2>
      <p className="mt-2 border-l-4 border-line-strong pl-3 font-semibold text-mist">{say(data.headline)}</p>
      {bests.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {bests.slice(0, 3).map((k) => (
            <li key={k.key} className="text-good">
              <span aria-hidden>★ </span>
              {t("Melhor média das últimas semanas nos {dist} {zone}: {time}.", { dist: k.distanceM, zone: `${k.intensity}${k.gearLabel ? ` · ${k.gearLabel}` : ""}`, time: swimClock(k.points[k.points.length - 1].meanS) })}
            </li>
          ))}
        </ul>
      ) : null}

      {data.kinds.length ? (
        <div className="mt-4 space-y-2">
          {shown.map((k) => (
            <KindRow key={k.key} kind={k} />
          ))}
          {data.kinds.length > SHOWN ? (
            <button type="button" className="min-h-11 text-sm font-semibold text-pool" onClick={() => setAll(!all)}>
              {all ? t("Mostrar menos") : t("Ver os {n} tipos de série", { n: data.kinds.length })}
            </button>
          ) : null}
          <p className="text-xs text-mute">{t("Cada ponto é a média de uma sessão nessa série; mais rápido fica em cima. A faixa é o habitual das 6 semanas antes das últimas 2.")}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-mute">{t("Ainda sem séries repetidas pelo menos 3 vezes nas últimas 8 semanas.")}</p>
      )}

      {data.breaks.length ? (
        <>
          <h3 className="mt-4 text-sm font-semibold text-mist">{t("Depois das paragens")}</h3>
          <ul className="mt-1 space-y-1 text-sm text-mist">
            {data.breaks.map((b) => (
              <li key={b.from}>
                {b.recoveryWeeks == null
                  ? t("Paragem de {days} dias ({from} → {to}): ainda não voltou ao nível de antes.", { days: b.days, from: formatDatePt(b.from).slice(0, 5), to: formatDatePt(b.to).slice(0, 5) })
                  : t("Paragem de {days} dias ({from} → {to}): voltou ao nível de antes na {w}.ª semana.", { days: b.days, from: formatDatePt(b.from).slice(0, 5), to: formatDatePt(b.to).slice(0, 5), w: b.recoveryWeeks + 1 })}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function KindRow({ kind }: { kind: SetKind }) {
  const t = useT();
  const last = kind.points[kind.points.length - 1];
  return (
    <article className="rounded-xl border border-line p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold text-mist">
          {kind.distanceM} {kind.intensity}
          <span className="font-normal text-mute">
            {" "}
            · {strokeLabel(kind.stroke) || t("livre")}
            {kind.gearLabel ? ` · ${kind.gearLabel}` : ""} · {kind.course === "scm" ? "PC" : "PL"}
          </span>
        </h3>
        <VerdictTag verdict={kind.verdict} size="xs" />
      </header>
      <p className="mt-1 text-sm tabular-nums text-mute">
        {kind.recentS != null
          ? t("Últimas 2 semanas {time}", { time: swimClock(kind.recentS) })
          : t("Última {time} ({date})", { time: swimClock(last.meanS), date: formatDatePt(last.date).slice(0, 5) })}
        {kind.baselineS != null ? ` · ${t("habitual {time}", { time: swimClock(kind.baselineS) })}` : ""}
        {kind.deltaS != null && kind.verdict.dir !== "unclear" && kind.verdict.dir !== "same"
          ? ` · ${kind.deltaS < 0 ? t("{s} por rep mais rápido", { s: diffS(kind.deltaS) }) : t("{s} por rep mais lento", { s: diffS(kind.deltaS) })}`
          : ""}
        {` · ${t("{n} sessões", { n: kind.points.length })}`}
      </p>
      <SessionDots kind={kind} />
    </article>
  );
}

function SessionDots({ kind }: { kind: SetKind }) {
  const t = useT();
  const times = kind.points.map((p) => p.meanS);
  const te = kind.te ?? 0;
  const base = kind.baselineS;
  const lo = Math.min(...times, base != null ? base - te : Infinity) - Math.max(te * 0.5, 0.1);
  const hi = Math.max(...times, base != null ? base + te : -Infinity) + Math.max(te * 0.5, 0.1);
  const W = 300;
  const H = 52;
  const first = Date.parse(kind.points[0].date);
  const span = Math.max(1, Date.parse(kind.points[kind.points.length - 1].date) - first);
  const x = (date: string) => 8 + ((Date.parse(date) - first) / span) * (W - 16);
  const y = (s: number) => 6 + ((s - lo) / Math.max(hi - lo, 0.01)) * (H - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-12 w-full" role="img" aria-label={t("Média de cada sessão ao longo do tempo; mais rápido fica em cima.")}>
      {base != null ? <rect x={0} y={y(base - te)} width={W} height={Math.max(1, y(base + te) - y(base - te))} className="fill-panel-2" /> : null}
      {base != null ? <line x1={0} x2={W} y1={y(base)} y2={y(base)} className="stroke-line-strong" strokeDasharray="4 3" /> : null}
      <polyline points={kind.points.map((p) => `${x(p.date)},${y(p.meanS)}`).join(" ")} fill="none" className="stroke-line-strong" strokeWidth={1} />
      {kind.points.map((p, i) => (
        <circle key={p.workoutId} cx={x(p.date)} cy={y(p.meanS)} r={i === kind.points.length - 1 ? 5 : 3.5} className={i === kind.points.length - 1 ? "fill-aqua" : "fill-mute"} />
      ))}
    </svg>
  );
}
