"use client";

import { Fragment, useState } from "react";
import { useT } from "@/i18n/provider";
import { BLOCK_LABEL } from "@/lib/labels";
import { formatMeters, workoutMeters } from "@/lib/rankings";
import { workoutPlainText, writtenBlockLines } from "@/lib/workout-text";
import type { Workout } from "@/lib/types";

// Cool-to-hot scale so a set's effort reads at a glance.
const INTENSITY_TONE: Record<string, string> = {
  SUAVE: "bg-[#e8f1f8] text-[#46607d]",
  A1: "bg-[#e3f1fb] text-[#1d5f96]",
  A2: "bg-[#dcebfa] text-[#1668b8]",
  A3: "bg-[#fff1d6] text-[#9a6200]",
  PA: "bg-[#ffe3d3] text-[#b4480f]",
  MAX: "bg-[#fdd9d5] text-[#b3261e]",
  P50: "bg-[#fdd9d5] text-[#b3261e]",
  P100: "bg-[#fdd9d5] text-[#b3261e]",
  P200: "bg-[#ffe3d3] text-[#b4480f]",
  P400: "bg-[#fff1d6] text-[#9a6200]",
};
const TOKEN = /\b(SUAVE|A1|A2|A3|PA|MAX|P50|P100|P200|P400)\b/g;

function Line({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, index) =>
        INTENSITY_TONE[part] ? (
          <span key={index} className={`mx-0.5 rounded px-1.5 py-0.5 text-[13px] font-bold ${INTENSITY_TONE[part]}`}>
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function WorkoutSheet({ workout }: { workout: Workout }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-panel-2 px-5 py-3">
        <h2 className="font-display text-xl font-bold">{t("Plano")}</h2>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(workoutPlainText(workout));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
          className="text-sm font-semibold text-pool hover:underline"
        >
          {copied ? t("Copiado") : t("Copiar como texto")}
        </button>
      </header>
      <ol>
        {workout.blocks.map((block) => {
          const meters = workoutMeters({ ...workout, blocks: [block] });
          return (
            <li key={block.id} className="grid gap-3 border-t border-line px-5 py-4 first:border-t-0 sm:grid-cols-[140px_minmax(0,1fr)]">
              <div>
                <p className="font-display text-xl font-bold leading-tight">{BLOCK_LABEL[block.type]}</p>
                <p className="font-display text-lg font-semibold text-pool tabular">{formatMeters(meters)}</p>
              </div>
              <div className="space-y-1.5">
                {writtenBlockLines(block).map((line, index) => {
                  const mute = line.text === t("Sem saídas") || line.text.startsWith(t("Suave"));
                  return (
                    <p
                      key={`${block.id}-${index}`}
                      className={`text-[15px] leading-relaxed tabular ${
                        mute ? "text-mute" : line.indent ? "text-mist" : "text-lg font-semibold text-mist"
                      } ${line.indent ? "border-l-2 border-line pl-3" : ""}`}
                      style={line.indent ? { marginLeft: (line.indent - 1) * 16 } : undefined}
                    >
                      <Line text={line.text} />
                    </p>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
