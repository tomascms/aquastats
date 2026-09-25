"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { COURSE_LABEL, formatDateRange, formatEvent } from "@/lib/labels";
import { meetEnd } from "@/lib/rankings";
import { analyzeRace, formatRaceClock, sessionForEntry } from "@/lib/race";
import { useAppState } from "@/lib/store";
import { formatTime, hasClockTime } from "@/lib/swim-time";

export default function ResultadosPage() {
  const params = useParams<{ id: string }>();
  const { athletes, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const meet = competitions.find((item) => item.id === params.id);
  const entries = meetEntries.filter((entry) => entry.competitionId === meet?.id);

  const grouped = useMemo(() => {
    if (!meet) return [];
    return meet.athleteIds
      .map((athleteId) => ({
        athlete: athletes.find((item) => item.id === athleteId),
        entries: entries.filter((entry) => entry.athleteId === athleteId),
      }))
      .filter((group) => group.athlete && group.entries.length);
  }, [athletes, entries, meet]);

  if (!meet) {
    return (
      <div className="py-10 text-center text-mute">
        Competição não encontrada.
        <Link href="/coach/competicoes" className="mt-3 block text-aqua">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href={`/coach/competicoes/${meet.id}`} className="text-sm text-mute">
        ← Convocatória
      </Link>
      <div>
        <p className="text-xs font-semibold text-sand">Resultados</p>
        <h1 className="text-2xl font-semibold tracking-tight">{meet.title}</h1>
        <p className="text-sm text-mute">
          {formatDateRange(meet.date, meetEnd(meet))} · {COURSE_LABEL[meet.course]}
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
          Ainda não há provas. Volta à convocatória e mete o que cada um nada.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <section key={group.athlete!.id} className="rounded-xl border border-line bg-panel p-3">
              <h2 className="font-semibold">{group.athlete!.name}</h2>
              <div className="mt-2 space-y-1">
                {group.entries.map((entry) => {
                  const result = meetResults.find((item) => item.entryId === entry.id);
                  const analysis = sessionForEntry(raceSessions, entry, meet.id);
                  const view = analysis ? analyzeRace(analysis) : null;
                  return (
                    <Link
                      key={entry.id}
                      href={`/coach/competicoes/${meet.id}/resultados/${entry.id}`}
                      className="flex w-full items-center justify-between rounded-2xl bg-ink px-3 py-2 text-left"
                    >
                      <span className="text-sm font-semibold">{formatEvent(entry.distanceM, entry.stroke)}</span>
                      <span className="font-mono text-xs text-aqua">
                        {view?.totalTime
                          ? formatRaceClock(view.totalTime)
                          : result && hasClockTime(result.mm, result.ss, result.cc)
                            ? formatTime(result.mm, result.ss, result.cc)
                            : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
