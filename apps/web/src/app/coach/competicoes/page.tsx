"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COURSE_LABEL, formatDateRange, meetTitle } from "@/lib/labels";
import { todayIso } from "@/lib/dates";
import { meetEnd } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";
import type { PoolCourse } from "@/lib/types";

export default function CompeticoesPage() {
  const router = useRouter();
  const { competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const [open, setOpen] = useState(competitions.length === 0);
  const [title, setTitle] = useState(meetTitle(todayIso()));
  const [date, setDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [course, setCourse] = useState<PoolCourse>("scm");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Competições</h1>
          <p className="text-sm text-mute">Convocatória e resultados. O painel de provas lê o que meteres aqui.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-11 rounded-2xl bg-aqua hover:bg-aqua-2 px-4 text-sm font-semibold text-white"
        >
          Nova competição
        </button>
      </header>

      {open ? (
        <form
          className="grid gap-3 rounded-xl border border-sand/30 bg-panel p-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const start = date;
            const end = endDate && endDate >= date ? endDate : date;
            const id = await actions.addCompetition({ title, date: start, endDate: end, course, venue: "" });
            router.push(`/coach/competicoes/${id}`);
          }}
        >
          <label className="text-xs font-semibold text-mute">
            De
            <input
              type="date"
              className="field mt-1"
              value={date}
              onChange={(event) => {
                const next = event.target.value;
                setDate(next);
                setTitle(meetTitle(next));
                if (endDate < next) setEndDate(next);
              }}
              required
            />
          </label>
          <label className="text-xs font-semibold text-mute">
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
          <label className="text-xs font-semibold text-mute">
            Título
            <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div>
            <p className="text-xs font-semibold text-mute">Piscina</p>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-ink p-1">
              {(["scm", "lcm"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCourse(item)}
                  className={`rounded-xl py-2 text-sm font-semibold ${course === item ? "bg-aqua text-white" : "text-mute"}`}
                >
                  {COURSE_LABEL[item]}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="h-12 rounded-2xl bg-aqua hover:bg-aqua-2 text-sm font-semibold text-white sm:col-span-2">
            Guardar e convocar
          </button>
        </form>
      ) : null}

      {competitions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
          Ainda não há competições. Cria a primeira para convocar e meter resultados.
        </p>
      ) : (
        <ul className="space-y-3">
          {competitions.map((meet) => {
            const provas = meetEntries.filter((entry) => entry.competitionId === meet.id);
            const withTime = provas.filter((entry) => meetResults.some((result) => result.entryId === entry.id)).length;
            const analyzed = raceSessions.filter((session) => session.competitionId === meet.id).length;
            return (
              <li key={meet.id} className="rounded-xl border border-line bg-panel p-4">
                <p className="text-xs font-semibold text-sand">{formatDateRange(meet.date, meetEnd(meet))}</p>
                <h2 className="text-xl font-semibold tracking-tight">{meet.title}</h2>
                <p className="text-sm text-mute">
                  {COURSE_LABEL[meet.course]} · {meet.athleteIds.length} convocados · {provas.length} provas · {withTime} tempos · {analyzed} análises
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Link
                    href={`/coach/competicoes/${meet.id}`}
                    className="flex h-11 items-center justify-center rounded-2xl bg-aqua hover:bg-aqua-2 text-sm font-semibold text-white"
                  >
                    Convocar
                  </Link>
                  <Link
                    href={`/coach/competicoes/${meet.id}/resultados`}
                    className="flex h-11 items-center justify-center rounded-2xl border border-line text-sm font-semibold"
                  >
                    Resultados
                  </Link>
                  <button
                    type="button"
                    className="h-11 rounded-2xl border border-coral/40 text-sm font-semibold text-coral"
                    onClick={() => {
                      if (!window.confirm("Apagar esta competição, convocatória e resultados?")) return;
                      void actions.deleteCompetition(meet.id);
                    }}
                  >
                    Apagar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
