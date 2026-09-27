"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { MeetFilesDrop } from "@/components/competicoes/meet-files-drop";
import { MeetInfoPanel } from "@/components/competicoes/meet-info-panel";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { formatApiError, type ApiError } from "@/lib/api";
import { COURSE_LABEL, STROKES, STROKE_LABEL, formatDatePt, formatDateRange, formatEvent } from "@/lib/labels";
import { goalsForEvent } from "@/lib/goals";
import { formatRaceClock } from "@/lib/race";
import { parseTime } from "@/lib/race-analysis";
import { meetEnd, personalBests, raceRecords } from "@/lib/rankings";
import { eventsForCourse } from "@/lib/meets";
import { actions, useAppState } from "@/lib/store";
import { fromCentiseconds, partsFromNumbers } from "@/lib/swim-time";
import { toast } from "@/lib/toast";
import type { Athlete, Competition, Goal, MeetEntry, MeetResult, PoolCourse, Stroke } from "@/lib/types";
import { useT } from "@/i18n/provider";

/**
 * One page per competition: what the regulations said, the start list (events, heats, lanes, entry
 * times) and the results, which keep arriving by themselves from the live-results link.
 */
export default function CompetitionPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { athletes, competitions, meetEntries, meetResults, goals } = useAppState();
  const meet = competitions.find((item) => item.id === params.id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!meet) {
    return (
      <div className="py-10 text-center text-mute">
        {t("Competição não encontrada.")}
        <Link href="/coach/competicoes" className="mt-3 block text-aqua">
          {t("Voltar")}
        </Link>
      </div>
    );
  }

  const entries = meetEntries.filter((entry) => entry.competitionId === meet.id);
  const selected = athletes.filter((athlete) => meet.athleteIds.includes(athlete.id) || entries.some((entry) => entry.athleteId === athlete.id));
  const others = athletes.filter((athlete) => athlete.active !== false && !selected.includes(athlete));
  const hasStartList = entries.some((entry) => entry.heat || entry.lane);

  return (
    <div className="space-y-5">
      <Link href="/coach/competicoes" className="text-sm font-semibold text-pool hover:underline">
        ← {t("Competições")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{meet.title}</h1>
          <p className="text-sm text-mute">
            {[formatDateRange(meet.date, meetEnd(meet)), COURSE_LABEL[meet.course], meet.venue].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-10" onClick={() => setEditing((open) => !open)}>
            {editing ? t("Fechar") : t("Editar")}
          </button>
          <ConfirmButton
            label={t("Eliminar")}
            confirmLabel={t("Confirmar eliminação")}
            className="btn-ghost h-10 text-coral"
            onConfirm={async () => {
              await actions.deleteCompetition(meet.id);
              router.push("/coach/competicoes");
            }}
          />
        </div>
      </header>

      {editing ? <EditMeet meet={meet} onDone={() => setEditing(false)} /> : null}

      <Steps hasEntries={entries.length > 0} hasStartList={hasStartList} hasLive={Boolean(meet.live?.url)} />

      {!hasStartList ? <MeetFilesDrop compact competitionId={meet.id} /> : null}
      <MeetInfoPanel meet={meet} highlightLive={hasStartList && !meet.live?.url} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">{t("Provas")}</h2>
          <p className="text-xs text-mute">{t("{count} atletas", { count: selected.length })}</p>
        </div>

        {selected.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-panel px-4 py-6 text-sm text-mute">
            {t("Ainda sem atletas. Larga a start list quando sair ou adiciona uma prova à mão.")}
          </p>
        ) : null}

        {selected.map((athlete) => (
          <AthleteEvents
            key={athlete.id}
            meet={meet}
            athlete={athlete}
            entries={entries.filter((entry) => entry.athleteId === athlete.id)}
            results={meetResults}
            goals={goals}
            adding={adding === athlete.id}
            onAdd={() => setAdding(athlete.id)}
            onCloseAdd={() => setAdding(null)}
          />
        ))}

        <div className="rounded-xl border border-dashed border-line bg-panel px-4 py-3">
          <button type="button" className="text-sm font-semibold text-pool hover:underline" onClick={() => setShowAll((open) => !open)}>
            {showAll ? t("Fechar") : t("Adicionar prova a outro atleta")}
          </button>
          {showAll ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {others.map((athlete) => (
                <li key={athlete.id}>
                  <button
                    type="button"
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-mist hover:border-pool"
                    onClick={() => {
                      void actions.toggleMeetAthlete(meet.id, athlete.id).then(() => setAdding(athlete.id));
                      setShowAll(false);
                    }}
                  >
                    {athlete.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {hasStartList ? <MeetFilesDrop compact competitionId={meet.id} /> : null}
    </div>
  );
}

function Steps({ hasEntries, hasStartList, hasLive }: { hasEntries: boolean; hasStartList: boolean; hasLive: boolean }) {
  const t = useT();
  const steps = [
    { label: t("Regulamento"), done: true },
    { label: t("Start list"), done: hasStartList || hasEntries },
    { label: t("Resultados em direto"), done: hasLive },
  ];
  return (
    <ol className="flex flex-wrap gap-2 text-xs font-semibold">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${step.done ? "bg-good-soft text-good" : "border border-line text-mute"}`}
        >
          <span className="tabular">{step.done ? "✓" : index + 1}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function EditMeet({ meet, onDone }: { meet: Competition; onDone: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(meet.title);
  const [date, setDate] = useState(meet.date);
  const [endDate, setEndDate] = useState(meetEnd(meet));
  const [course, setCourse] = useState<PoolCourse>(meet.course);
  useEffect(() => {
    setTitle(meet.title);
    setDate(meet.date);
    setEndDate(meetEnd(meet));
    setCourse(meet.course);
  }, [meet]);
  return (
    <form
      className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await actions.updateCompetition(meet.id, { title, date, endDate: endDate && endDate >= date ? endDate : date, course, venue: meet.venue });
        onDone();
      }}
    >
      <label className="text-xs font-semibold text-mute sm:col-span-2">
        {t("Título")}
        <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="text-xs font-semibold text-mute">
        {t("De")}
        <input type="date" className="field mt-1" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <label className="text-xs font-semibold text-mute">
        {t("Até")}
        <input type="date" className="field mt-1" value={endDate} min={date} onChange={(event) => setEndDate(event.target.value)} required />
      </label>
      <div className="text-xs font-semibold text-mute">
        {t("Piscina")}
        <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-line p-0.5">
          {(["scm", "lcm"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setCourse(item)} className={`rounded-md py-1.5 text-sm font-semibold ${course === item ? "bg-ink text-white" : "text-mute"}`}>
              {COURSE_LABEL[item]}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" className="btn-primary self-end">
        {t("Guardar alterações")}
      </button>
    </form>
  );
}

const clock = (seconds: number | null | undefined) => (seconds ? formatRaceClock(seconds) : "—");
const resultSeconds = (result?: MeetResult) => (result && (result.mm || result.ss || result.cc) ? result.mm * 60 + result.ss + result.cc / 100 : null);
const heatLane = (heat?: number | null, lane?: number | null) => (heat || lane != null ? `S${heat ?? "—"}/P${lane ?? "—"}` : "—");
const placeLabel = (place?: number | null) => (place ? `${place}.º` : "");
const typed = (seconds: number) => formatRaceClock(seconds).replace("'", ":").replace('"', ".");

function AthleteEvents({
  meet,
  athlete,
  entries,
  results,
  goals,
  adding,
  onAdd,
  onCloseAdd,
}: {
  meet: Competition;
  athlete: Athlete;
  entries: MeetEntry[];
  results: MeetResult[];
  goals: Goal[];
  adding: boolean;
  onAdd: () => void;
  onCloseAdd: () => void;
}) {
  const t = useT();
  const { competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const records = personalBests(raceRecords(competitions, meetEntries, meetResults, raceSessions, athlete.id, athlete.seedRecords));
  const sorted = [...entries].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.eventNumber ?? 999) - (b.eventNumber ?? 999));
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="font-semibold text-mist">{athlete.name}</p>
        <button type="button" className="text-xs font-semibold text-pool hover:underline" onClick={onAdd}>
          + {t("Adicionar prova")}
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm tabular">
          <thead>
            <tr className="bg-panel-2 text-left text-[11px] font-semibold uppercase tracking-wide text-mute">
              <th className="px-3 py-1.5">{t("Prova")}</th>
              <th className="px-2 py-1.5 text-right">N.º</th>
              <th className="px-2 py-1.5">{t("Dia")}</th>
              <th className="px-2 py-1.5 text-center">{t("Eliminatória")}</th>
              <th className="px-2 py-1.5 text-center">{t("Final")}</th>
              <th className="px-2 py-1.5 text-right">{t("Inscrição")}</th>
              <th className="px-2 py-1.5 text-right">{t("Objetivo")}</th>
              <th className="px-2 py-1.5 text-right">{t("Resultado")}</th>
              <th className="px-2 py-1.5 text-right">{t("Class.")}</th>
              <th className="px-2 py-1.5 text-right">RP</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !adding ? (
              <tr>
                <td colSpan={11} className="px-3 py-3 text-sm text-mute">
                  {t("Sem provas ainda.")}
                </td>
              </tr>
            ) : null}
            {sorted.map((entry) => {
              const result = results.find((item) => item.entryId === entry.id);
              const best = resultSeconds(result);
              const target = goalsForEvent(goals, athlete.id, entry.stroke, entry.distanceM, meet.course)
                .map((goal) => goal.targetValue ?? 0)
                .filter((value) => value > 0)
                .sort((a, b) => a - b)[0];
              const pb = records.find((record) => record.course === meet.course && record.stroke === entry.stroke && record.distanceM === entry.distanceM);
              const heat = result?.swims?.heat;
              const final = result?.swims?.final;
              return (
                <Fragment key={entry.id}>
                  <tr className="border-t border-line align-top">
                    <td className="px-3 py-2 font-semibold text-mist">{formatEvent(entry.distanceM, entry.stroke)}</td>
                    <td className="px-2 py-2 text-right font-mono text-mute">{entry.eventNumber ?? "—"}</td>
                    <td className="px-2 py-2 text-mute">
                      {entry.date ? formatDatePt(entry.date).slice(0, 5) : "—"}
                      {entry.sessionTime ? <span className="block text-[11px]">{entry.sessionTime}</span> : null}
                    </td>
                    <td className="px-2 py-2 text-center font-mono">
                      {heatLane(entry.heat, entry.lane)}
                      {heat ? (
                        <span className="block text-[11px] text-mute">
                          {clock(heat.timeS)} {placeLabel(heat.place)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-center font-mono">
                      {heatLane(entry.finalHeat, entry.finalLane)}
                      {final ? (
                        <span className="block text-[11px] text-mute">
                          {clock(final.timeS)} {placeLabel(final.place)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {entry.entryTimeS ? (
                        <>
                          {clock(entry.entryTimeS)}
                          {entry.entryCourse ? <span className="ml-1 text-[11px] text-mute">({entry.entryCourse === "scm" ? "25m" : "50m"})</span> : null}
                        </>
                      ) : (
                        "NT"
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-aqua">{clock(target)}</td>
                    <td className="px-2 py-2 text-right">
                      <span className={`font-display text-lg font-bold ${best && target && best <= target ? "text-good" : "text-mist"}`}>{clock(best)}</span>
                      {result?.reactionS ? <span className="block text-[11px] text-mute">RT {result.reactionS.toFixed(2)}</span> : null}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {(final ?? heat)?.place ? (
                        <>
                          <span className="font-semibold text-mist">{placeLabel((final ?? heat)?.place)}</span>
                          {(final ?? heat)?.category ? <span className="block text-[11px] text-mute">{(final ?? heat)?.category}</span> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {pb ? (
                        <>
                          {clock(pb.timeS)}
                          {best && Math.abs(best - pb.timeS) < 0.005 ? <span className="ml-1 rounded bg-good-soft px-1 text-[10px] font-bold text-good">RP</span> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">
                      <Link href={`/coach/competicoes/${meet.id}/resultados/${entry.id}`} className="block whitespace-nowrap text-pool hover:underline">
                        {t("Adicionar detalhes")}
                      </Link>
                      <ConfirmButton
                        label={t("Eliminar")}
                        className="mt-1 rounded px-1 text-coral hover:underline"
                        onConfirm={() => actions.deleteMeetEntry(entry.id)}
                      />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {adding ? (
              <tr>
                <td colSpan={11} className="border-t border-line bg-panel-2 px-3 py-3">
                  <EntryForm meet={meet} athlete={athlete} onDone={onCloseAdd} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

/** Add or correct one event by hand. Imports and live results later fill anything left empty. */
function EntryForm({
  meet,
  athlete,
  entry,
  result,
  target,
  onDone,
}: {
  meet: Competition;
  athlete: Athlete;
  entry?: MeetEntry;
  result?: MeetResult;
  target?: number;
  onDone: () => void;
}) {
  const t = useT();
  const events = eventsForCourse(meet.course);
  const best = resultSeconds(result);
  const [event, setEvent] = useState(entry ? `${entry.stroke}:${entry.distanceM}` : "");
  const [number, setNumber] = useState(entry?.eventNumber ? String(entry.eventNumber) : "");
  const [day, setDay] = useState(entry?.date ?? meet.date);
  const [heat, setHeat] = useState(entry?.heat ? String(entry.heat) : "");
  const [lane, setLane] = useState(entry?.lane != null ? String(entry.lane) : "");
  const [finalHeat, setFinalHeat] = useState(entry?.finalHeat ? String(entry.finalHeat) : "");
  const [finalLane, setFinalLane] = useState(entry?.finalLane != null ? String(entry.finalLane) : "");
  const [entryTime, setEntryTime] = useState(entry?.entryTimeS ? typed(entry.entryTimeS) : "");
  const [entryCourse, setEntryCourse] = useState<PoolCourse>(entry?.entryCourse ?? meet.course);
  const [goal, setGoal] = useState(target ? typed(target) : "");
  const [final, setFinal] = useState(best ? typed(best) : "");
  const [busy, setBusy] = useState(false);
  const digits = (value: string) => value.replace(/\D/g, "");

  async function save() {
    const [stroke, distance] = event.split(":");
    if (!stroke || !distance) return;
    setBusy(true);
    try {
      const saved = await actions.saveMeetEntry({
        competitionId: meet.id,
        athleteId: athlete.id,
        stroke: stroke as Stroke,
        distanceM: Number(distance),
        eventNumber: number ? Number(number) : null,
        date: day || null,
        heat: heat ? Number(heat) : null,
        lane: lane !== "" ? Number(lane) : null,
        finalHeat: finalHeat ? Number(finalHeat) : null,
        finalLane: finalLane !== "" ? Number(finalLane) : null,
        entryTimeS: entryTime ? parseTime(entryTime) || null : null,
        entryCourse: entryTime ? entryCourse : null,
      });
      const goalS = goal ? parseTime(goal) : 0;
      if (goalS > 0 && Math.abs(goalS - (target ?? 0)) > 0.001) {
        await actions.saveGoal({
          athleteId: athlete.id,
          kind: "time",
          stroke: stroke as Stroke,
          distanceM: Number(distance),
          course: meet.course,
          targetValue: goalS,
          competitionId: meet.id,
          text: "",
        });
      }
      const finalS = final ? parseTime(final) : 0;
      if (finalS > 0 && Math.abs(finalS - (best ?? 0)) > 0.001) {
        const parts = fromCentiseconds(Math.round(finalS * 100));
        actions.saveMeetResult(saved.id, partsFromNumbers(parts.mm, parts.ss, parts.cc));
      }
      onDone();
    } catch (error) {
      toast.error(formatApiError(error as ApiError));
    } finally {
      setBusy(false);
    }
  }

  const field = "field h-9 py-1 text-sm";
  const small = "text-[11px] font-semibold text-mute";
  return (
    <form
      className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8"
      onSubmit={(submit) => {
        submit.preventDefault();
        void save();
      }}
    >
      <label className={`${small} sm:col-span-2`}>
        {t("Prova")}
        <select className={field} value={event} onChange={(change) => setEvent(change.target.value)} disabled={Boolean(entry)} required>
          <option value="">—</option>
          {STROKES.map((stroke) => (
            <optgroup key={stroke} label={STROKE_LABEL[stroke]}>
              {events
                .filter((item) => item.stroke === stroke)
                .map((item) => (
                  <option key={`${item.stroke}:${item.distanceM}`} value={`${item.stroke}:${item.distanceM}`}>
                    {formatEvent(item.distanceM, item.stroke)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={small}>
        N.º
        <input className={field} inputMode="numeric" value={number} onChange={(change) => setNumber(digits(change.target.value))} />
      </label>
      <label className={`${small} sm:col-span-2`}>
        {t("Dia")}
        <input type="date" className={field} value={day} min={meet.date} max={meetEnd(meet)} onChange={(change) => setDay(change.target.value)} />
      </label>
      <label className={small}>
        {t("Série (elim.)")}
        <input className={field} inputMode="numeric" value={heat} onChange={(change) => setHeat(digits(change.target.value))} />
      </label>
      <label className={small}>
        {t("Pista (elim.)")}
        <input className={field} inputMode="numeric" value={lane} onChange={(change) => setLane(digits(change.target.value))} />
      </label>
      <label className={small}>
        {t("Série (final)")}
        <input className={field} inputMode="numeric" value={finalHeat} onChange={(change) => setFinalHeat(digits(change.target.value))} />
      </label>
      <label className={small}>
        {t("Pista (final)")}
        <input className={field} inputMode="numeric" value={finalLane} onChange={(change) => setFinalLane(digits(change.target.value))} />
      </label>
      <label className={`${small} sm:col-span-2`}>
        {t("Tempo de inscrição")}
        <span className="flex gap-1">
          <input className={`${field} font-mono`} placeholder="1:02.34" value={entryTime} onChange={(change) => setEntryTime(change.target.value)} />
          <select className="field h-9 w-20 py-1 text-sm" value={entryCourse} onChange={(change) => setEntryCourse(change.target.value as PoolCourse)}>
            <option value="scm">25m</option>
            <option value="lcm">50m</option>
          </select>
        </span>
      </label>
      <label className={small}>
        {t("Objetivo")}
        <input className={`${field} font-mono`} placeholder="1:01.50" value={goal} onChange={(change) => setGoal(change.target.value)} />
      </label>
      <label className={small}>
        {t("Resultado")}
        <input className={`${field} font-mono`} placeholder="1:01.20" value={final} onChange={(change) => setFinal(change.target.value)} />
      </label>
      <div className="flex items-end justify-end gap-2 sm:col-span-4">
        <button type="button" className="btn-ghost h-9" onClick={onDone} disabled={busy}>
          {t("Cancelar")}
        </button>
        <button type="submit" className="btn-primary h-9" disabled={busy || !event}>
          {busy ? t("A guardar…") : t("Guardar")}
        </button>
      </div>
    </form>
  );
}
