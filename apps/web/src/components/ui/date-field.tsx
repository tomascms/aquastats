"use client";

import { useEffect, useRef, useState } from "react";
import { IconCalendar } from "@/components/ui/icons";

/** dd/mm/aaaa ⇄ yyyy-mm-dd, always in this order regardless of the value. */
function toPt(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function toIso(pt: string): string {
  const match = pt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  // Rejects "31/02/2026" etc: a real Feb 31 overflows into March, so the day no longer matches.
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(day)) return "";
  return `${year}-${month}-${day}`;
}

/**
 * A date field that always reads dd/mm/aaaa, whatever the browser or OS locale is — unlike a native
 * `<input type="date">`, whose displayed format follows the browser's own locale, not the site's. A
 * hidden native input still provides the calendar picker; picking a date fills the visible text.
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  required,
  id,
  className = "",
  inputClassName = "field h-10 py-1",
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  id?: string;
  /** Classes for the wrapper (spacing/margins, e.g. "mt-1.5"). */
  className?: string;
  /** Classes for the visible input, replacing the default size (e.g. "field h-8 py-1 text-sm"). */
  inputClassName?: string;
}) {
  const [text, setText] = useState(() => toPt(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(toPt(value));
  }, [value]);

  function handleType(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const next = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setText(next);
    const iso = toIso(next);
    if (iso) onChange(iso);
  }

  return (
    <span className={`relative inline-flex w-full ${className}`}>
      <input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(event) => handleType(event.target.value)}
        onBlur={() => setText(toPt(value))}
        required={required}
        className={`${inputClassName} w-full pr-9 font-mono`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          const picker = nativeRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
          if (picker?.showPicker) picker.showPicker();
          else picker?.focus();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-mute hover:text-mist"
      >
        <IconCalendar className="h-4 w-4" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          onChange(event.target.value);
          setText(toPt(event.target.value));
        }}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  );
}
