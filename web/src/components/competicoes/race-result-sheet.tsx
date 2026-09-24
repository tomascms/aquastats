"use client";

import { useEffect, useMemo, useState } from "react";
import { ClockField } from "@/components/ui/clock-field";
import { eachIsoDay } from "@/lib/dates";
import { COURSE_LABEL, STROKE_LABEL, formatDatePt, formatEvent } from "@/lib/labels";
import { meetEnd } from "@/lib/rankings";
import {
  applyCalculatedLap,
  emptyLaps,
  formatRaceClock,
  hydrateLaps,
  isDetailedRace,
  markMeta,
  officialFromLaps,
  poolLength,
  raceMarkRows,
  raceMarks,
  roundHundredths,
  scKeyForOffset,
  setMarkTime,
  timeKeyForOffset,
  writeCalculatedRates,
} from "@/lib/race";
import { actions } from "@/lib/store";
import { EMPTY_PARTS, hasClockTime } from "@/lib/swim-time";
import type { Competition, DayPart, MeetEntry, MeetResult, RaceLap, RaceSession, TimeParts } from "@/lib/types";

function clockToSeconds(parts: TimeParts): number {
  const committed = {
    mm: parts.mm ? parts.mm.padStart(2, "0") : "",
    ss: parts.ss ? parts.ss.padStart(2, "0") : "",
    cc: parts.cc ? parts.cc.padEnd(2, "0") : "",
  };
  const minutes = Number.parseInt(committed.mm, 10) || 0;
  const seconds = Number.parseInt(committed.ss, 10) || 0;
  const hundredths = Number.parseInt(committed.cc, 10) || 0;
  if (!minutes && !seconds && !hundredths) return 0;
  return roundHundredths(minutes * 60 + seconds + hundredths / 100);
}

function toClock(sec: number): TimeParts {
  if (!sec) return { ...EMPTY_PARTS };
  const rounded = Math.round(sec * 100);
  const minutes = Math.floor(rounded / 6000);
  const rest = rounded % 6000;
  return {
    mm: minutes ? String(minutes).padStart(2, "0") : "",
    ss: String(Math.floor(rest / 100)).padStart(2, "0"),
    cc: String(rest % 100).padStart(2, "0"),
  };
}

function focusNext(from: HTMLInputElement) {
  const all = [...document.querySelectorAll<HTMLInputElement>("[data-race-input]")];
  const index = all.indexOf(from);
  const next = all[index + 1];
  if (!next) return;
  next.focus();
  next.select();
}

function Count({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (raw: string) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return <span className="font-mono text-xs text-mist">{value || "—"}</span>;
  }
  return (
    <input
      data-race-input
      inputMode="decimal"
      className="h-8 w-12 rounded-md border border-line bg-white px-1 text-center font-mono text-xs outline-none focus:border-aqua"
      value={value ? String(value) : ""}
      onChange={(event) => onChange?.(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        focusNext(event.currentTarget);
      }}
    />
  );
}

function CalcClock({ sec }: { sec: number }) {
  return <span className="font-mono text-xs text-aqua">{sec > 0 ? formatRaceClock(sec) : "—"}</span>;
}

