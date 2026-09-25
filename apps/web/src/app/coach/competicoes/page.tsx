"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COURSE_LABEL, formatDateRange, meetTitle } from "@/lib/labels";
import { todayIso } from "@/lib/dates";
import { meetEnd } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";
import type { PoolCourse } from "@/lib/types";

const MONTH_SHORT = new Intl.DateTimeFormat("pt-PT", { month: "short" });

export default function CompeticoesPage() {
  const router = useRouter();
  const { competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const [open, setOpen] = useState(competitions.length === 0);
  const [title, setTitle] = useState(meetTitle(todayIso()));
  const [date, setDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [course, setCourse] = useState<PoolCourse>("scm");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Competições</h1>
          <p className="mt-1 text-sm text-mute">Convocatória e resultados. O painel de provas lê o que meteres aqui.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-primary"
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
        <section className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold">Ainda não há competições</p>
          <p className="mt-1 text-sm text-mute">Cria a primeira para convocar atletas e registar resultados.</p>
        </section>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-panel">
          {[...competitions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((meet) => {
              const provas = meetEntries.filter((entry) => entry.competitionId === meet.id);
              const withTime = provas.filter((entry) => meetResults.some((result) => result.entryId === entry.id)).length;
              const analyzed = raceSessions.filter((session) => session.competitionId === meet.id).length;
              const start = new Date(`${meet.date}T12:00:00`);
              const upcoming = meet.date >= todayIso();
              const steps = [
                { label: "Convocados", value: meet.athleteIds.length },
                { label: "Provas", value: provas.length },
                { label: "Tempos", value: withTime, of: provas.length },
                { label: "Análises", value: analyzed },
              ];
              return (
                <li key={meet.id} className="grid gap-4 border-t border-line p-5 first:border-t-0 md:grid-cols-[88px_minmax(0,1fr)_auto] md:items-center">
                  <div
                    className={`flex w-[88px] flex-col items-center justify-center rounded-xl py-2.5 ${
                      upcoming ? "bg-aqua text-white" : "bg-panel-2 text-mist"
                    }`}
                  >
                    <span className="font-display text-4xl font-bold leading-none tabular">{meet.date.slice(8, 10)}</span>
                    <span className={`text-xs font-semibold ${upcoming ? "text-white/75" : "text-mute"}`}>
                      {MONTH_SHORT.format(start).replace(".", "")} {meet.date.slice(0, 4)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-bold">{meet.title}</h2>
                      <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold text-sand">{COURSE_LABEL[meet.course]}</span>
                      {upcoming ? <span className="rounded-full bg-pool-soft px-2.5 py-0.5 text-xs font-semibold text-pool">Por vir</span> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-mute">{formatDateRange(meet.date, meetEnd(meet))}</p>
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                      {steps.map((step) => (
                        <div key={step.label}>
                          <dt className="text-xs text-mute">{step.label}</dt>
                          <dd className="font-display text-xl font-bold tabular text-mist">
                            {step.value}
                            {step.of != null && step.of > 0 ? <span className="text-sm font-medium text-mute">/{step.of}</span> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
                    <Link href={`/coach/competicoes/${meet.id}`} className="btn-primary">
                      Convocatória
                    </Link>
                    <Link href={`/coach/competicoes/${meet.id}/resultados`} className="btn-ghost">
                      Resultados
                    </Link>
                    <button
                      type="button"
                      className="min-h-10 rounded-lg px-3 text-sm font-semibold text-coral hover:bg-[#fdecea]"
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
