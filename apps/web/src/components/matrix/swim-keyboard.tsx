"use client";

import { useState } from "react";
import { type SplitChoice } from "@/lib/distances";
import { formatDraft } from "@/lib/swim-time";
import type { Stroke, TimeParts } from "@/lib/types";
import { STROKE_LABEL, STROKES } from "@/lib/labels";
import { IconBackspace, IconChevron, IconPlus } from "@/components/ui/icons";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

type Field = 0 | 1 | 2;

type SwimKeyboardProps = {
  parts: TimeParts;
  field: Field;
  invalid: boolean;
  athleteName: string;
  repLabel: string;
  finalLabel: string;
  splitMarks: SplitChoice[];
  activeSplit: number | null;
  availableSplits: SplitChoice[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onField: (field: Field) => void;
  onPrevAthlete: () => void;
  onNextAthlete: () => void;
  onPrevRep: () => void;
  onNextRep: () => void;
  onSplit: (atM: number | null) => void;
  onToggleSplit: (atM: number) => void;
  onClear?: () => void;
  onNotDone?: () => void;
  stroke?: Stroke | "";
  onStroke?: (stroke: Stroke) => void;
};

export function SwimKeyboard({
  parts,
  field,
  invalid,
  athleteName,
  repLabel,
  finalLabel,
  splitMarks,
  activeSplit,
  availableSplits,
  collapsed,
  onToggleCollapse,
  onDigit,
  onBackspace,
  onField,
  onPrevAthlete,
  onNextAthlete,
  onPrevRep,
  onNextRep,
  onSplit,
  onToggleSplit,
  onClear,
  onNotDone,
  stroke,
  onStroke,
}: SwimKeyboardProps) {
  const display = formatDraft(parts, field);
  const [picker, setPicker] = useState(false);
  const chips: SplitChoice[] = [];
  for (const mark of splitMarks) {
    if (!chips.some((item) => Math.abs(item.atM - mark.atM) < 0.05)) chips.push(mark);
  }

  if (collapsed) {
    return (
      <section className="safe-bottom border-t border-line bg-panel px-3 py-2" aria-label="Teclado oculto">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-xs text-mute">
            <span className="font-semibold text-mist">{athleteName}</span>
            <span className="mx-1">·</span>
            {repLabel}
          </div>
          <button type="button" onClick={onToggleCollapse} className="btn-primary h-9 shrink-0 px-4 text-xs">
            Teclado
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="safe-bottom border-t border-line bg-ink-2/95 px-2 pt-2 backdrop-blur-md" aria-label="Teclado de tempos">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-mist">{athleteName}</div>
        <div className="min-w-0 flex-1 truncate text-center text-[10px] text-mute">{repLabel}</div>
        <button type="button" onClick={onToggleCollapse} className="shrink-0 rounded-md border border-line bg-panel px-2 py-1 text-[10px] font-semibold text-mute">
          Esconder
        </button>
      </div>

      <div className="mb-1.5 flex items-center justify-between gap-1">
        <NavCluster label="" onPrev={onPrevAthlete} onNext={onNextAthlete} axis="vertical" compact />
        <NavCluster label="" onPrev={onPrevRep} onNext={onNextRep} axis="horizontal" compact />
      </div>

      {(onStroke || availableSplits.length > 0 || onClear || onNotDone) && (
        <details className="mb-1.5 rounded-lg border border-line bg-panel/80">
          <summary className="cursor-pointer px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-mute">
            Estilo · parciais · apagar
          </summary>
          <div className="space-y-2 border-t border-line px-2 py-2">
            {onStroke && (
              <div className="flex flex-wrap gap-1">
                {STROKES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onStroke(item)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      stroke === item ? "bg-aqua text-ink" : "border border-line text-mute"
                    }`}
                  >
                    {STROKE_LABEL[item]}
                  </button>
                ))}
              </div>
            )}
            {availableSplits.length > 0 && (
              <div>
                <div className="flex flex-wrap gap-1">
                  {chips.map((mark) => (
                    <button
                      key={mark.atM}
                      type="button"
                      onClick={() => {
                        setPicker(false);
                        onSplit(mark.atM);
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        activeSplit != null && Math.abs(activeSplit - mark.atM) < 0.05
                          ? "bg-sand text-ink"
                          : "border border-line text-mute"
                      }`}
                    >
                      {mark.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPicker(false);
                      onSplit(null);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      activeSplit == null ? "bg-aqua text-ink" : "border border-line text-mute"
                    }`}
                  >
                    {finalLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicker((open) => !open)}
                    className={`flex h-6 items-center gap-1 rounded-full px-2 ${
                      picker ? "bg-aqua text-ink" : "border border-line text-mute"
                    }`}
                    aria-label="Parciais"
                  >
                    <IconPlus className="h-3 w-3" />
                    <span className="text-[10px] font-semibold">+</span>
                  </button>
                </div>
                {picker && (
                  <div className="mt-1.5 max-h-20 overflow-y-auto rounded-lg border border-line bg-panel p-1.5">
                    <div className="flex flex-wrap gap-1">
                      {availableSplits.map((mark) => {
                        const on = chips.some((item) => Math.abs(item.atM - mark.atM) < 0.05);
                        return (
                          <button
                            key={mark.atM}
                            type="button"
                            onClick={() => onToggleSplit(mark.atM)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              on ? "bg-sand text-ink" : "border border-line text-mute"
                            }`}
                          >
                            {mark.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {onClear ? (
              <button type="button" onClick={onClear} className="text-[10px] font-semibold text-coral">
                Apagar tempo
              </button>
            ) : null}
            {onNotDone ? (
              <button type="button" onClick={onNotDone} className="text-[10px] font-semibold text-coral">
                Não fez esta repetição
              </button>
            ) : null}
          </div>
        </details>
      )}

      <div
        className={`mb-2 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-0.5 ${invalid ? "shake" : ""}`}
        role="group"
        aria-live="polite"
        aria-label={`Tempo ${display.mm} minutos ${display.ss} segundos ${display.cc} centésimos`}
      >
        <TimeField label="MM" value={display.mm} active={field === 0} compact onClick={() => onField(0)} />
        <span className="pb-1 text-lg text-aqua/70">{"'"}</span>
        <TimeField label="SS" value={display.ss} active={field === 1} invalid={invalid} compact onClick={() => onField(1)} />
        <span className="pb-1 text-lg text-aqua/70">{'"'}</span>
        <TimeField label="CC" value={display.cc} active={field === 2} compact onClick={() => onField(2)} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 pb-1" role="group" aria-label="Teclas numéricas">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="keycap keycap-sm"
            aria-label={`Dígito ${key}`}
            onPointerDown={(event) => {
              event.preventDefault();
              onDigit(key);
            }}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          className="keycap keycap-sm text-coral"
          aria-label="Apagar dígito"
          onPointerDown={(event) => {
            event.preventDefault();
            onBackspace();
          }}
        >
          <IconBackspace className="mx-auto h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="keycap keycap-sm col-span-2"
          aria-label="Dígito 0"
          onPointerDown={(event) => {
            event.preventDefault();
            onDigit("0");
          }}
        >
          0
        </button>
      </div>
    </section>
  );
}

function TimeField({
  label,
  value,
  active,
  invalid,
  compact,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  invalid?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-1.5 ${compact ? "py-1" : "py-2"} ${
        invalid ? "border-coral bg-coral/10" : active ? "border-aqua bg-aqua/10" : "border-line bg-panel"
      }`}
    >
      <span className="block text-[9px] font-semibold uppercase tracking-wide text-mute">{label}</span>
      <span className={`font-mono font-medium leading-none text-mist ${compact ? "text-xl" : "text-[28px]"}`}>{value}</span>
    </button>
  );
}

function NavCluster({
  label,
  onPrev,
  onNext,
  axis,
  compact,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  axis: "horizontal" | "vertical";
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        aria-label={axis === "vertical" ? "Atleta anterior" : "Repetição anterior"}
        className={`rounded-lg border border-line bg-panel text-mute ${compact ? "min-h-9 min-w-9 p-1.5" : "min-h-11 min-w-11 p-2"}`}
      >
        <IconChevron dir={axis === "vertical" ? "up" : "left"} aria-hidden="true" />
      </button>
      {label ? (
        <p className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-mist" aria-live="polite">
          {label}
        </p>
      ) : (
        <span className="flex-1" />
      )}
      <button
        type="button"
        onClick={onNext}
        aria-label={axis === "vertical" ? "Atleta seguinte" : "Repetição seguinte"}
        className={`rounded-lg border border-line bg-panel text-mute ${compact ? "min-h-9 min-w-9 p-1.5" : "min-h-11 min-w-11 p-2"}`}
      >
        <IconChevron dir={axis === "vertical" ? "down" : "right"} aria-hidden="true" />
      </button>
    </div>
  );
}
