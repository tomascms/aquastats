"use client";

import { useT } from "@/i18n/provider";
import type { HrSession } from "@/lib/types";

/** Heart-rate curve for one session, with the max marked. Pure SVG, scales to the container. */
export function HrChart({ session }: { session: HrSession }) {
  const t = useT();
  const points = session.samples;
  if (points.length < 2) return null;
  const width = 600;
  const height = 120;
  const duration = points[points.length - 1][0] || 1;
  const bpms = points.map(([, bpm]) => bpm);
  const low = Math.max(40, Math.min(...bpms) - 5);
  const high = Math.max(...bpms) + 5;
  const x = (offset: number) => (offset / duration) * width;
  const y = (bpm: number) => height - ((bpm - low) / (high - low)) * height;
  const path = points.map(([offset, bpm], index) => `${index ? "L" : "M"}${x(offset).toFixed(1)},${y(bpm).toFixed(1)}`).join("");
  const peak = points.reduce((best, point) => (point[1] > best[1] ? point : best), points[0]);
  const minutes = Math.round(duration / 60);

  return (
    <figure className="rounded-2xl border border-line bg-panel p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{t("Frequência cardíaca")}</span>
        <span className="font-mono text-xs text-mute">
          {t("Média {avg} · máx. {max} bpm", { avg: session.avgHr ?? "—", max: session.maxHr ?? "—" })} · {minutes} min
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label={t("Frequência cardíaca")}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-coral" vectorEffect="non-scaling-stroke" />
        <circle cx={x(peak[0])} cy={y(peak[1])} r="3" className="fill-coral" />
      </svg>
    </figure>
  );
}
