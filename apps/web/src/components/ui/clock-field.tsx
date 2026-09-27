"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n/provider";
import { canAcceptSecondsDigit, padClockDigit } from "@/lib/swim-time";
import type { TimeParts } from "@/lib/types";

type Mode = "full" | "split";
type Mark = "clock" | "race";

const LIMIT: Record<keyof TimeParts, number> = { mm: 99, ss: 59, cc: 99 };

function focusMarked(from: HTMLInputElement, delta: number, mark: Mark) {
  const attr = mark === "race" ? "data-race-input" : "data-clock-input";
  const all = [...document.querySelectorAll<HTMLInputElement>(`[${attr}]`)];
  const index = all.indexOf(from);
  const next = all[index + delta];
  if (!next) return;
  next.focus();
  next.select();
}

export function ClockField({
  value,
  onChange,
  mode = "full",
  mark = "clock",
  compact = false,
  readOnly = false,
  startOnSeconds = false,
}: {
  value: TimeParts;
  onChange: (next: TimeParts) => void;
  mode?: Mode;
  mark?: Mark;
  compact?: boolean;
  readOnly?: boolean;
  startOnSeconds?: boolean;
}) {
  const t = useT();
  const fields: Array<keyof TimeParts> = mode === "split" ? ["ss", "cc"] : ["mm", "ss", "cc"];
  const tight = compact || mode === "split";
  const secondsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (readOnly || !startOnSeconds || mode === "split") return;
    const node = secondsRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [mode, readOnly, startOnSeconds]);

  function setField(field: keyof TimeParts, digits: string, input: HTMLInputElement) {
    if (readOnly) return;
    if (mode === "full" && field === "ss" && digits) {
      const last = digits.slice(-1);
      if (!canAcceptSecondsDigit(digits.slice(0, -1), last)) return;
    } else if (digits && Number(digits) > (mode === "split" && field === "ss" ? 99 : LIMIT[field])) {
      return;
    }
    onChange({ ...value, [field]: digits });
    if (digits.length >= 2) requestAnimationFrame(() => focusMarked(input, 1, mark));
  }

  function commit(field: keyof TimeParts) {
    if (readOnly) return;
    const padded = padClockDigit(field, value[field]);
    if (padded === value[field]) return;
    onChange({ ...value, [field]: padded });
  }

  return (
    <div className={`flex items-center font-mono ${tight ? "justify-center gap-0.5 text-xs" : "gap-1 text-sm"}`}>
      {fields.map((field, index) => (
        <span key={field} className="flex items-center gap-0.5">
          <input
            ref={field === "ss" ? secondsRef : undefined}
            data-race-input={mark === "race" ? "" : undefined}
            data-clock-input={mark === "clock" ? "" : undefined}
            inputMode="numeric"
            maxLength={2}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            aria-label={field === "mm" ? t("Minutos") : field === "ss" ? t("Segundos") : t("Centésimos")}
            placeholder="__"
            className={
              tight
                ? `h-8 w-8 rounded-md border px-0 text-center font-mono text-xs outline-none placeholder:text-mute/50 ${
                    readOnly ? "border-line/60 bg-ink-2 text-aqua" : "border-line bg-white focus:border-aqua"
                  }`
                : `field w-12 px-1 text-center ${readOnly ? "bg-ink-2 text-aqua" : ""}`
            }
            value={value[field]}
            onChange={(event) => setField(field, event.target.value.replace(/\D/g, "").slice(0, 2), event.currentTarget)}
            onFocus={(event) => {
              if (readOnly) return;
              event.currentTarget.select();
            }}
            onBlur={() => commit(field)}
            onKeyDown={(event) => {
              if (readOnly) return;
              if (event.key === "Enter") {
                event.preventDefault();
                const padded = padClockDigit(field, value[field]);
                if (padded !== value[field]) onChange({ ...value, [field]: padded });
                focusMarked(event.currentTarget, 1, mark);
                return;
              }
              if (event.key === "Backspace" && !value[field]) {
                event.preventDefault();
                focusMarked(event.currentTarget, -1, mark);
              }
            }}
          />
          {field === "mm" ? <span className="text-mute">{"'"}</span> : null}
          {field === "ss" && index < fields.length - 1 ? <span className="text-mute">{'"'}</span> : null}
        </span>
      ))}
    </div>
  );
}
