"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatDatePt } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import {
  SEGMENT_KIND_LABEL,
  comparable,
  compareRaces,
  raceSegments,
  raceSummary,
  type SegmentKind,
} from "@/lib/race-analysis";
import type { RaceSession } from "@/lib/types";

const KIND_TONE: Record<SegmentKind, string> = {
  start: "bg-pool-soft text-pool",
  swim: "bg-panel-2 text-mist",
  turn: "bg-[#fff1d6] text-[#9a6200]",
  finish: "bg-aqua-soft text-aqua",
};

function num(value: number, digits = 2): string {
  return value > 0 && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function signed(value: number): string {
  if (!value) return "0.00";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
}

/**
 * Derived analysis of one race (and optional comparison with another swim of the same event).
 * Dense, table-first layout: every number lines up so coaches can scan it like a results sheet.
 */
export function RaceInsights({ session, others }: { session: RaceSession; others: RaceSession[] }) {
  const t = useT();
  const summary = useMemo(() => raceSummary(session), [session]);
  const segments = useMemo(() => raceSegments(session), [session]);
  const candidates = useMemo(
    () => others.filter((item) => comparable(session, item)).sort((a, b) => b.date.localeCompare(a.date)),
    [others, session],
  );
  const [compareId, setCompareId] = useState("");
  const other = candidates.find((item) => item.id === compareId);
  const comparison = useMemo(() => (other ? compareRaces(other, session) : null), [other, session]);

  if (!segments.length) {
    return (
      <section className="rounded-xl border border-dashed border-line-strong bg-panel px-4 py-6 text-center text-sm text-mute">
        {t("Adiciona as passagens para ver a análise da prova.")}
      </section>
    );
  }

  const kpis: { label: string; value: string; unit?: string }[] = [
    { label: t("Tempo final"), value: formatRaceClock(summary.finalS) },
    { label: t("Reação"), value: num(summary.reactionS), unit: "s" },
    { label: t("Aos 15 m"), value: summary.startS ? formatRaceClock(summary.startS) : "—" },
    { label: t("Velocidade média"), value: num(summary.avgVelocity), unit: "m/s" },
    { label: t("Frequência média"), value: num(summary.avgSr, 1), unit: t("ciclos/min") },
    { label: t("Distância por ciclo"), value: num(summary.avgDps), unit: "m" },
    { label: t("Quebra de velocidade"), value: summary.fadePct ? `${summary.fadePct.toFixed(1)}` : "—", unit: "%" },
  ];

  const maxV = Math.max(...segments.map((segment) => segment.velocity), 0.01);

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2.5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-mute">{t("Análise da prova")}</h3>
        </header>
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-7 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">{kpi.label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold leading-none tabular text-mist">
                {kpi.value}
                {kpi.unit && kpi.value !== "—" ? <span className="ml-1 font-sans text-xs font-medium text-mute">{kpi.unit}</span> : null}
              </dd>
            </div>
          ))}
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular">
            <thead>
              <tr className="border-b border-line bg-panel-2 text-left text-[11px] font-semibold uppercase tracking-wide text-mute">
                <th className="px-4 py-2">{t("Troço")}</th>
                <th className="px-3 py-2">{t("Fase")}</th>
                <th className="px-3 py-2 text-right">{t("Tempo")}</th>
                <th className="px-3 py-2">{t("Velocidade")}</th>
                <th className="px-3 py-2 text-right">SR</th>
                <th className="px-3 py-2 text-right">DPS</th>
                <th className="px-4 py-2 text-right">{t("Índice")}</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment, index) => (
                <tr key={`${segment.from}-${segment.to}`} className={index % 2 ? "bg-panel-2/60" : ""}>
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-mist">
                    {segment.from}–{segment.to} m
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${KIND_TONE[segment.kind]}`}>
                      {t(SEGMENT_KIND_LABEL[segment.kind])}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{num(segment.timeS)}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-24 overflow-hidden rounded-full bg-panel-2">
                        <span className="block h-full rounded-full bg-pool" style={{ width: `${(segment.velocity / maxV) * 100}%` }} />
                      </span>
                      <span className="font-mono text-xs">{num(segment.velocity)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{num(segment.sr, 1)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(segment.dps)}</td>
                  <td className="px-4 py-2 text-right font-mono">{num(segment.strokeIndex)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {summary.underwater.length ? (
          <div className="border-t border-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Subaquático")}</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular">
              {summary.underwater.map((item) => (
                <li key={item.lap}>
                  <span className="text-mute">{t("Parcial {n}", { n: item.lap })}: </span>
                  <span className="font-mono text-mist">
                    {item.timeS ? `${item.timeS.toFixed(2)} s` : "—"} · {item.distanceM ? `${item.distanceM} m` : "—"} ·{" "}
                    {t("{count} pernadas", { count: item.kicks })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="border-t border-line px-4 py-2 text-[11px] text-mute">
          {t("SR = ciclos por minuto. DPS = metros por ciclo. Índice = velocidade × DPS (mais alto = mais eficiente).")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-2 px-4 py-2.5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-mute">{t("Comparar com outra prova")}</h3>
          {candidates.length ? (
            <select
              className="field h-9 w-auto min-w-56 py-1 text-sm"
              value={compareId}
              onChange={(event) => setCompareId(event.target.value)}
              aria-label={t("Comparar com outra prova")}
            >
              <option value="">{t("Escolher prova…")}</option>
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDatePt(item.date)} · {item.tournament || "—"} · {formatRaceClock(raceSummary(item).finalS)}
                </option>
              ))}
            </select>
          ) : null}
        </header>
        {!candidates.length ? (
          <p className="px-4 py-5 text-sm text-mute">{t("Ainda não há outra prova igual com informação para comparar.")}</p>
        ) : !comparison || !other ? (
          <p className="px-4 py-5 text-sm text-mute">{t("Escolhe uma prova para ver onde se ganhou ou perdeu tempo, troço a troço.")}</p>
        ) : (
          <div>
            <dl className="grid grid-cols-2 sm:grid-cols-5 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
              {(["start", "swim", "turn", "finish"] as const).map((kind) => (
                <DeltaCell key={kind} label={t(SEGMENT_KIND_LABEL[kind])} value={comparison.byKind[kind]} />
              ))}
              <DeltaCell label={t("Total medido")} value={comparison.total} strong />
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm tabular">
                <thead>
                  <tr className="border-b border-line bg-panel-2 text-left text-[11px] font-semibold uppercase tracking-wide text-mute">
                    <th className="px-4 py-2">{t("Troço")}</th>
                    <th className="px-3 py-2 text-right">{formatDatePt(other.date)}</th>
                    <th className="px-3 py-2 text-right">{formatDatePt(session.date)}</th>
                    <th className="px-3 py-2">{t("Diferença")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.segments.map((segment, index) => {
                    const width = Math.min(100, (Math.abs(segment.delta) / 0.5) * 100);
                    return (
                      <tr key={`${segment.from}-${segment.to}`} className={index % 2 ? "bg-panel-2/60" : ""}>
                        <td className="whitespace-nowrap px-4 py-2 font-semibold">
                          {segment.from}–{segment.to} m{" "}
                          <span className={`ml-1 rounded px-1 py-0.5 text-[10px] font-semibold ${KIND_TONE[segment.kind]}`}>
                            {t(SEGMENT_KIND_LABEL[segment.kind])}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-mute">{num(segment.a)}</td>
                        <td className="px-3 py-2 text-right font-mono">{num(segment.b)}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="relative h-2 w-28 rounded-full bg-panel-2">
                              <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                              <span
                                className={`absolute inset-y-0 rounded-full ${segment.delta <= 0 ? "bg-good" : "bg-coral"}`}
                                style={segment.delta <= 0 ? { right: "50%", width: `${width / 2}%` } : { left: "50%", width: `${width / 2}%` }}
                              />
                            </span>
                            <span className={`font-mono text-xs font-semibold ${segment.delta <= 0 ? "text-good" : "text-coral"}`}>
                              {signed(segment.delta)}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2 text-[11px] text-mute">
              {t("Verde: esta prova foi mais rápida nesse troço. Só entram troços medidos nas duas provas.")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function DeltaCell({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  const tone = value < 0 ? "text-good" : value > 0 ? "text-coral" : "text-mist";
  return (
    <div className={`px-4 py-3 ${strong ? "bg-panel-2" : ""}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</dt>
      <dd className={`mt-1 font-display text-2xl font-bold leading-none tabular ${tone}`}>
        {signed(value)}
        <span className="ml-1 font-sans text-xs font-medium text-mute">s</span>
      </dd>
    </div>
  );
}
