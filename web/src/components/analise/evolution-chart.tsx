"use client";

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
  const chronological = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.timeS - b.timeS);
  const width = 720;
  const height = 260;
  const pad = { l: 58, r: 18, t: 22, b: 42 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const times = chronological.map((record) => record.timeS);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(0.2, max - min);
  const x = (index: number) =>
    chronological.length <= 1 ? pad.l + innerW / 2 : pad.l + (index / (chronological.length - 1)) * innerW;
  const y = (time: number) => pad.t + ((max - time) / span) * innerH;
  const path = chronological
    .map((record, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(record.timeS).toFixed(1)}`)
    .join(" ");

  if (!chronological.length) {
    return <p className="px-4 py-8 text-center text-sm text-mute">Ainda sem tempos nesta prova.</p>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Evolução de tempos">
      <rect x="0" y="0" width={width} height={height} rx="18" fill="#081722" />
      {[0, 0.5, 1].map((tick) => {
        const value = min + span * (1 - tick);
        const yy = pad.t + tick * innerH;
        return (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke="rgba(125,211,201,0.12)" />
            <text x={pad.l - 8} y={yy + 4} textAnchor="end" fill="#7f9aa6" fontSize="11" fontFamily="ui-monospace, monospace">
              {formatRaceClock(value)}
            </text>
          </g>
        );
      })}
      {path ? <path d={path} fill="none" stroke="#3dffe8" strokeWidth="2.4" strokeLinejoin="round" /> : null}
      {chronological.map((record, index) => {
        const active = record.id === selectedId;
        return (
          <g key={record.id}>
            <circle
              cx={x(index)}
              cy={y(record.timeS)}
              r={active ? 8 : 6}
              fill={active ? "#f5c542" : "#3dffe8"}
              stroke="#061018"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={() => onSelect(record.id)}
            >
              <title>
                {formatRaceClock(record.timeS)} · {formatDatePt(record.date)}
              </title>
            </circle>
            {index === 0 || index === chronological.length - 1 ? (
              <text x={x(index)} y={height - 14} textAnchor="middle" fill="#7f9aa6" fontSize="11">
                {formatDatePt(record.date)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
