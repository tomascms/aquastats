"use client";

import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";
import { formatDatePt } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import { attribute, type Cause } from "@/lib/ml/attribution";
import { dayNumber, type RaceResult } from "@/lib/ml/backtest";
import { fetchLedger, healthAlerts, promotionReport, reconcile, reconstructedOutcomes, trackRecord, type HealthAlert, type LedgerEntry, type Outcome } from "@/lib/ml/ledger";
import { useMlRoles } from "@/lib/ml/ml-config";
import { weeklyReport, type LearningItem } from "@/lib/ml/monitoring";
import { appTeam, learningStatus, MODELS, predictionsFor, statePredictions, suspectTimes, WEEKS_TO_SETTLE } from "@/lib/ml/production";
import type { Athlete, TimeLog, Workout } from "@/lib/types";

const CAUSE_LABEL: Record<Cause, MessageKey> = {
  "dado-errado": "Tempo com ar de erro de digitação",
  "dado-em-falta": "Pouca informação (série nova ou muito tempo sem tempos)",
  regresso: "Ainda a recuperar de uma paragem",
  "dia-anormal": "Dia todo fora do normal",
  "vies-atleta": "O atleta mudou e o modelo ainda está a acompanhar",
  "mal-calibrado": "Intervalos demasiado estreitos ultimamente",
  contexto: "Manhã, 2.º treino ou pouco sono",
  "sem-causa-clara": "Sem causa clara nos dados",
};

const CAUSE_ACTION: Record<Cause, MessageKey> = {
  "dado-errado": "Não aprende com este tempo.",
  "dado-em-falta": "Aprende com ele; a incerteza já era grande.",
  regresso: "Reestima quanto falta recuperar.",
  "dia-anormal": "Fica como efeito do dia; o nível não muda.",
  "vies-atleta": "Passa a aprender mais depressa.",
  "mal-calibrado": "Alarga os intervalos.",
  contexto: "Fica registado; o contexto não melhorou as previsões no teste.",
  "sem-causa-clara": "Aprende com ele como com qualquer outro tempo.",
};

const FACTOR_LABEL: Record<string, MessageKey> = {
  "stroke:back": "Costas face a livres",
  "stroke:breast": "Bruços face a livres",
  "stroke:fly": "Mariposa face a livres",
  "stroke:im": "Estilos face a livres",
  "gear:legs": "Pernas face a nado completo",
  "gear:fins": "Barbatanas",
  "gear:paddles": "Palas",
  "gear:pullbuoy": "Pullbuoy",
  "gear:arms": "Só braços",
  "gear:parachute": "Paraquedas",
};

const signed = (value: number, digits = 1) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
const percent = (value: number | null) => (value == null || !Number.isFinite(value) ? "—" : `${Math.round(value * 100)}%`);

function LearningLine({ item }: { item: LearningItem }) {
  const t = useT();
  switch (item.kind) {
    case "form":
      return <>{item.pct < 0 ? t("Forma: {pct}% mais rápido do que na semana anterior.", { pct: Math.abs(item.pct).toFixed(1) }) : t("Forma: {pct}% mais lento do que na semana anterior.", { pct: item.pct.toFixed(1) })}</>;
    case "return":
      return <>{t("Défice de regresso de uma paragem: de {from}% para {to}%.", { from: item.fromPct.toFixed(1), to: item.toPct.toFixed(1) })}</>;
    case "factor":
      return item.first ? (
        <>{t("{factor}: primeira vez; partiu de {to}% (estimativa da equipa ou da fisiologia).", { factor: t(FACTOR_LABEL[item.factor] ?? "Fator"), to: signed(item.toPct) })}</>
      ) : (
        <>{t("{factor}: agora {to}% (era {from}%).", { factor: t(FACTOR_LABEL[item.factor] ?? "Fator"), from: signed(item.fromPct), to: signed(item.toPct) })}</>
      );
    case "regime":
      return <>{t("{date}: os erros apontaram sempre no mesmo sentido; o modelo passou a aprender mais depressa.", { date: formatDatePt(item.date).slice(0, 5) })}</>;
    case "suspects":
      return <>{item.count === 1 ? t("1 tempo suspeito ficou de fora do que o modelo aprende.") : t("{count} tempos suspeitos ficaram de fora do que o modelo aprende.", { count: item.count })}</>;
    case "accuracy":
      return (
        <>
          {t("Acerto da semana: erro médio {mape}% em {n} reps, {coverage} dentro do intervalo.", { mape: item.mapePct.toFixed(1), n: item.n, coverage: percent(item.coverage) })}
          {item.usualMapePct != null ? ` ${t("(habitual {usual}%)", { usual: item.usualMapePct.toFixed(1) })}` : ""}
        </>
      );
    case "drift":
      return <>{t("Nas últimas 4 semanas só {coverage} dos tempos caíram no intervalo de 80%: o modelo está a alargar os intervalos.", { coverage: percent(item.coverage) })}</>;
  }
}