function num(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clocksFromSession(
  distanceM: number,
  course: Competition["course"],
  laps: RaceLap[],
  detailed: boolean,
  stroke: MeetEntry["stroke"],
): Record<number, TimeParts> {
  const rows = raceMarkRows(laps, distanceM, course, stroke);
  const next: Record<number, TimeParts> = {};
  for (const row of rows) {
    next[row.atM] = toClock(detailed ? row.tempo : row.sector);
  }
  return next;
}

function breakClocksFromLaps(
  laps: RaceLap[],
  distanceM: number,
  course: Competition["course"],
  stroke: MeetEntry["stroke"],
): Record<number, TimeParts> {
  const next: Record<number, TimeParts> = {};
  for (const row of raceMarkRows(laps, distanceM, course, stroke)) {
    if (row.showUw) next[row.atM] = toClock(row.breakS);
  }
  return next;
}

function withMarkTime(lap: RaceLap, atM: number, course: Competition["course"], distanceM: number, sec: number): RaceLap {
  const { offset } = markMeta(atM, course, distanceM);
  return { ...lap, [timeKeyForOffset(offset)]: sec };
}

function lapsFromClocks(
  distanceM: number,
  course: Competition["course"],
  clocks: Record<number, TimeParts>,
  counts: RaceLap[],
  officialS: number,
  stroke: MeetEntry["stroke"],
): RaceLap[] {
  const detailed = isDetailedRace(distanceM);
  const marks = raceMarks(distanceM, course);
  let blank = emptyLaps(distanceM, course).map((lap, index) => counts[index] ?? lap);
  if (detailed) {
    for (const atM of marks) {
      const { lapIndex } = markMeta(atM, course, distanceM);
      if (!blank[lapIndex]) continue;
      blank = blank.map((item, index) =>
        index === lapIndex ? withMarkTime(item, atM, course, distanceM, clockToSeconds(clocks[atM] ?? EMPTY_PARTS)) : item,
      );
    }
    if (officialS) blank = setMarkTime(blank, distanceM, course, distanceM, officialS);
    return writeCalculatedRates(blank.map(applyCalculatedLap), distanceM, course, stroke);
  }
  const sectors = marks.map((atM) => clockToSeconds(clocks[atM] ?? EMPTY_PARTS));
  const last = marks.length - 1;
  const rest = sectors.slice(0, last).reduce((sum, value) => sum + value, 0);
  if (officialS && rest > 0) {
    sectors[last] = Math.max(0, roundHundredths(officialS - rest));
  }
  let cumulative = 0;
  for (const [index, atM] of marks.entries()) {
    const { lapIndex } = markMeta(atM, course, distanceM);
    if (!blank[lapIndex]) continue;
    cumulative = roundHundredths(cumulative + (sectors[index] ?? 0));
    const next = cumulative;
    blank = blank.map((item, i) => (i === lapIndex ? { ...item, sec50: next } : item));
  }
  return writeCalculatedRates(blank.map(applyCalculatedLap), distanceM, course, stroke);
}

function applyBreaks(
  laps: RaceLap[],
  breakClocks: Record<number, TimeParts>,
  distanceM: number,
  course: Competition["course"],
  stroke: MeetEntry["stroke"],
): RaceLap[] {
  let next = laps;
  for (const row of raceMarkRows(laps, distanceM, course, stroke)) {
    if (!row.showUw) continue;
    const sec = clockToSeconds(breakClocks[row.atM] ?? EMPTY_PARTS);
    next = next.map((lap, index) => (index === row.lapIndex ? { ...lap, uw: sec } : lap));
  }
  return next;
}

function resultSeconds(result?: MeetResult): number {
  if (!result || !hasClockTime(result.mm, result.ss, result.cc)) return 0;
  return roundHundredths(result.mm * 60 + result.ss + result.cc / 100);
}

function withOfficialClocks(
  clocks: Record<number, TimeParts>,
  distanceM: number,
  course: Competition["course"],
  officialS: number,
  detailed: boolean,
): Record<number, TimeParts> {
  if (!officialS || !detailed) return clocks;
  const finish = raceMarks(distanceM, course).at(-1);
  if (!finish) return clocks;
  return { ...clocks, [finish]: toClock(officialS) };
}

export function RaceResultSheet({
  meet,
  entry,
  athleteName,
  existing,
  result,
  mode,
}: {
  meet: Competition;
  entry: MeetEntry;
  athleteName: string;
  existing?: RaceSession;
  result?: MeetResult;
  mode: "view" | "edit";
}) {
  const days = useMemo(() => eachIsoDay(meet.date, meetEnd(meet)), [meet.date, meet.endDate]);
  const detailed = isDetailedRace(entry.distanceM);
  const course = meet.course;
  const seedOfficial = existing?.officialTimeS || resultSeconds(result);
  const [raceDate, setRaceDate] = useState(existing?.date && days.includes(existing.date) ? existing.date : meet.date);
  const [dayPart] = useState<DayPart>(existing?.dayPart ?? "am");
  const [reaction, setReaction] = useState<TimeParts>(() => toClock(existing?.reactionS ?? 0));
  const [flight, setFlight] = useState<TimeParts>(() => toClock(existing?.flightS ?? 0));
  const [laps, setLaps] = useState<RaceLap[]>(() => hydrateLaps(existing?.laps, entry.distanceM, course));
  const [clocks, setClocks] = useState<Record<number, TimeParts>>(() =>
    withOfficialClocks(
      clocksFromSession(entry.distanceM, course, hydrateLaps(existing?.laps, entry.distanceM, course), detailed, entry.stroke),
      entry.distanceM,
      course,
      seedOfficial,
      detailed,
    ),
  );
  const [breakClocks, setBreakClocks] = useState<Record<number, TimeParts>>(() =>
    breakClocksFromLaps(hydrateLaps(existing?.laps, entry.distanceM, course), entry.distanceM, course, entry.stroke),
  );
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(existing?.id ?? crypto.randomUUID());
  const [manualOfficial, setManualOfficial] = useState<TimeParts>(() => (seedOfficial ? toClock(seedOfficial) : { ...EMPTY_PARTS }));
  const readOnly = mode === "view";

  useEffect(() => {
    const blank = hydrateLaps(existing?.laps, entry.distanceM, course);
    const official = existing?.officialTimeS || resultSeconds(result);
    setLaps(blank);
    setClocks(
      withOfficialClocks(
        clocksFromSession(entry.distanceM, course, blank, isDetailedRace(entry.distanceM), entry.stroke),
        entry.distanceM,
        course,
        official,
        isDetailedRace(entry.distanceM),
      ),
    );
    setBreakClocks(breakClocksFromLaps(blank, entry.distanceM, course, entry.stroke));
    setReaction(toClock(existing?.reactionS ?? 0));
    setFlight(toClock(existing?.flightS ?? 0));
    setRaceDate(existing?.date && days.includes(existing.date) ? existing.date : meet.date);
    setSaved("");
    setError("");
    setSessionId(existing?.id ?? crypto.randomUUID());
    setManualOfficial(official ? toClock(official) : { ...EMPTY_PARTS });
  }, [course, days, entry.distanceM, entry.id, entry.stroke, existing, meet.date, result]);

  const declaredOfficial = seedOfficial || clockToSeconds(manualOfficial);
  const builtLaps = useMemo(
    () =>
      applyBreaks(
        lapsFromClocks(entry.distanceM, course, clocks, laps, declaredOfficial, entry.stroke),
        breakClocks,
        entry.distanceM,
        course,
        entry.stroke,
      ),
    [breakClocks, clocks, course, declaredOfficial, entry.distanceM, entry.stroke, laps],
  );
  const rows = useMemo(
    () => raceMarkRows(builtLaps, entry.distanceM, course, entry.stroke),
    [builtLaps, course, entry.distanceM, entry.stroke],
  );
  const calculatedFinal = officialFromLaps(builtLaps, entry.distanceM, course);
  const officialTimeS = declaredOfficial || calculatedFinal;
  const finishLocked = officialTimeS > 0;
  const draft: RaceSession = useMemo(
    () => ({
      id: sessionId,
      athleteId: entry.athleteId,
      competitionId: meet.id,
      entryId: entry.id,
      date: raceDate,
      tournament: meet.title,
      course: meet.course,
      distanceM: entry.distanceM,
      stroke: entry.stroke,
      dayPart,
      reactionS: clockToSeconds(reaction),
      flightS: clockToSeconds(flight),
      officialTimeS,
      laps: builtLaps,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }),
    [builtLaps, dayPart, entry, existing, flight, meet, officialTimeS, raceDate, reaction, sessionId],
  );

  function patchCount(atM: number, kind: "uwKicks" | "uwd" | "sc", value: string) {
    const { lapIndex, offset } = markMeta(atM, course, entry.distanceM);
    setLaps((current) =>
      current.map((lap, index) => {
        if (index !== lapIndex) return lap;
        if (kind === "uwKicks") return { ...lap, uwKicks: num(value) };
        if (kind === "uwd") return { ...lap, uwd: num(value) };
        return { ...lap, [scKeyForOffset(offset)]: num(value) };
      }),
    );
  }

  function patchClock(atM: number, parts: TimeParts) {
    setClocks((current) => ({ ...current, [atM]: parts }));
  }

  async function save() {
    if (!officialTimeS) {
      setError("O tempo final é a soma dos tempos — preenche as passagens até à meta.");
      return;
    }
    setError("");
    await actions.saveCompetitionAnalysis(entry.id, draft);
    setSaved("Guardado");
    window.setTimeout(() => setSaved(""), 1800);
  }

  const th = "border border-line bg-ink-2 px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-mute";
  const td = "border border-line px-1 py-1.5 text-center align-middle";
  const officialParts = officialTimeS ? toClock(officialTimeS) : manualOfficial;
  const displayFinal = officialTimeS;
  const finalLocked = seedOfficial > 0;
  const pool = poolLength(course);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sand">{athleteName}</p>
          <h2 className="text-xl font-semibold tracking-tight">{formatEvent(entry.distanceM, entry.stroke)}</h2>
          <p className="text-xs text-mute">{COURSE_LABEL[meet.course]}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {!readOnly && days.length > 1 ? (
            <label className="text-[10px] font-semibold uppercase tracking-wide text-mute">
              Date
              <select className="field mt-1" value={raceDate} onChange={(event) => setRaceDate(event.target.value)}>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {formatDatePt(day)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-mute">{formatDatePt(raceDate)}</p>
          )}
          <label className="text-[10px] font-semibold uppercase tracking-wide text-mute">
            Final
            <div className="mt-1">
              {readOnly ? (
                <p className="font-mono text-lg text-aqua">{displayFinal ? formatRaceClock(displayFinal) : "—"}</p>
              ) : (
                <ClockField
                  mark="race"
                  compact
                  startOnSeconds={entry.distanceM <= 50}
                  value={officialParts}
                  onChange={(parts) => {
                    setManualOfficial(parts);
                    if (detailed) {
                      const finish = raceMarks(entry.distanceM, course).at(-1);
                      if (finish) setClocks((current) => ({ ...current, [finish]: parts }));
                    }
                  }}
                  readOnly={finalLocked}
                />
              )}
            </div>
          </label>
        </div>
      </div>

      <p className="text-[11px] text-mute">
        Piscina de {pool} m
        {entry.distanceM > pool ? ` · viragem a cada ${pool} m` : " · sem viragem"}.
        {detailed
          ? " Tempo = passagem. 15 a 25… = nado, calculado. SR a partir das braçadas e do nado (crol/costas: ciclo = 2 braçadas)."
          : " Parciais a cada 50 m. O último parcial fecha o tempo final."}
      </p>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead>
            <tr>
              <th className={th} />
              <th className={th}>React</th>
              <th className={th}>Fly</th>
              <th className={th}>UWk</th>
              <th className={th}>UWd</th>
              <th className={th}>Break</th>
              <th className={th}>Tempo</th>
              <th className={th}>Nado</th>
              <th className={th}>SC</th>
              <th className={th}>SR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const lockFinish = finishLocked && row.isFinish;
              const tempoEditable = !readOnly && detailed && !lockFinish;
              const sectorEditable = !readOnly && !detailed && !lockFinish;
              return (
                <tr key={row.atM} className={row.isTurn ? "bg-sand/10" : "bg-white"}>
                  <td className={`${td} whitespace-nowrap font-semibold text-aqua`}>
                    <span>{row.atM}m</span>
                    {row.isTurn ? <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-sand">viragem</span> : null}
                    {row.isFinish ? <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-mute">meta</span> : null}
                    {entry.stroke === "im" ? (
                      <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-mute">
                        {STROKE_LABEL[row.stroke]}
                      </span>
                    ) : null}
                  </td>
                  <td className={td}>
                    {row.showStart ? (
                      readOnly ? (
                        <CalcClock sec={clockToSeconds(reaction)} />
                      ) : (
                        <ClockField mode="split" mark="race" compact value={reaction} onChange={setReaction} />
                      )
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {row.showStart ? (
                      readOnly ? (
                        <CalcClock sec={clockToSeconds(flight)} />
                      ) : (
                        <ClockField mode="split" mark="race" compact value={flight} onChange={setFlight} />
                      )
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {row.showUw ? (
                      <Count readOnly={readOnly} value={row.uwKicks} onChange={(value) => patchCount(row.atM, "uwKicks", value)} />
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {row.showUw ? (
                      <Count readOnly={readOnly} value={row.uwd} onChange={(value) => patchCount(row.atM, "uwd", value)} />
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {row.showUw ? (
                      readOnly ? (
                        <CalcClock sec={clockToSeconds(breakClocks[row.atM] ?? EMPTY_PARTS)} />
                      ) : (
                        <ClockField
                          mode="split"
                          mark="race"
                          compact
                          value={breakClocks[row.atM] ?? EMPTY_PARTS}
                          onChange={(parts) => setBreakClocks((current) => ({ ...current, [row.atM]: parts }))}
                        />
                      )
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {tempoEditable ? (
                      <ClockField
                        mark="race"
                        compact
                        value={clocks[row.atM] ?? EMPTY_PARTS}
                        onChange={(parts) => patchClock(row.atM, parts)}
                      />
                    ) : (
                      <CalcClock sec={row.tempo} />
                    )}
                  </td>
                  <td className={td}>
                    {row.showNado ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-mute">
                          {row.sectorLabel}
                        </span>
                        {sectorEditable ? (
                          <ClockField
                            mode="split"
                            mark="race"
                            compact
                            value={clocks[row.atM] ?? EMPTY_PARTS}
                            onChange={(parts) => patchClock(row.atM, parts)}
                          />
                        ) : (
                          <CalcClock sec={row.sector} />
                        )}
                      </div>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {row.showScSr ? (
                      <Count readOnly={readOnly} value={row.sc} onChange={(value) => patchCount(row.atM, "sc", value)} />
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {row.showScSr ? (
                      <span className="font-mono text-xs text-aqua">{row.sr ? row.sr.toFixed(1) : "—"}</span>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {error ? <p className="text-sm text-coral">{error}</p> : <span />}
          <div className="flex items-center gap-2">
            {saved ? <span className="text-xs text-aqua">{saved}</span> : null}
            {existing ? (
              <button
                type="button"
                className="h-11 rounded-2xl border border-coral/40 px-4 text-sm font-semibold text-coral"
                onClick={() => {
                  if (!window.confirm("Apagar este resultado?")) return;
                  void actions.deleteCompetitionResult(entry.id, existing.id).then(() => {
                    const blank = emptyLaps(entry.distanceM, course);
                    setLaps(blank);
                    setClocks(
                      withOfficialClocks(
                        clocksFromSession(entry.distanceM, course, blank, detailed, entry.stroke),
                        entry.distanceM,
                        course,
                        resultSeconds(result),
                        detailed,
                      ),
                    );
                    setBreakClocks(breakClocksFromLaps(blank, entry.distanceM, course, entry.stroke));
                    setManualOfficial(resultSeconds(result) ? toClock(resultSeconds(result)) : { ...EMPTY_PARTS });
                    setReaction({ ...EMPTY_PARTS });
                    setFlight({ ...EMPTY_PARTS });
                    setSaved("Apagado");
                    window.setTimeout(() => setSaved(""), 1800);
                  });
                }}
              >
                Apagar
              </button>
            ) : null}
            <button type="button" onClick={() => void save()} className="h-11 rounded-2xl bg-sand px-5 text-sm font-medium text-ink">
              Guardar resultado
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
