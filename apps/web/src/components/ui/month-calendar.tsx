"use client";

import { monthDays, monthLabel, parseIsoDate, todayIso, WEEKDAYS } from "@/lib/dates";
import { IconChevron } from "@/components/ui/icons";

type MonthCalendarProps = {
  cursor: string;
  selected: string;
  workoutCountByDate: Record<string, number>;
  meetCountByDate?: Record<string, number>;
  onCursor: (isoDay: string) => void;
  onSelect: (isoDay: string) => void;
};

export function MonthCalendar({
  cursor,
  selected,
  workoutCountByDate,
  meetCountByDate = {},
  onCursor,
  onSelect,
}: MonthCalendarProps) {
  const today = todayIso();
  const cells = monthDays(cursor);
  const cursorDate = parseIsoDate(cursor);

  function shift(delta: number) {
    const next = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + delta, 1);
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    onCursor(iso);
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="rounded-xl border border-line p-2 text-mute">
          <IconChevron dir="left" />
        </button>
        <h2 className="text-lg font-semibold">{monthLabel(cursor)}</h2>
        <button type="button" onClick={() => shift(1)} className="rounded-xl border border-line p-2 text-mute">
          <IconChevron dir="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <p key={day} className="py-1 text-center text-xs font-semibold text-mute">
            {day}
          </p>
        ))}
        {cells.map((iso, index) => {
          if (!iso) return <div key={`empty-${index}`} />;
          const count = workoutCountByDate[iso] ?? 0;
          const meets = meetCountByDate[iso] ?? 0;
          const isSelected = iso === selected;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-md text-sm lg:min-h-12 ${
                isSelected
                  ? "bg-aqua font-bold text-ink"
                  : isToday
                    ? "border border-aqua/40 text-mist"
                    : "text-mist"
              }`}
            >
              {Number(iso.slice(-2))}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {count === 0 && meets === 0 ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-ink/25" : "bg-transparent"}`} />
                ) : (
                  <>
                    {count > 0 && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-ink" : "bg-aqua"}`} />
                    )}
                    {meets > 0 && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-ink" : "bg-sand"}`} />
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-mute">Ponto escuro = treino. Ponto azul = competição.</p>
    </section>
  );
}