function WeeklyChart({ weeks }: { weeks: ReturnType<typeof trackRecord>["weekly"] }) {
  const t = useT();
  const shown = weeks.slice(-16);
  if (shown.length < 2) return null;
  const width = 620;
  const height = 150;
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const top = Math.max(2, ...shown.map((week) => week.mapePct)) * 1.15;
  const step = innerW / shown.length;
  const y = (value: number) => pad.t + innerH - (value / top) * innerH;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={t("Erro médio por semana")}>
      {[0, top / 2, top].map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="#e3eaf1" />
          <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" fill="#56697f" fontSize="11">
            {tick.toFixed(1)}%
          </text>
        </g>
      ))}
      {shown.map((week, i) => (
        <g key={week.week}>
          <rect x={pad.l + i * step + step * 0.2} y={y(week.mapePct)} width={step * 0.6} height={pad.t + innerH - y(week.mapePct)} rx={3} fill="#1668b8" opacity={0.75}>
            <title>{`${t("Semana de {date}", { date: formatDatePt(week.week) })} · ${t("erro médio {mape}%", { mape: week.mapePct.toFixed(1) })} · ${t("{count} reps", { count: week.n })} · ${t("{coverage} dentro do intervalo", { coverage: percent(week.coverage) })}`}</title>
          </rect>
        </g>
      ))}
      <text x={pad.l} y={height - 6} fill="#56697f" fontSize="11">
        {formatDatePt(shown[0].week).slice(0, 5)}
      </text>
      <text x={width - pad.r} y={height - 6} textAnchor="end" fill="#56697f" fontSize="11">
        {formatDatePt(shown[shown.length - 1].week).slice(0, 5)}
      </text>
    </svg>
  );
}

/**
 * Prediction vs reality for one athlete: what the model said before each session and what was
 * swum. Uses the ledger (predictions recorded before the times existed) when there is enough of it,
 * otherwise a day-ahead replay of the history, and always says which one it is.
 */
