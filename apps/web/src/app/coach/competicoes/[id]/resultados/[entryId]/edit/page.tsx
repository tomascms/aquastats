"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RaceResultSheet } from "@/components/competicoes/race-result-sheet";
import { formatEvent } from "@/lib/labels";
import { sessionForEntry } from "@/lib/race";
import { useAppState } from "@/lib/store";

export default function ResultEditPage() {
  const params = useParams<{ id: string; entryId: string }>();
  const { athletes, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const meet = competitions.find((item) => item.id === params.id);
  const entry = meetEntries.find((item) => item.id === params.entryId && item.competitionId === meet?.id);
  const athlete = athletes.find((item) => item.id === entry?.athleteId);
  const existing = meet && entry ? sessionForEntry(raceSessions, entry, meet.id) : undefined;
  const result = meetResults.find((item) => item.entryId === entry?.id);

  if (!meet || !entry || !athlete) {
    return (
      <div className="py-10 text-center text-mute">
        Resultado não encontrado.
        <Link href={meet ? `/coach/competicoes/${meet.id}/resultados` : "/coach/competicoes"} className="mt-3 block text-aqua">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href={`/coach/competicoes/${meet.id}/resultados/${entry.id}`} className="text-sm text-mute">
        ← {formatEvent(entry.distanceM, entry.stroke)}
      </Link>
      <RaceResultSheet mode="edit" meet={meet} entry={entry} athleteName={athlete.name} existing={existing} result={result} />
    </div>
  );
}
