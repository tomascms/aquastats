"use client";

import { useState } from "react";
import { COURSE_LABEL, STROKE_LABEL, STROKES, formatEvent } from "@/lib/labels";
import { eventKey, eventsForCourse, isOfficialEvent, seedSplitMarks } from "@/lib/meets";
import { ClockField } from "@/components/ui/clock-field";
import { useT } from "@/i18n/provider";
import { EMPTY_PARTS, isEmptyParts, normalizeParts, partsFromNumbers } from "@/lib/swim-time";
import type { PoolCourse, SeedRecord, SplitTime, Stroke, TimeParts } from "@/lib/types";

function draftKey(course: PoolCourse, stroke: Stroke, distanceM: number) {
  return `${course}:${stroke}:${distanceM}`;
}

function splitKey(key: string, atM: number) {
  return `${key}:${atM}`;
}

function parseDraftKey(key: string): { course: PoolCourse; stroke: Stroke; distanceM: number } | null {
  const [course, stroke, raw] = key.split(":");
  const distanceM = Number(raw);
  if ((course !== "scm" && course !== "lcm") || !STROKES.includes(stroke as Stroke) || !Number.isFinite(distanceM)) {
    return null;
  }
  return { course, stroke: stroke as Stroke, distanceM };
}

function toTimes(records: SeedRecord[]): Record<string, TimeParts> {
  return Object.fromEntries(
    records.map((record) => [draftKey(record.course, record.stroke, record.distanceM), partsFromNumbers(record.mm, record.ss, record.cc)]),
  );
}

function toSplits(records: SeedRecord[]): Record<string, TimeParts> {
  const out: Record<string, TimeParts> = {};
  for (const record of records) {
    const key = draftKey(record.course, record.stroke, record.distanceM);
    for (const split of record.splits ?? []) {
      out[splitKey(key, split.atM)] = partsFromNumbers(split.mm, split.ss, split.cc);
    }
  }
  return out;
}

function splitsFor(key: string, distanceM: number, splitTimes: Record<string, TimeParts>): SplitTime[] {
  const out: SplitTime[] = [];
  for (const atM of seedSplitMarks(distanceM)) {
    const parts = splitTimes[splitKey(key, atM)];
    if (!parts || isEmptyParts(parts)) continue;
    out.push({ atM, ...normalizeParts(parts) });
  }
  return out;
}

