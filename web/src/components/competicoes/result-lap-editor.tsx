"use client";

import { RaceResultSheet } from "@/components/competicoes/race-result-sheet";
import type { Competition, MeetEntry, MeetResult, RaceSession } from "@/lib/types";

export function ResultLapEditor({
  meet,
  entry,
  athleteName,
  existing,
  result,
}: {
  meet: Competition;
  entry: MeetEntry;
  athleteName: string;
  existing?: RaceSession;
  result?: MeetResult;
}) {
  return (
    <RaceResultSheet mode="edit" meet={meet} entry={entry} athleteName={athleteName} existing={existing} result={result} />
  );
}
