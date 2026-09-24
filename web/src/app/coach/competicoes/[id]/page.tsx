"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconMinus, IconPlus } from "@/components/ui/icons";
import { COURSE_LABEL, formatDateRange, formatEvent } from "@/lib/labels";
import { meetEnd } from "@/lib/rankings";
import { eventsForCourse, hasEntry } from "@/lib/meets";
import { actions, useAppState } from "@/lib/store";
import type { PoolCourse } from "@/lib/types";

export default function ConvocatoriaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { athletes, competitions, meetEntries } = useAppState();
  const meet = competitions.find((item) => item.id === params.id);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(meet?.title ?? "");
  const [date, setDate] = useState(meet?.date ?? "");
  const [endDate, setEndDate] = useState(meet ? meetEnd(meet) : "");
  const [course, setCourse] = useState<PoolCourse>(meet?.course ?? "scm");

  useEffect(() => {
    if (!meet) return;
    setTitle(meet.title);
    setDate(meet.date);
    setEndDate(meetEnd(meet));
    setCourse(meet.course);
  }, [meet?.id, meet?.title, meet?.date, meet?.course, meet?.endDate]);

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

  const assigned = new Set(meet.athleteIds ?? []);
  const visible = athletes.filter((athlete) => {
    if (athlete.active === false && !assigned.has(athlete.id)) return false;
    if (!query.trim()) return true;
    return athlete.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-4">
      <Link href="/coach/competicoes" className="text-sm text-mute">
        ← Competições
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sand">Convocatória</p>
          <h1 className="text-2xl font-semibold tracking-tight">{meet.title}</h1>
          <p className="text-sm text-mute">
            {formatDateRange(meet.date, meetEnd(meet))} · {COURSE_LABEL[meet.course]}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-10" onClick={() => setEditing((open) => !open)}>
            {editing ? "Fechar" : "Editar"}
          </button>
          <button
            type="button"
            className="btn-ghost h-10 text-coral"
            onClick={() => {
              if (!window.confirm("Apagar esta competição, convocatória e resultados?")) return;
              void actions.deleteCompetition(meet.id).then(() => router.push("/coach/competicoes"));
            }}
          >
            Apagar
          </button>
        </div>
      </div>

      {editing ? (
        <form
          className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const start = date;
            const end = endDate && endDate >= date ? endDate : date;
            await actions.updateCompetition(meet.id, { title, date: start, endDate: end, course, venue: "" });
            setEditing(false);
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-mute">
            De
            <input
              type="date"
              className="field mt-1"
              value={date}
              onChange={(event) => {
                const next = event.target.value;
                setDate(next);
                if (endDate < next) setEndDate(next);
              }}
              required
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-mute">
            Até
            <input
              type="date"
              className="field mt-1"
              value={endDate}
              min={date}
              onChange={(event) => setEndDate(event.target.value < date ? date : event.target.value)}
              required
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-mute">
            Título
            <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Piscina</p>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-ink p-1">
              {(["scm", "lcm"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCourse(item)}
                  className={`rounded-xl py-2 text-sm font-semibold ${course === item ? "bg-sand text-ink" : "text-mute"}`}
                >
                  {COURSE_LABEL[item]}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="h-12 rounded-2xl bg-sand text-sm font-medium text-ink sm:col-span-2">
            Guardar alterações
          </button>
        </form>
      ) : null}

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filtrar atletas"
        className="w-full rounded-2xl border border-line bg-panel px-3 py-3 text-sm outline-none"
      />

      <ul className="space-y-2">
        {visible.map((athlete) => {
          const inMeet = meet.athleteIds.includes(athlete.id);
          const provas = meetEntries.filter((entry) => entry.competitionId === meet.id && entry.athleteId === athlete.id);
          return (
            <li key={athlete.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-semibold ${inMeet ? "text-mist" : "text-mute"}`}>{athlete.name}</p>
                  <p className="text-[11px] text-mute">
                    {inMeet ? `${provas.length} provas` : "Não convocado"}
                    {provas.length ? ` · ${provas.map((entry) => formatEvent(entry.distanceM, entry.stroke)).join(", ")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => actions.toggleMeetAthlete(meet.id, athlete.id)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    inMeet ? "bg-coral/15 text-coral" : "bg-aqua/15 text-aqua"
                  }`}
                  aria-label={inMeet ? `Tirar ${athlete.name}` : `Convocar ${athlete.name}`}
                >
                  {inMeet ? <IconMinus className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
                </button>
              </div>
              {inMeet && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {eventsForCourse(meet.course).map((event) => {
                    const on = hasEntry(meetEntries, meet.id, athlete.id, event.stroke, event.distanceM);
                    return (
                      <button
                        key={`${event.stroke}-${event.distanceM}`}
                        type="button"
                        onClick={() => actions.toggleMeetEntry(meet.id, athlete.id, event.stroke, event.distanceM)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          on ? "bg-sand text-ink" : "border border-line text-mute"
                        }`}
                      >
                        {formatEvent(event.distanceM, event.stroke)}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Link
        href={`/coach/competicoes/${meet.id}/resultados`}
        className="flex h-12 items-center justify-center rounded-2xl bg-sand text-sm font-medium text-ink"
      >
        Meter resultados
      </Link>
    </div>
  );
}
