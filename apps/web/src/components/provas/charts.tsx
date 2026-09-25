"use client";

import { useId, useRef } from "react";

export type Series = {
  id: string;
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
  axis?: "left" | "right";
};

type ChartKind = "line" | "bar" | "stack";

type StackGroup = { key: string; color: string; values: number[] };

function niceMax(values: number[]): number {
  const max = Math.max(0, ...values.filter((value) => Number.isFinite(value)));
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow;
}

async function svgToPng(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("png"));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 760;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#f7fbfa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 40, 40, 1320, 680);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function RaceChart({
  title,
  labels,
  series,
  kind = "line",
  stacks,
  overlay,
  unit,
  unitRight,
}: {
  title: string;
  labels: string[];
  series?: Series[];
  kind?: ChartKind;
  stacks?: StackGroup[];
  overlay?: Series;
  unit?: string;
  unitRight?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useId();
  const width = 640;
  const height = 280;
  const pad = { l: 44, r: unitRight ? 46 : 16, t: 18, b: 32 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const leftValues = [
    ...(series ?? []).filter((item) => item.axis !== "right").flatMap((item) => item.values),
    ...(stacks ?? []).flatMap((stack) => stack.values),
    ...(overlay && overlay.axis !== "right" ? overlay.values : []),
  ];
  const rightValues = [
    ...(series ?? []).filter((item) => item.axis === "right").flatMap((item) => item.values),
    ...(overlay?.axis === "right" ? overlay.values : []),
  ];
  const maxL = niceMax(leftValues);
  const maxR = niceMax(rightValues.length ? rightValues : [1]);
  const n = Math.max(labels.length, 1);
  const xAt = (index: number) => pad.l + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW);
  const barW = Math.max(8, innerW / Math.max(n, 1) / (1.6 + (series?.length ?? 1) * 0.15));
  const yL = (value: number) => pad.t + innerH - (value / maxL) * innerH;
  const yR = (value: number) => pad.t + innerH - (value / maxR) * innerH;

  function linePath(values: number[], right = false) {
    return values
      .map((value, index) => `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(1)} ${(right ? yR : yL)(value).toFixed(1)}`)
      .join(" ");
  }

  return (
    <article className="rounded-xl border border-line bg-panel/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-mist">{title}</h3>
          {unit ? <p className="text-xs text-mute">{unit}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => svgRef.current && void svgToPng(svgRef.current, `${title.replace(/\s+/g, "-").toLowerCase()}.png`)}
          className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-mute hover:text-aqua"
        >
          PNG
        </button>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
        <rect width={width} height={height} fill="#0c1c2a" rx="16" />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad.t + innerH * (1 - tick);
          return (
            <g key={tick}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="rgba(125,211,201,0.1)" />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="#7f9aa6" fontSize="9">
                {(maxL * tick).toFixed(tick === 0 || maxL >= 10 ? 0 : 2)}
              </text>
              {unitRight ? (
                <text x={width - pad.r + 8} y={y + 3} fill="#7f9aa6" fontSize="9">
                  {(maxR * tick).toFixed(2)}
                </text>
              ) : null}
            </g>
          );
        })}
        {labels.map((label, index) => (
          <text key={label + index} x={xAt(index)} y={height - 10} textAnchor="middle" fill="#7f9aa6" fontSize="10">
            {label}
          </text>
        ))}
        {kind === "stack" && stacks
          ? labels.map((_, index) => {
              let acc = 0;
              return stacks.map((stack) => {
                const value = stack.values[index] || 0;
                const y = yL(acc + value);
                const h = yL(acc) - y;
                acc += value;
                return (
                  <rect
                    key={`${stack.key}-${index}`}
                    x={xAt(index) - barW / 2}
                    y={y}
                    width={barW}
                    height={Math.max(0, h)}
                    fill={stack.color}
                    rx="3"
                  />
                );
              });
            })
          : null}
        {kind === "bar" && series
          ? series.map((item, seriesIndex) =>
              item.values.map((value, index) => (
                <rect
                  key={`${item.id}-${index}`}
                  x={xAt(index) - (series.length * barW) / 2 + seriesIndex * barW}
                  y={yL(value)}
                  width={barW * 0.9}
                  height={Math.max(0, yL(0) - yL(value))}
                  fill={item.color}
                  rx="3"
                />
              )),
            )
          : null}
        {kind === "line" && series
          ? series.map((item) => (
              <g key={item.id}>
                <path
                  d={linePath(item.values, item.axis === "right")}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="2.4"
                  strokeDasharray={item.dashed ? "7 5" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {item.values.map((value, index) => (
                  <circle
                    key={index}
                    cx={xAt(index)}
                    cy={(item.axis === "right" ? yR : yL)(value)}
                    r="3.2"
                    fill={item.color}
                  />
                ))}
              </g>
            ))
          : null}
        {overlay ? (
          <path
            d={linePath(overlay.values, overlay.axis === "right")}
            fill="none"
            stroke={overlay.color}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        ) : null}
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3dffe8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3dffe8" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 px-1">
        {(series ?? []).concat(overlay ? [overlay] : []).map((item) => (
          <span key={item.id} className="flex items-center gap-1.5 text-[10px] text-mute">
            <i className="inline-block h-2 w-3 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        {stacks?.map((stack) => (
          <span key={stack.key} className="flex items-center gap-1.5 text-[10px] text-mute">
            <i className="inline-block h-2 w-3 rounded-full" style={{ background: stack.color }} />
            {stack.key}
          </span>
        ))}
      </div>
    </article>
  );
}

export function PieChart({
  title,
  slices,
}: {
  title: string;
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let angle = -Math.PI / 2;
  const cx = 90;
  const cy = 90;
  const r = 68;
  return (
    <article className="rounded-xl border border-line bg-panel/90 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 flex items-center gap-4">
        <svg viewBox="0 0 180 180" className="h-40 w-40">
          {slices.map((slice) => {
            const sweep = (slice.value / total) * Math.PI * 2;
            const x1 = cx + r * Math.cos(angle);
            const y1 = cy + r * Math.sin(angle);
            angle += sweep;
            const x2 = cx + r * Math.cos(angle);
            const y2 = cy + r * Math.sin(angle);
            const large = sweep > Math.PI ? 1 : 0;
            return (
              <path
                key={slice.label}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                fill={slice.color}
              />
            );
          })}
          <circle cx={cx} cy={cy} r="36" fill="#0c1c2a" />
        </svg>
        <ul className="space-y-1 text-xs">
          {slices.map((slice) => (
            <li key={slice.label} className="flex items-center gap-2 text-mute">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
              {slice.label}
              <span className="text-mist">{Math.round((slice.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
