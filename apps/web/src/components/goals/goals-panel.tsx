"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatApiError, type ApiError } from "@/lib/api";
import { METRIC_LABEL, METRIC_UNIT, goalProgress, isGoalReached, type OfficialReaction } from "@/lib/goals";
import { COURSE_LABEL, STROKES, STROKE_LABEL, formatDatePt, formatEvent } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import { parseTime } from "@/lib/race-analysis";
import { raceRecords } from "@/lib/rankings";
import { actions, useAppState } from "@/lib/store";
import { toast } from "@/lib/toast";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { Goal, GoalKind, GoalMetric, PoolCourse, Stroke } from "@/lib/types";

const DISTANCES = [50, 100, 200, 400, 800, 1500];
const METRICS: GoalMetric[] = ["reaction", "at15", "dps", "sr", "underwater"];

type Draft = {
  id?: string;
  kind: GoalKind;
  stroke: Stroke | "";
  distanceM: number | "";
  course: PoolCourse | "";
  target: string;
  metric: GoalMetric | "";
  targetDate: string;
  competitionId: string;
  text: string;
};

const EMPTY: Draft = { kind: "time", stroke: "", distanceM: "", course: "lcm", target: "", metric: "", targetDate: "", competitionId: "", text: "" };

/**
 * Two-sided goals for one athlete: what the coach expects and what the athlete wants.
 * Progress comes from results and race analyses already in the app.
 */
