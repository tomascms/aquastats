"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ageFromDob, initials, strokeLabel } from "@/lib/labels";
import { athleteVolumeM, formatMeters } from "@/lib/rankings";
import { useAppState } from "@/lib/store";

export default function TeamPage() {
  const { athletes, teamName, joinCode, meetResults, meetEntries, workouts } = useAppState();
  const activeAthletes = athletes.filter((athlete) => athlete.active !== false);
  const [copied, setCopied] = useState(false);
  const inviteUrl = useMemo(() => {
    if (!joinCode || typeof window === "undefined") return "";
    return `${window.location.origin}/entrar/${joinCode}`;
  }, [joinCode]);

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{teamName}</h1>
        <p className="text-sm text-mute">
          {activeAthletes.length} atletas. Envia o link de convite — eles criam conta e entram na equipa.
        </p>
      </div>

      <section className="card p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-mute">Convite da equipa</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-sm">{inviteUrl || "A carregar o código…"}</p>
          <button
            type="button"
            disabled={!inviteUrl}
            onClick={() => void copyInvite()}
            className="btn-primary shrink-0 disabled:opacity-60"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </section>

      <ul className="grid gap-2 md:grid-cols-2">
        {activeAthletes.map((athlete) => {
          const workoutsCount = workouts.filter((workout) => workout.athleteIds.includes(athlete.id)).length;
          const volume = athleteVolumeM(workouts, athlete.id);
          const resultsCount = meetResults.filter((result) =>
            meetEntries.some((entry) => entry.id === result.entryId && entry.athleteId === athlete.id),
          ).length;
          return (
            <li key={athlete.id}>
              <Link
                href={`/coach/team/${athlete.id}`}
                className="card flex items-center gap-3 px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink-2 text-sm font-medium text-aqua">
                  {initials(athlete.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{athlete.name}</p>
                  <p className="text-xs text-mute">
                    {[strokeLabel(athlete.primaryStroke), ageFromDob(athlete.dateOfBirth) != null ? `${ageFromDob(athlete.dateOfBirth)} anos` : ""]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <p className="text-[11px] text-mute">
                    {workoutsCount} treinos · {formatMeters(volume)} · {resultsCount} resultados
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {activeAthletes.length === 0 && (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm text-mute">
          Ainda ninguém entrou. Copia o link e envia aos atletas.
        </p>
      )}
    </div>
  );
}
