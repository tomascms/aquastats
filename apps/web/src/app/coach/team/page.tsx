"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ageFromDob, formatDatePt, initials, strokeLabel } from "@/lib/labels";
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

  const roster = useMemo(
    () =>
      activeAthletes.map((athlete) => {
        const mine = workouts.filter((workout) => workout.athleteIds.includes(athlete.id));
        const last = mine.reduce<string>((max, workout) => (workout.date > max ? workout.date : max), "");
        const results = meetResults.filter((result) =>
          meetEntries.some((entry) => entry.id === result.entryId && entry.athleteId === athlete.id),
        ).length;
        return {
          athlete,
          workouts: mine.length,
          volume: athleteVolumeM(workouts, athlete.id),
          results,
          last,
          age: ageFromDob(athlete.dateOfBirth),
        };
      }),
    [activeAthletes, meetEntries, meetResults, workouts],
  );

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{teamName || "Equipa"}</h1>
          <p className="mt-1 text-sm text-mute">
            {activeAthletes.length === 1 ? "1 atleta" : `${activeAthletes.length} atletas`} no plantel.
          </p>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-aqua px-5 py-4 text-white">
        <div>
          <p className="text-sm text-white/70">Código da equipa</p>
          <p className="font-display text-3xl font-bold tracking-[0.12em]">{joinCode || "—"}</p>
        </div>
        <p className="min-w-0 flex-1 text-sm text-white/75">
          Os atletas entram com este código ao criar conta, ou pelo link de convite.
        </p>
        <button
          type="button"
          disabled={!inviteUrl}
          onClick={() => void copyInvite()}
          className="min-h-10 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-aqua transition-colors hover:bg-aqua-soft disabled:opacity-60"
        >
          {copied ? "Link copiado" : "Copiar link de convite"}
        </button>
      </section>

      {roster.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold">Ainda ninguém entrou</p>
          <p className="mt-1 text-sm text-mute">Copia o link de convite e envia aos atletas.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-2 text-xs font-semibold text-mute">
              <tr>
                <th className="px-5 py-3">Atleta</th>
                <th className="hidden px-3 py-3 md:table-cell">Estilo</th>
                <th className="hidden px-3 py-3 text-right md:table-cell">Idade</th>
                <th className="px-3 py-3 text-right">Treinos</th>
                <th className="hidden px-3 py-3 text-right sm:table-cell">Volume</th>
                <th className="hidden px-3 py-3 text-right lg:table-cell">Resultados</th>
                <th className="hidden px-5 py-3 text-right lg:table-cell">Último treino</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((item) => (
                <tr key={item.athlete.id} className="group border-t border-line">
                  <td className="px-5 py-3">
                    <Link href={`/coach/team/${item.athlete.id}`} className="flex items-center gap-3 rounded-md">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aqua-soft font-display text-base font-bold text-aqua">
                        {initials(item.athlete.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-mist group-hover:text-pool">{item.athlete.name}</span>
                        <span className="block text-xs text-mute md:hidden">
                          {[strokeLabel(item.athlete.primaryStroke), item.age != null ? `${item.age} anos` : ""].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 text-mist md:table-cell">{strokeLabel(item.athlete.primaryStroke) || "—"}</td>
                  <td className="hidden px-3 py-3 text-right tabular md:table-cell">{item.age ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-display text-lg font-bold tabular">{item.workouts}</td>
                  <td className="hidden px-3 py-3 text-right tabular sm:table-cell">{formatMeters(item.volume)}</td>
                  <td className="hidden px-3 py-3 text-right tabular lg:table-cell">{item.results}</td>
                  <td className="hidden px-5 py-3 text-right text-mute lg:table-cell">{item.last ? formatDatePt(item.last) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
