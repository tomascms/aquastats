"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatApiError, type ApiError } from "@/lib/api";
import { WEEKDAYS, addDays, monthDays, monthLabel, parseIsoDate, todayIso } from "@/lib/dates";
import { formatDatePt } from "@/lib/labels";
import { actions } from "@/lib/store";
import { toast } from "@/lib/toast";
import { IconChevron } from "@/components/ui/icons";
import type { Athlete, GymType, WellnessEntry } from "@/lib/types";

const GYM: { value: GymType; label: "Força" | "Mobilidade" | "Explosão"; short: string }[] = [
  { value: "strength", label: "Força", short: "F" },
  { value: "mobility", label: "Mobilidade", short: "M" },
  { value: "explosive", label: "Explosão", short: "E" },
];
const RECOVERY_TONE = ["", "bg-coral", "bg-[#f08c4a]", "bg-[#e0a100]", "bg-[#7cc26b]", "bg-good"];

/**
 * Sleep, gym and recovery day by day, like the coach's training calendar. Past days of the
 * month without anything logged are marked, so the swimmer sees what is missing. The coach sees
 * the same calendar read-only on the athlete page.
 */
export function WellnessCalendar({ athlete, editable }: { athlete: Athlete; editable: boolean }) {
  const t = useT();
  const today = todayIso();
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState<string | null>(editable ? today : null);
  const byDay = useMemo(() => new Map((athlete.wellness ?? []).map((entry) => [entry.date, entry])), [athlete.wellness]);
  const cells = monthDays(cursor);
  const monthStart = cursor.slice(0, 8) + "01";
  const missing = cells.filter((iso) => iso && iso <= today && iso >= monthStart && !byDay.has(iso)).length;

  function shift(delta: number) {
    const date = parseIsoDate(cursor);
    const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
    setCursor(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel-2 px-4 py-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Sono, ginásio e recuperação")}</h2>
          <p className={`text-xs ${missing ? "font-semibold text-coral" : "text-good"}`}>
            {missing ? t("{count} dias sem registo este mês", { count: missing }) : t("Mês completo")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} aria-label={t("Mês anterior")} className="rounded-lg border border-line p-1.5 text-mute">
            <IconChevron dir="left" />
          </button>
          <span className="min-w-28 text-center text-sm font-semibold">{monthLabel(cursor)}</span>
          <button type="button" onClick={() => shift(1)} aria-label={t("Mês seguinte")} className="rounded-lg border border-line p-1.5 text-mute">
            <IconChevron dir="right" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px bg-line p-px">
        {WEEKDAYS.map((day) => (
          <p key={day} className="bg-panel-2 py-1 text-center text-[11px] font-semibold text-mute">
            {day}
          </p>
        ))}
        {cells.map((iso, index) => {
          if (!iso) return <div key={`e-${index}`} className="bg-panel" />;
          const entry = byDay.get(iso);
          const future = iso > today;
          const gaps = !entry && !future;
          return (
            <button
              key={iso}
              type="button"
              disabled={!editable || future}
              onClick={() => setSelected(iso)}
              className={`flex min-h-16 flex-col items-start gap-0.5 p-1.5 text-left text-[11px] ${
                selected === iso ? "bg-pool-soft ring-2 ring-inset ring-pool" : gaps ? "bg-[#fff6f5]" : "bg-panel"
              } ${future ? "opacity-40" : ""}`}
            >
              <span className={`font-semibold ${iso === today ? "rounded bg-pool px-1 text-white" : "text-mist"}`}>{Number(iso.slice(8))}</span>
              {entry ? (
                <>
                  {entry.sleepHours != null ? <span className="font-mono text-mist">{entry.sleepHours}h</span> : null}
                  <span className="flex items-center gap-1">
                    {entry.gym ? <span className="rounded bg-aqua px-1 text-[10px] font-bold text-white">{GYM.find((g) => g.value === entry.gym)?.short}</span> : null}
                    {entry.recovery ? <span className={`h-2 w-2 rounded-full ${RECOVERY_TONE[entry.recovery]}`} title={`${entry.recovery}/5`} /> : null}
                  </span>
                </>
              ) : gaps ? (
                <span className="text-coral">{t("em falta")}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="px-4 py-1.5 text-[11px] text-mute">{t("h = horas de sono · F/M/E = ginásio (força, mobilidade, explosão) · ponto = recuperação (vermelho cansado, verde fresco)")}</p>

      {editable && selected ? (
        <DayForm key={selected} athlete={athlete} date={selected} entry={byDay.get(selected)} onDone={(next) => setSelected(next)} />
      ) : null}
    </section>
  );
}

function DayForm({ athlete, date, entry, onDone }: { athlete: Athlete; date: string; entry?: WellnessEntry; onDone: (next: string | null) => void }) {
  const t = useT();
  const [sleep, setSleep] = useState(entry?.sleepHours != null ? String(entry.sleepHours) : "");
  const [gym, setGym] = useState<GymType | null>(entry?.gym ?? null);
  const [recovery, setRecovery] = useState<number | null>(entry?.recovery ?? null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const next: WellnessEntry = { date, sleepHours: sleep ? Number(sleep.replace(",", ".")) : null, gym, recovery };
    try {
      await actions.patchOwnAthlete(athlete.id, { wellness: [...(athlete.wellness ?? []).filter((item) => item.date !== date), next] });
      toast.success(t("Guardado"));
      // Jump to the next missing past day so filling gaps is quick.
      let probe = addDays(date, 1);
      const today = todayIso();
      const have = new Set((athlete.wellness ?? []).map((item) => item.date).concat(date));
      while (probe <= today && have.has(probe)) probe = addDays(probe, 1);
      onDone(probe <= today ? probe : null);
    } catch (error) {
      toast.error(formatApiError(error as ApiError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4 border-t border-line bg-panel-2 px-4 py-3">
      <p className="w-full text-sm font-semibold text-mist">{formatDatePt(date)}</p>
      <label className="text-xs font-semibold text-mute">
        {t("Horas de sono")}
        <input type="number" min="0" max="24" step="0.5" className="field mt-1 h-9 w-24 py-1" value={sleep} onChange={(event) => setSleep(event.target.value)} placeholder="8" />
      </label>
      <div className="text-xs font-semibold text-mute">
        {t("Ginásio")}
        <div className="mt-1 flex gap-1">
          {GYM.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setGym((current) => (current === item.value ? null : item.value))}
              className={`h-9 rounded-lg px-3 text-sm font-semibold ${gym === item.value ? "bg-aqua text-white" : "border border-line bg-panel text-mute"}`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs font-semibold text-mute">
        {t("Recuperação")}
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRecovery((current) => (current === value ? null : value))}
              className={`h-9 w-9 rounded-lg text-sm font-bold ${recovery === value ? `${RECOVERY_TONE[value]} text-white` : "border border-line bg-panel text-mute"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-primary ml-auto h-9" disabled={busy} onClick={() => void save()}>
        {busy ? t("A guardar…") : t("Guardar")}
      </button>
    </div>
  );
}
