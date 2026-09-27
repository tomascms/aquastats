"use client";

import { useT } from "@/i18n/provider";
import { formatDatePt } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import type { RaceRecord } from "@/lib/rankings";

export function EvolutionChart({
  records,
  selectedId,
  onSelect,
}: {
  records: RaceRecord[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const chronological = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.timeS - b.timeS);

  if (!chronological.length) {
    return <p className="px-4 py-8 text-center text-sm text-mute">{t("Ainda sem tempos nesta prova.")}</p>;
  }

  const width = 720;
  const height = 260;
  const pad = { l: 62, r: 22, t: 24, b: 42 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const times = chronological.map((record) => record.timeS);
  const min = Math.min(...times);
  const max = Math.max(...times);
  // Pad the domain so a single result (or identical ones) sits mid-chart, not on an edge.
  const margin = Math.max(0.1, (max - min) * 0.12);
  const lo = min - margin;
  const hi = max + margin;
  const x = (index: number) =>
    chronological.length <= 1 ? pad.l + innerW / 2 : pad.l + (index / (chronological.length - 1)) * innerW;
  // Faster times sit higher: improvement reads as the line going up.
  const y = (time: number) => pad.t + ((time - lo) / (hi - lo)) * innerH;
  const path = chronological
    .map((record, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(record.timeS).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={t("Evolução de tempos: mais rápido em cima")}>
      <rect x="0" y="0" width={width} height={height} rx="14" fill="#0b2545" />
      {[0, 0.5, 1].map((tick) => {
        const value = lo + (hi - lo) * tick;
        const yy = pad.t + tick * innerH;
        return (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke="rgba(255,255,255,0.1)" />
            <text
              x={pad.l - 10}
              y={yy + 4}
              textAnchor="end"
              fill="#a9bed3"
              fontSize="12"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatRaceClock(value)}
            </text>
          </g>
        );
      })}
      {chronological.length > 1 ? (
        <path d={path} fill="none" stroke="#7cc4ff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {chronological.map((record, index) => {
        const active = record.id === selectedId;
        return (
          <g key={record.id}>
            <circle
              cx={x(index)}
              cy={y(record.timeS)}
              r={active ? 8 : 6}
              fill={active ? "#e2463c" : "#ffffff"}
              stroke="#7cc4ff"
              strokeWidth="2.5"
              className="cursor-pointer"
              onClick={() => onSelect(record.id)}
            >
              <title>
                {formatRaceClock(record.timeS)} · {formatDatePt(record.date)}
              </title>
            </circle>
            {index === 0 || index === chronological.length - 1 ? (
              <text x={x(index)} y={height - 14} textAnchor="middle" fill="#a9bed3" fontSize="12">
                {formatDatePt(record.date)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