export function TrackRecordPanel({
  athleteId,
  athletes,
  workouts,
  timeLogs,
  races = [],
  canReadLedger,
}: {
  athleteId: string;
  athletes: Athlete[];
  workouts: Workout[];
  timeLogs: TimeLog[];
  races?: RaceResult[];
  canReadLedger: boolean;
}) {
  const t = useT();
  const { champion: CHAMPION, challenger: CHALLENGER } = useMlRoles();
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);

  useEffect(() => {
    if (!canReadLedger || !athleteId) return;
    let alive = true;
    fetchLedger(athleteId)
      .then((entries) => alive && setLedger(entries))
      .catch(() => alive && setLedger([]));
    return () => {
      alive = false;
    };
  }, [athleteId, canReadLedger]);

  const view = useMemo(() => {
    const { team } = appTeam(athletes, workouts, timeLogs, [], races);
    const rows = team.rows.get(athleteId) ?? [];
    const champion = predictionsFor(CHAMPION, team);
    const suspects = suspectTimes(team);
    const reconstructed = reconstructedOutcomes(champion, rows).filter((item) => !suspects.has(item.logId));
    const recorded = ledger ? reconcile(ledger.filter((entry) => entry.model === MODELS[CHAMPION].id), timeLogs).filter((item) => !suspects.has(item.logId)) : [];
    const real = recorded.length >= 20;
    const outcomes: Outcome[] = real ? recorded : reconstructed;
    const record = trackRecord(outcomes);
    const byLog = new Map(rows.map((row) => [row.log.id, row]));
    const previousDay = new Map<string, number>();
    let last: number | null = null;
    for (const row of rows) {
      const day = dayNumber(row.date);
      previousDay.set(row.log.id, last == null ? 0 : day - last);
      if (last == null || day > last) last = day;
    }
    const causes = attribute(
      outcomes.map((outcome) => {
        const prediction = champion.get(outcome.logId);
        return {
          outcome,
          row: byLog.get(outcome.logId),
          suspect: suspects.get(outcome.logId),
          newKind: prediction?.newKind,
          returnPct: prediction?.factors.find((factor) => factor.key === "return")?.pct,
          daysSinceLast: previousDay.get(outcome.logId),
        };
      }),
    );
    // What the learning model (the state model) took from the latest week, judged on its own predictions.
    const learner = CHAMPION === "estado" ? champion : statePredictions(team);
    const learnerOutcomes = reconstructedOutcomes(learner, rows).filter((item) => !suspects.has(item.logId));
    const latestWeek = record.weekly.at(-1)?.week;
    const report = latestWeek ? weeklyReport(team, athleteId, latestWeek, learnerOutcomes, suspects) : null;
    const lastDay = outcomes.length ? Math.max(...outcomes.map((item) => dayNumber(item.date))) : 0;
    const misses = outcomes
      .filter((item) => causes.get(item.id)?.miss && lastDay - dayNumber(item.date) < 28)
      .sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.errorPct) - Math.abs(a.errorPct))
      .slice(0, 5);
    const recent = record.weekly.slice(-4);
    const before = record.weekly.slice(-8, -4);
    const avg = (list: typeof recent) => (list.length ? list.reduce((sum, week) => sum + week.mapePct, 0) / list.length : null);
    const trend = avg(recent) != null && avg(before) != null ? avg(recent)! - avg(before)! : null;
    const promotion = ledger ? promotionReport(reconcile(ledger, timeLogs), CHAMPION, CHALLENGER) : null;
    // Monitoring of the shown model, on the predictions actually recorded before each session.
    const alerts: HealthAlert[] = real ? healthAlerts(recorded, MODELS[CHAMPION].nominal) : [];
    return { real, record, misses, causes, report, trend, status: learningStatus(rows), promotion, byLog, alerts };
  }, [CHALLENGER, CHAMPION, athleteId, athletes, ledger, races, timeLogs, workouts]);

  const { record, status } = view;
  const nominal = MODELS[CHAMPION].nominal;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold">{t("Histórico de acerto")}</h3>
          <p className="text-sm text-mute">{t("Cada estimativa comparada com o tempo real, usando só o que se sabia antes desse treino.")}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${view.real ? "bg-[#e3f4ed] text-good" : "bg-panel-2 text-mute"}`}
          title={view.real ? t("Previsões gravadas antes de cada treino.") : t("Reconstruído: o que o modelo teria dito em cada dia, sem ver o futuro. Passa a usar as previsões gravadas quando houver pelo menos 20.")}
        >
          {view.real ? t("Registado") : t("Reconstruído")}
        </span>
      </header>

      {record.n === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">
          {t("Ainda não há tempos suficientes para comparar previsões com a realidade.")}
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-panel-2 px-3 py-2">
              <dt className="text-xs text-mute">{t("Reps comparadas")}</dt>
              <dd className="font-display text-xl font-bold tabular text-mist">{record.n}</dd>
            </div>
            <div className="rounded-xl bg-panel-2 px-3 py-2">
              <dt className="text-xs text-mute">{t("Erro médio")}</dt>
              <dd className="font-display text-xl font-bold tabular text-mist">{record.mapePct.toFixed(1)}%</dd>
            </div>
            <div className="rounded-xl bg-panel-2 px-3 py-2">
              <dt className="text-xs text-mute">{t("Dentro do intervalo")}</dt>
              <dd className="font-display text-xl font-bold tabular text-mist">
                {percent(record.coverage)}
                <span className="ml-1 text-xs font-normal text-mute">{t("(objetivo {target})", { target: percent(nominal) })}</span>
              </dd>
            </div>
            <div className="rounded-xl bg-panel-2 px-3 py-2">
              <dt className="text-xs text-mute">{t("Últimas 4 semanas")}</dt>
              <dd className={`font-display text-xl font-bold ${view.trend == null ? "text-mute" : view.trend < -0.1 ? "text-good" : view.trend > 0.1 ? "text-coral" : "text-mist"}`}>
                {view.trend == null ? "—" : view.trend < -0.1 ? t("a melhorar") : view.trend > 0.1 ? t("a piorar") : t("estável")}
              </dd>
            </div>
          </dl>

          <WeeklyChart weeks={record.weekly} />

          {view.alerts.length ? (
            <div className="mt-3 rounded-xl border border-coral/40 bg-[#fde8e4] px-3 py-2 text-sm text-[#8a2c1d]" role="alert">
              <ul className="space-y-1">
                {view.alerts.map((alert) => (
                  <li key={alert.kind}>
                    {alert.kind === "coverage"
                      ? t("Alerta: nas últimas semanas {coverage} dos tempos caíram dentro do intervalo (objetivo {target}).", { coverage: percent(alert.coverage), target: percent(alert.nominal) })
                      : alert.kind === "bias"
                        ? alert.biasPct > 0
                          ? t("Alerta: nas últimas semanas as estimativas estão sistematicamente mais lentas do que os tempos reais ({pct}%).", { pct: signed(alert.biasPct) })
                          : t("Alerta: nas últimas semanas as estimativas estão sistematicamente mais rápidas do que os tempos reais ({pct}%).", { pct: signed(alert.biasPct) })
                        : t("Alerta: o erro das últimas semanas ({recent}%) subiu face às semanas anteriores ({before}%).", { recent: alert.recentPct.toFixed(1), before: alert.beforePct.toFixed(1) })}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">{t("Se persistir, o modelo mostrado pode voltar de imediato ao anterior (interruptor no servidor, sem nova versão do site).")}</p>
            </div>
          ) : null}

          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${status.learning ? "bg-[#fff1d6] text-[#7a4d00]" : "bg-panel-2 text-mist"}`}>
            {status.learning
              ? t("A aprender: {weeks} semanas e {reps} tempos deste atleta. As estimativas costumam estabilizar a partir de {settle} semanas com tempos registados; até lá os intervalos são largos de propósito.", {
                  weeks: Math.floor(status.weeks),
                  reps: status.reps,
                  settle: WEEKS_TO_SETTLE,
                })
              : t("{weeks} semanas e {reps} tempos deste atleta: o modelo já tem base para estimativas estáveis.", { weeks: Math.floor(status.weeks), reps: status.reps })}
          </p>

          {view.report?.items.length ? (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-mist">
                {CHAMPION === "estado"
                  ? t("O que aprendeu na semana de {date}", { date: formatDatePt(view.report.week).slice(0, 5) })
                  : t("O que o modelo de estado (em sombra) aprendeu na semana de {date}", { date: formatDatePt(view.report.week).slice(0, 5) })}
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mist">
                {view.report.items.map((item, index) => (
                  <li key={`${item.kind}-${index}`}>
                    <LearningLine item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {view.misses.length ? (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-mist">{t("Falhas recentes e porquê")}</h4>
              <ul className="mt-2 divide-y divide-line text-sm">
                {view.misses.map((item) => {
                  const cause = view.causes.get(item.id)!.cause;
                  const row = view.byLog.get(item.logId);
                  return (
                    <li key={item.id} className="grid gap-1 py-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                      <span className="text-mute">
                        {formatDatePt(item.date).slice(0, 5)}
                        {row ? <span className="block text-xs">{row.setShape}</span> : null}
                      </span>
                      <span>
                        <span className="tabular">
                          {t("Previsto {predicted}, real {real}", { predicted: formatRaceClock(item.meanS), real: formatRaceClock(item.actualS) })}
                        </span>
                        <span className="block text-mist">{t(CAUSE_LABEL[cause])}</span>
                        <span className="block text-xs text-mute">{t(CAUSE_ACTION[cause])}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {view.promotion && view.promotion.paired > 0 ? (
            <p className="mt-4 text-xs text-mute">
              {t("Em sombra: {challenger} — erro {b}% vs {a}% do atual em {n} reps comuns ({weeks} semanas).", {
                challenger: t(MODELS[CHALLENGER].label),
                a: view.promotion.champion.mapePct.toFixed(1),
                b: view.promotion.challenger.mapePct.toFixed(1),
                n: view.promotion.paired,
                weeks: view.promotion.weeks,
              })}{" "}
              {view.promotion.ready
                ? t("Já ganha nos dados reais: pode substituir o modelo atual.")
                : t("Só substitui o atual com pelo menos {reps} reps em {weeks} semanas e uma vantagem clara.", { reps: 200, weeks: 6 })}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
