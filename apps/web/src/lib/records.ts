import { toCentiseconds } from "./swim-time";
import type { Competition, MeetEntry, MeetResult, PersonalRecord, SeedRecord } from "./types";

export function personalRecords(
  competitions: Competition[],
  entries: MeetEntry[],
  results: MeetResult[],
  athleteId?: string,
  seeds: SeedRecord[] = [],
): PersonalRecord[] {
  const byEvent = new Map<string, PersonalRecord>();
  if (athleteId) {
    for (const seed of seeds) {
      const cs = toCentiseconds(seed.mm, seed.ss, seed.cc);
      if (!cs) continue;
      byEvent.set(`${athleteId}:${seed.course}:${seed.stroke}:${seed.distanceM}`, {
        athleteId,
        stroke: seed.stroke,
        distanceM: seed.distanceM,
        course: seed.course,
        mm: seed.mm,
        ss: seed.ss,
        cc: seed.cc,
        competitionId: "",
        resultId: "",
        date: seed.date,
        source: "seed",
        splits: seed.splits ?? [],
      });
    }
  }
  for (const result of results) {
    const entry = entries.find((item) => item.id === result.entryId);
    if (!entry) continue;
    if (athleteId && entry.athleteId !== athleteId) continue;
    const competition = competitions.find((item) => item.id === entry.competitionId);
    if (!competition) continue;
    const cs = toCentiseconds(result.mm, result.ss, result.cc);
    if (!cs) continue;
    const key = `${entry.athleteId}:${competition.course}:${entry.stroke}:${entry.distanceM}`;
    const current = byEvent.get(key);
    if (current && toCentiseconds(current.mm, current.ss, current.cc) <= cs) continue;
    byEvent.set(key, {
      athleteId: entry.athleteId,
      stroke: entry.stroke,
      distanceM: entry.distanceM,
      course: competition.course,
      mm: result.mm,
      ss: result.ss,
      cc: result.cc,
      competitionId: competition.id,
      resultId: result.id,
      date: competition.date,
      source: "meet",
    });
  }
  return [...byEvent.values()].sort((a, b) => a.distanceM - b.distanceM || a.stroke.localeCompare(b.stroke));
}

export function isNewRecord(
  records: PersonalRecord[],
  athleteId: string,
  course: Competition["course"],
  stroke: MeetEntry["stroke"],
  distanceM: number,
  resultId: string,
): boolean {
  return records.some(
    (record) =>
      record.athleteId === athleteId &&
      record.course === course &&
      record.stroke === stroke &&
      record.distanceM === distanceM &&
      record.resultId === resultId,
  );
}

export function previousResultForEvent(
  competitions: Competition[],
  entries: MeetEntry[],
  results: MeetResult[],
  entry: MeetEntry,
  excludeResultId?: string,
): { result: MeetResult; competition: Competition } | null {
  const competition = competitions.find((item) => item.id === entry.competitionId);
  if (!competition) return null;
  const matches = entries
    .filter(
      (item) =>
        item.athleteId === entry.athleteId &&
        item.stroke === entry.stroke &&
        item.distanceM === entry.distanceM &&
        competitions.find((meet) => meet.id === item.competitionId)?.course === competition.course,
    )
    .map((item) => {
      const meet = competitions.find((current) => current.id === item.competitionId);
      const result = results.find((current) => current.entryId === item.id && current.id !== excludeResultId);
      return meet && result ? { result, competition: meet } : null;
    })
    .filter((item): item is { result: MeetResult; competition: Competition } => Boolean(item))
    .sort((a, b) => b.competition.date.localeCompare(a.competition.date) || b.result.recordedAt.localeCompare(a.result.recordedAt));
  return matches.find((item) => item.result.entryId !== entry.id) ?? matches[0] ?? null;
}
