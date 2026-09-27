"use client";

import Link from "next/link";
import { MeetFilesDrop } from "@/components/competicoes/meet-files-drop";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { COURSE_LABEL, formatDateRange } from "@/lib/labels";
import { intlLocale } from "@/i18n";
import { todayIso } from "@/lib/dates";
import { meetEnd } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";
import { useT } from "@/i18n/provider";


export default function CompeticoesPage() {
  const t = useT();
  const { competitions, meetEntries, meetResults, raceSessions } = useAppState();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t("Competições")}</h1>
          <p className="mt-1 text-sm text-mute">{t("Regulamento, start list e resultados em direto, tudo numa página por competição.")}</p>
        </div>
      </header>

      <MeetFilesDrop />

      {competitions.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold">{t("Ainda não há competições")}</p>
          <p className="mt-1 text-sm text-mute">{t("Larga o regulamento acima para criar a primeira.")}</p>
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
                { label: t("Convocados"), value: meet.athleteIds.length },
                { label: t("Provas"), value: provas.length },
                { label: t("Tempos"), value: withTime, of: provas.length },
                { label: t("Análises"), value: analyzed },
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
                      {new Intl.DateTimeFormat(intlLocale(), { month: "short" }).format(start).replace(".", "")} {meet.date.slice(0, 4)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-bold">{meet.title}</h2>
                      <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold text-sand">{COURSE_LABEL[meet.course]}</span>
                      {upcoming ? <span className="rounded-full bg-pool-soft px-2.5 py-0.5 text-xs font-semibold text-pool">{t("Por vir")}</span> : null}
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
                      {t("Informação")}
                    </Link>
                    <ConfirmButton
                      label={t("Eliminar")}
                      confirmLabel={t("Confirmar eliminação")}
                      className="min-h-10 rounded-lg px-3 text-sm font-semibold text-coral hover:bg-[#fdecea]"
                      onConfirm={() => actions.deleteCompetition(meet.id)}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
