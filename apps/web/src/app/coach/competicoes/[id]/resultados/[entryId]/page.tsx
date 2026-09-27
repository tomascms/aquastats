"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RaceInsights } from "@/components/competicoes/race-insights";
import { RaceResultSheet } from "@/components/competicoes/race-result-sheet";
import { COURSE_LABEL, formatDatePt, formatEvent } from "@/lib/labels";
import { sessionForEntry } from "@/lib/race";
import { useAppState } from "@/lib/store";
import { formatTime, hasClockTime } from "@/lib/swim-time";
import { useT } from "@/i18n/provider";

export default function ResultViewPage() {
  const t = useT();
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
        {t("Resultado não encontrado.")}
        <Link href={meet ? `/coach/competicoes/${meet.id}` : "/coach/competicoes"} className="mt-3 block text-aqua">
          {t("Voltar")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href={`/coach/team/${athlete.id}`} className="text-sm text-mute">
        ← {athlete.name}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-sand">{meet.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{formatEvent(entry.distanceM, entry.stroke)}</h1>
          <p className="text-sm text-mute">
            {formatDatePt(existing?.date || meet.date)} · {COURSE_LABEL[meet.course]}
            {result && hasClockTime(result.mm, result.ss, result.cc) ? ` · ${formatTime(result.mm, result.ss, result.cc)}` : ""}
          </p>
        </div>
        <Link
          href={`/coach/competicoes/${meet.id}/resultados/${entry.id}/edit`}
          className="flex h-12 items-center justify-center rounded-2xl border border-line px-5 text-sm font-semibold"
        >
          {t("Adicionar informação")}
        </Link>
      </div>
      <RaceResultSheet
        mode="view"
        meet={meet}
        entry={entry}
        athleteName={athlete.name}
        existing={existing}
        result={result}
      />
      {existing ? <RaceInsights session={existing} others={raceSessions.filter((item) => item.athleteId === athlete.id)} /> : null}
    </div>
  );
}
