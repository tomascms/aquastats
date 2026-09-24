"use client";

import { useState } from "react";
import { BLOCK_LABEL } from "@/lib/labels";
import { workoutPlainText, writtenBlockLines } from "@/lib/workout-text";
import type { Workout } from "@/lib/types";

export function WorkoutSheet({ workout }: { workout: Workout }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      {workout.blocks.map((block) => (
        <section key={block.id} className="rounded-xl border border-line bg-panel px-4 py-4">
          <h2 className="text-lg font-semibold">{BLOCK_LABEL[block.type]}</h2>
          <div className="mt-3 space-y-1">
            {writtenBlockLines(block).map((line, index) => {
              const mute = line.text === "Sem saídas" || line.text.startsWith("Suave");
              return (
                <p
                  key={`${block.id}-${index}`}
                  className={`font-mono text-[15px] leading-relaxed ${mute ? "text-mute" : line.indent ? "text-aqua" : "text-mist"}`}
                  style={{ paddingLeft: line.indent * 16 }}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        </section>
      ))}

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
        className="flex h-12 w-full items-center justify-center rounded-2xl border border-line text-sm font-semibold"
      >
        {copied ? "Copiado" : "Copiar treino"}
      </button>
    </div>
  );
}