export function SeedRecordsEditor({
  records,
  onChange,
}: {
  records: SeedRecord[];
  onChange: (next: SeedRecord[]) => void;
}) {
  const t = useT();
  const [course, setCourse] = useState<PoolCourse>("scm");
  const [choice, setChoice] = useState("");
  const [picked, setPicked] = useState<string[]>(() =>
    records
      .filter((record) => isOfficialEvent(record.stroke, record.distanceM, record.course))
      .map((record) => draftKey(record.course, record.stroke, record.distanceM)),
  );
  const [times, setTimes] = useState<Record<string, TimeParts>>(() => toTimes(records));
  const [splitTimes, setSplitTimes] = useState<Record<string, TimeParts>>(() => toSplits(records));
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(records.map((record) => [draftKey(record.course, record.stroke, record.distanceM), record.date || ""])),
  );

  const available = eventsForCourse(course).filter((event) => !picked.includes(draftKey(course, event.stroke, event.distanceM)));

  function emit(
    nextPicked: string[],
    nextTimes: Record<string, TimeParts>,
    nextSplits: Record<string, TimeParts>,
    nextDates = dates,
  ) {
    const next: SeedRecord[] = [];
    for (const key of nextPicked) {
      const parsed = parseDraftKey(key);
      if (!parsed || !isOfficialEvent(parsed.stroke, parsed.distanceM, parsed.course)) continue;
      const parts = nextTimes[key];
      if (!parts || isEmptyParts(parts)) continue;
      const clock = normalizeParts(parts);
      next.push({
        ...parsed,
        ...clock,
        date: nextDates[key] || "",
        splits: splitsFor(key, parsed.distanceM, nextSplits),
      });
    }
    onChange(next);
  }

  function addEvent() {
    const [stroke, raw] = choice.split(":");
    const distanceM = Number(raw);
    if (!STROKES.includes(stroke as Stroke) || !Number.isFinite(distanceM)) return;
    const key = draftKey(course, stroke as Stroke, distanceM);
    if (picked.includes(key) || !isOfficialEvent(stroke as Stroke, distanceM, course)) return;
    const nextPicked = [...picked, key];
    setPicked(nextPicked);
    setChoice("");
    emit(nextPicked, times, splitTimes);
  }

  function removeEvent(key: string) {
    const parsed = parseDraftKey(key);
    const nextPicked = picked.filter((item) => item !== key);
    const nextTimes = { ...times };
    const nextSplits = { ...splitTimes };
    delete nextTimes[key];
    const nextDates = { ...dates };
    delete nextDates[key];
    for (const atM of seedSplitMarks(parsed?.distanceM ?? 0)) delete nextSplits[splitKey(key, atM)];
    setPicked(nextPicked);
    setTimes(nextTimes);
    setSplitTimes(nextSplits);
    setDates(nextDates);
    emit(nextPicked, nextTimes, nextSplits, nextDates);
  }

  function setTime(key: string, parts: TimeParts) {
    const nextTimes = { ...times, [key]: parts };
    setTimes(nextTimes);
    emit(picked, nextTimes, splitTimes);
  }

  function setSplit(key: string, atM: number, parts: TimeParts) {
    const nextSplits = { ...splitTimes, [splitKey(key, atM)]: parts };
    setSplitTimes(nextSplits);
    emit(picked, times, nextSplits);
  }

  function setDate(key: string, date: string) {
    const nextDates = { ...dates, [key]: date };
    setDates(nextDates);
    emit(picked, times, splitTimes, nextDates);
  }

  const groups = (["scm", "lcm"] as const)
    .map((item) => ({
      course: item,
      rows: picked
        .map((key) => ({ key, parsed: parseDraftKey(key) }))
        .filter((row): row is { key: string; parsed: NonNullable<ReturnType<typeof parseDraftKey>> } => {
          return Boolean(row.parsed && row.parsed.course === item);
        })
        .sort((a, b) => a.parsed.distanceM - b.parsed.distanceM || a.parsed.stroke.localeCompare(b.parsed.stroke)),
    }))
    .filter((group) => group.rows.length);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm">
          {t("Piscina")}
          <select className="field mt-1.5" value={course} onChange={(event) => setCourse(event.target.value as PoolCourse)}>
            <option value="scm">{COURSE_LABEL.scm}</option>
            <option value="lcm">{COURSE_LABEL.lcm}</option>
          </select>
        </label>
        <label className="block text-sm">
          {t("Prova")}
          <select className="field mt-1.5" value={choice} onChange={(event) => setChoice(event.target.value)}>
            <option value="">{available.length ? t("Escolher prova") : t("Todas as desta piscina estão na lista")}</option>
            {STROKES.map((stroke) => {
              const options = available.filter((event) => event.stroke === stroke);
              if (!options.length) return null;
              return (
                <optgroup key={stroke} label={STROKE_LABEL[stroke]}>
                  {options.map((event) => (
                    <option key={eventKey(event.stroke, event.distanceM)} value={eventKey(event.stroke, event.distanceM)}>
                      {formatEvent(event.distanceM, event.stroke)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <button type="button" disabled={!choice} onClick={addEvent} className="btn-ghost h-11 w-full sm:w-auto">
          {t("Adicionar")}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-mute">{t("Adiciona só as provas em que já tens marca.")}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.course} className="space-y-2">
              <p className="text-xs font-semibold text-mute">{t("Piscina de {course}", { course: COURSE_LABEL[group.course] })}</p>
              {group.rows.map(({ key, parsed }) => {
                const marks = seedSplitMarks(parsed.distanceM);
                return (
                  <article key={key} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{formatEvent(parsed.distanceM, parsed.stroke)}</p>
                      <button type="button" onClick={() => removeEvent(key)} className="text-xs text-mute hover:text-coral">
                        {t("Tirar")}
                      </button>
                    </div>
                    <label className="mt-3 block text-sm text-mute">
                      {t("Data")}
                      <input
                        type="date"
                        className="field mt-1.5"
                        value={dates[key] ?? ""}
                        onChange={(event) => setDate(key, event.target.value)}
                      />
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-mute">{t("Final")}</p>
                      <ClockField value={times[key] ?? EMPTY_PARTS} onChange={(parts) => setTime(key, parts)} />
                    </div>
                    {marks.length ? (
                      <ul className="mt-3 space-y-2 border-t border-line pt-3">
                        {marks.map((atM) => (
                          <li key={atM} className="flex items-center justify-between gap-3">
                            <p className="text-sm text-mute">{atM} m</p>
                            <ClockField
                              value={splitTimes[splitKey(key, atM)] ?? EMPTY_PARTS}
                              onChange={(parts) => setSplit(key, atM, parts)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