export function GoalsPanel({ athleteId, role }: { athleteId: string; role: "coach" | "swimmer" }) {
  const t = useT();
  const { goals, athletes, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const athlete = athletes.find((item) => item.id === athleteId);
  const records = useMemo(
    () => raceRecords(competitions, meetEntries, meetResults, raceSessions, athleteId, athlete?.seedRecords),
    [athlete?.seedRecords, athleteId, competitions, meetEntries, meetResults, raceSessions],
  );
  const officialReactions = useMemo<OfficialReaction[]>(
    () =>
      meetResults.flatMap((result) => {
        const entry = meetEntries.find((item) => item.id === result.entryId);
        if (!entry || entry.athleteId !== athleteId || !result.reactionS) return [];
        const meet = competitions.find((item) => item.id === entry.competitionId);
        return [{ athleteId, stroke: entry.stroke, distanceM: entry.distanceM, value: result.reactionS, date: entry.date || meet?.date || "" }];
      }),
    [athleteId, competitions, meetEntries, meetResults],
  );
  const mine = goals.filter((goal) => goal.athleteId === athleteId && goal.kind === "time" && goal.status !== "dropped");
  const myRole = role === "coach" ? "coach" : "athlete";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const upcoming = competitions.filter((meet) => meet.date >= new Date().toISOString().slice(0, 10));

  async function save() {
    if (!draft) return;
    const value = draft.kind === "time" ? parseTime(draft.target) : Number(draft.target.replace(",", "."));
    setBusy(true);
    try {
      await actions.saveGoal({
        id: draft.id,
        athleteId,
        kind: draft.kind,
        stroke: draft.stroke || null,
        distanceM: draft.distanceM || null,
        course: draft.course || null,
        metric: draft.kind === "technical" ? draft.metric || null : null,
        targetValue: draft.kind === "other" ? null : Number.isFinite(value) && value > 0 ? value : null,
        targetDate: draft.targetDate || null,
        competitionId: draft.competitionId || null,
        text: draft.text,
      });
      setDraft(null);
    } catch (error) {
      toast.error(formatApiError(error as ApiError) || t("Não foi possível guardar."));
    } finally {
      setBusy(false);
    }
  }

  function edit(goal: Goal) {
    setDraft({
      id: goal.id,
      kind: goal.kind,
      stroke: goal.stroke ?? "",
      distanceM: goal.distanceM ?? "",
      course: goal.course ?? "",
      target:
        goal.targetValue == null ? "" : goal.kind === "time" ? formatRaceClock(goal.targetValue).replace(`'`, ":").replace(`"`, ".") : String(goal.targetValue),
      metric: goal.metric ?? "",
      targetDate: goal.targetDate ?? "",
      competitionId: goal.competitionId ?? "",
      text: goal.text,
    });
  }

  const sections: { author: Goal["author"]; title: string; hint: string }[] = [
    { author: "coach", title: t("O que o treinador espera"), hint: t("Definidos pelo treinador.") },
    { author: "athlete", title: t("O que o atleta quer"), hint: t("Definidos pelo atleta.") },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-2xl font-bold">{t("Objetivos")}</h2>
          <p className="text-sm text-mute">{t("Tempos finais de prova. O progresso atualiza-se sozinho com os resultados.")}</p>
        </div>
        {draft ? null : (
          <button type="button" className="btn-primary" onClick={() => setDraft({ ...EMPTY })}>
            {t("Novo objetivo")}
          </button>
        )}
      </header>

      {draft ? (
        <GoalForm
          draft={draft}
          setDraft={setDraft}
          upcoming={upcoming}
          busy={busy}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
        />
      ) : null}

      <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {sections.map((section) => {
          const list = mine.filter((goal) => goal.author === section.author);
          return (
            <div key={section.author} className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-panel-2 px-5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{section.title}</p>
                <p className="text-[11px] text-mute">{section.hint}</p>
              </div>
              {list.length === 0 ? (
                <p className="px-5 py-5 text-sm text-mute">{t("Ainda sem objetivos.")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      canEdit
                      canRespond={goal.author !== myRole}
                      canConfirm={role === "coach" || goal.author === myRole}
                      progress={goalProgress(goal, records, raceSessions, officialReactions)}
                      meetTitle={competitions.find((meet) => meet.id === goal.competitionId)?.title}
                      onEdit={() => edit(goal)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GoalRow({
  goal,
  canEdit,
  canRespond,
  canConfirm,
  progress,
  meetTitle,
  onEdit,
}: {
  goal: Goal;
  canEdit: boolean;
  canRespond: boolean;
  canConfirm: boolean;
  progress: ReturnType<typeof goalProgress>;
  meetTitle?: string;
  onEdit: () => void;
}) {
  const t = useT();
  const [reply, setReply] = useState(goal.response);
  const [replying, setReplying] = useState(false);
  const reached = isGoalReached(goal, progress);

  const title =
    goal.kind === "time" && goal.stroke && goal.distanceM
      ? `${formatEvent(goal.distanceM, goal.stroke)}${goal.course ? ` · ${COURSE_LABEL[goal.course]}` : ""}`
      : goal.kind === "technical" && goal.metric
        ? `${t(METRIC_LABEL[goal.metric])}${goal.stroke && goal.distanceM ? ` · ${formatEvent(goal.distanceM, goal.stroke)}` : ""}`
        : goal.text;

  const fmt = (value: number | null) =>
    value == null ? "—" : goal.kind === "time" ? formatRaceClock(value) : `${value.toFixed(2)} ${goal.metric ? METRIC_UNIT[goal.metric] : ""}`;

  async function update(patch: Partial<Goal>) {
    try {
      await actions.saveGoal({ id: goal.id, athleteId: goal.athleteId, ...patch });
    } catch (error) {
      toast.error(formatApiError(error as ApiError) || t("Não foi possível guardar."));
    }
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-mist">
            {title}
            {reached ? (
              <span className="ml-2 rounded bg-good-soft px-1.5 py-0.5 text-[11px] font-semibold text-good">{t("Atingido")}</span>
            ) : null}
          </p>
          <p className="text-xs text-mute">
            {[
              goal.targetDate ? t("até {date}", { date: formatDatePt(goal.targetDate) }) : "",
              meetTitle ? t("em {meet}", { meet: meetTitle }) : "",
              goal.kind !== "other" && goal.text ? goal.text : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {goal.kind !== "other" ? (
          <dl className="grid grid-cols-3 gap-4 text-right tabular">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-mute">{t("Objetivo")}</dt>
              <dd className="font-display text-lg font-bold text-mist">{fmt(goal.targetValue)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-mute">{t("Atual")}</dt>
              <dd className="font-display text-lg font-bold text-mist">{fmt(progress.current)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-mute">{t("Falta")}</dt>
              <dd className={`font-display text-lg font-bold ${reached ? "text-good" : "text-coral"}`}>
                {progress.gap == null ? "—" : reached ? "✓" : goal.kind === "time" ? `${progress.gap.toFixed(2)} s` : progress.gap.toFixed(2)}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      {goal.kind !== "other" ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className={`h-full rounded-full ${reached ? "bg-good" : "bg-pool"}`} style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
      ) : null}

      {goal.response && !replying ? (
        <p className="mt-2 rounded-lg bg-panel-2 px-3 py-2 text-sm text-mist">
          <span className="text-xs font-semibold text-mute">{goal.author === "coach" ? t("Resposta do atleta") : t("Resposta do treinador")}: </span>
          {goal.response}
        </p>
      ) : null}

      {replying ? (
        <div className="mt-2 flex gap-2">
          <input className="field h-9 py-1 text-sm" value={reply} maxLength={400} onChange={(event) => setReply(event.target.value)} />
          <button
            type="button"
            className="btn-primary h-9 px-3 text-xs"
            onClick={() => {
              setReplying(false);
              void update({ response: reply });
            }}
          >
            {t("Guardar")}
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
        {canRespond && !replying ? (
          <button type="button" className="text-pool hover:underline" onClick={() => setReplying(true)}>
            {goal.response ? t("Editar resposta") : t("Responder")}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" className="text-pool hover:underline" onClick={onEdit}>
            {t("Editar")}
          </button>
        ) : null}
        {canConfirm && goal.kind === "other" && goal.status !== "achieved" ? (
          <button type="button" className="text-good hover:underline" onClick={() => void update({ status: "achieved" })}>
            {t("Marcar como atingido")}
          </button>
        ) : null}
        {canEdit ? (
          <ConfirmButton label={t("Eliminar")} className="rounded px-1 text-coral hover:underline" onConfirm={() => actions.deleteGoal(goal.id)} />
        ) : null}
      </div>
    </li>
  );
}

function GoalForm({
  draft,
  setDraft,
  upcoming,
  busy,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (next: Draft | null) => void;
  upcoming: { id: string; title: string; date: string }[];
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <div className="space-y-3 border-b border-line bg-panel-2 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {draft.kind !== "other" ? (
          <>
            <label className="text-xs font-semibold text-mute">
              {t("Estilo")}
              <select className="field mt-1" value={draft.stroke} onChange={(event) => set({ stroke: event.target.value as Stroke })}>
                <option value="">{draft.kind === "technical" ? t("Qualquer") : "—"}</option>
                {STROKES.map((stroke) => (
                  <option key={stroke} value={stroke}>
                    {STROKE_LABEL[stroke]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-mute">
              {t("Distância")}
              <select
                className="field mt-1"
                value={draft.distanceM}
                onChange={(event) => set({ distanceM: event.target.value ? Number(event.target.value) : "" })}
              >
                <option value="">{draft.kind === "technical" ? t("Qualquer") : "—"}</option>
                {DISTANCES.map((distance) => (
                  <option key={distance} value={distance}>
                    {distance} m
                  </option>
                ))}
              </select>
            </label>
            {draft.kind === "time" ? (
              <label className="text-xs font-semibold text-mute">
                {t("Piscina")}
                <select className="field mt-1" value={draft.course} onChange={(event) => set({ course: event.target.value as PoolCourse })}>
                  <option value="lcm">{COURSE_LABEL.lcm}</option>
                  <option value="scm">{COURSE_LABEL.scm}</option>
                </select>
              </label>
            ) : null}
            <label className="text-xs font-semibold text-mute">
              {draft.kind === "time" ? t("Tempo objetivo") : t("Valor objetivo")}
              <input
                className="field mt-1 font-mono"
                value={draft.target}
                placeholder={draft.kind === "time" ? "2:18.00" : "0.65"}
                onChange={(event) => set({ target: event.target.value })}
                inputMode="decimal"
              />
            </label>
          </>
        ) : null}
        <label className="text-xs font-semibold text-mute">
          {t("Até")}
          <input type="date" className="field mt-1" value={draft.targetDate} onChange={(event) => set({ targetDate: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-mute">
          {t("Competição")}
          <select className="field mt-1" value={draft.competitionId} onChange={(event) => set({ competitionId: event.target.value })}>
            <option value="">—</option>
            {upcoming.map((meet) => (
              <option key={meet.id} value={meet.id}>
                {meet.title} · {formatDatePt(meet.date)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-semibold text-mute">
        {draft.kind === "other" ? t("Objetivo") : t("Nota (opcional)")}
        <input className="field mt-1" value={draft.text} maxLength={400} onChange={(event) => set({ text: event.target.value })} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          {t("Cancelar")}
        </button>
        <button type="button" className="btn-primary" onClick={onSave} disabled={busy}>
          {busy ? t("A guardar…") : t("Guardar")}
        </button>
      </div>
    </div>
  );
}
