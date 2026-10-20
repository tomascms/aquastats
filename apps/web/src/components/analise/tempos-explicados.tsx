"use client";

import { useMemo, useState } from "react";
import { useSay } from "@/components/analise/coach-text";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/provider";
import { addDays } from "@/lib/dates";
import {
  abnormalDays,
  breakdown,
  loadPoints,
  pctText,
  profileLines,
  readWeeks,
  secText,
  sessionKey,
  weeklyKm,
  type ExplainedRep,
  type WeekRead,
  type Who,
} from "@/lib/explained-times";
import { formatDatePt } from "@/lib/labels";
import { formatSeconds } from "@/lib/race";
import { raceRecords } from "@/lib/rankings";
import { useAppState } from "@/lib/store";
import { annotateTrainingReps, isPlausibleRep } from "@/lib/training-context";
import { explainTrainingTargets, learnedPatterns, MIN_FACTOR_SUPPORT } from "@/lib/training-prediction";
import type { Athlete } from "@/lib/types";
import { StateLegend } from "./tempos-reps";

/** 26 weeks shown, plus the 6 weeks each usual time looks back on. */
const SHOWN_DAYS = 182;
const LOOKBACK_DAYS = 42;

const WEEK_TITLE: Record<WeekRead["state"], Record<Who, MessageKey>> = {
  slower: { F: "Semana mais lenta do que o costume", M: "Semana mais lenta do que o costume", "": "Semana mais lenta do que o costume" },
  faster: { F: "Semana mais rápida do que o costume", M: "Semana mais rápida do que o costume", "": "Semana mais rápida do que o costume" },
  normal: { F: "Semana normal para ela", M: "Semana normal para ele", "": "Semana normal para o atleta" },
};
const WHAT_GOES: Record<Who, MessageKey> = {
  F: "O que costuma coincidir com os tempos dela",
  M: "O que costuma coincidir com os tempos dele",
  "": "O que costuma coincidir com os tempos do atleta",
};
const TAGS_NOTE: Record<Who, MessageKey> = {
  F: "Nos registos dela, a laranja o que costuma coincidir com tempos mais lentos; a verde, com mais rápidos.",
  M: "Nos registos dele, a laranja o que costuma coincidir com tempos mais lentos; a verde, com mais rápidos.",
  "": "Nos registos do atleta, a laranja o que costuma coincidir com tempos mais lentos; a verde, com mais rápidos.",
};

/** Summary on the athlete's profile: the week's card, the season as one dot per week, and what usually goes with the times. */
export function TemposExplicados({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const say = useSay();
  const { workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const who: Who = athlete.gender ?? "";

  const data = useMemo(() => {
    const wellness = athlete.wellness ?? [];
    const all = annotateTrainingReps(workouts, timeLogs, athlete.id, wellness).filter(isPlausibleRep);
    const last = all.reduce((max, row) => (row.date > max ? row.date : max), "");
    if (!last) return null;
    const from = addDays(last, -SHOWN_DAYS);
    const rows = all.filter((row) => row.date >= addDays(from, -LOOKBACK_DAYS));
    const explained = explainTrainingTargets(rows);
    const list: ExplainedRep[] = rows.filter((row) => row.date >= from && explained.has(row.log.id)).map((row) => ({ ...explained.get(row.log.id)!, row }));
    const days = new Set(all.map((row) => row.date));
    const shown = rows.filter((row) => row.date >= from);
    // ponytail: margin ≈ ± 2 residual SD / √(sessions with the factor); ignores the ridge shrinkage. Bootstrap by session if it matters.
    const { effects, residualSd } = learnedPatterns(shown);
    const repsPerSession = shown.length / Math.max(1, new Set(shown.map(sessionKey)).size);
    const profile = effects
      .filter((effect) => effect.support >= MIN_FACTOR_SUPPORT)
      .map((effect) => ({ ...effect, marginPct: (200 * residualSd) / Math.sqrt(Math.max(1, effect.support / repsPerSession)) }));
    const paces = shown.map((row) => (row.timeS / row.distanceM) * 100).sort((a, b) => a - b);
    const name = athlete.name.trim();
    return {
      list,
      weeks: readWeeks(list, days),
      abnormal: abnormalDays(list),
      profile,
      lines: profileLines(profile, loadPoints(list, weeklyKm(workouts, athlete.id)), paces[Math.floor(paces.length / 2)] ?? 0, who, name),
      races: raceRecords(competitions, meetEntries, meetResults, raceSessions, athlete.id, athlete.seedRecords).filter((race) => race.date >= from && race.date <= last),
    };
  }, [athlete, workouts, timeLogs, competitions, meetEntries, meetResults, raceSessions, who]);

  const [picked, setPicked] = useState<string | null>(null);

  if (!data || !data.weeks.length) {
    return (
      <Section>
        <p className="mt-2 text-sm text-mute">{t("Ainda sem tempos suficientes para comparar com o costume.")}</p>
      </Section>
    );
  }
  const week = data.weeks.find((item) => item.week === picked) ?? data.weeks[data.weeks.length - 1];
  const b = breakdown(data.list.filter((rep) => rep.row.date >= week.week && rep.row.date <= addDays(week.week, 6)));
  const s = Math.round(Math.abs(week.per100S) * 10) / 10;

  return (
    <Section>
      <article id="semana" className="mt-4 rounded-2xl border border-line p-4 sm:p-5" aria-live="polite">
        <p className="text-xs text-mute">{t("Semana de {date}", { date: formatDatePt(week.week) })}</p>
        <h3 className={`font-display text-xl font-bold ${week.state === "slower" ? "text-slower" : week.state === "faster" ? "text-good" : ""}`}>{t(WEEK_TITLE[week.state][who])}</h3>
        <p className="mt-0.5 text-[15px] text-mist">
          {week.state === "normal"
            ? t("dentro do habitual, nada a explicar")
            : say({ key: week.state === "slower" ? "em média {s} s mais lenta por 100 m" : "em média {s} s mais rápida por 100 m", vars: { s } })}
        </p>
        {week.reasons.length ? (
          <>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("O que costuma coincidir")}>
              {week.reasons.map((reason) => (
                <li key={reason.key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${reason.slower ? "bg-slower-soft text-slower" : "bg-good-soft text-good"}`}>
                  <span aria-hidden>{reason.slower ? "▼" : "▲"}</span>
                  {say(reason.msg)}
                  <span className="sr-only">{reason.slower ? t("(costuma coincidir com mais lento)") : t("(costuma coincidir com mais rápido)")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-mute">
              {t(TAGS_NOTE[who])}
              {week.noSleep ? ` ${t("Sono não registado.")}` : ""}
            </p>
          </>
        ) : null}
      </article>

      <div className="mt-4">
        <h3 className="font-display text-lg font-bold">{t("A época, semana a semana")}</h3>
        <SeasonDots weeks={data.weeks} races={data.races} selected={week.week} onPick={setPicked} />
        <div className="mt-1">
          <StateLegend who={who} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="font-display text-lg font-bold">{t(WHAT_GOES[who])}</h3>
        {data.lines.length ? (
          <ul className="mt-2 space-y-1.5 text-[15px] text-mist">
            {data.lines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-mute">
                  •
                </span>
                {say(line)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mute">{t("Ainda sem dados suficientes para dizer o que costuma coincidir com os tempos.")}</p>
        )}
        <p className="mt-2 text-xs text-mute">{t("Associações nos registos do atleta, não causas.")}</p>
      </div>

      <details className="mt-4 overflow-x-auto text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-mute">{t("Ver detalhes")}</summary>
        {b ? (
          <DetailsTable
            caption={t("Semana de {date}: decomposição do modelo", { date: formatDatePt(week.week) })}
            head={[t("Parte"), t("s por rep"), "%", t("Aprendido em (reps)")]}
            rows={[
              [t("Nível habitual"), formatSeconds(b.levelS / b.reps), "—", "—"],
              ...b.factors.map((factor) => [factor.label, secText(factor.seconds / b.reps), pctText(factor.pct), String(factor.support)]),
              [t("Esperado (± margem)"), `${formatSeconds(b.expectedS / b.reps)} ± ${secText(b.marginS / b.reps).replace("+", "")}`, pctText((b.expectedS / b.levelS - 1) * 100), "—"],
              [t("Real"), formatSeconds(b.actualS / b.reps), pctText(b.devPct), "—"],
              [t("Sem explicação"), secText(b.unexplainedS / b.reps), pctText((b.unexplainedS / b.levelS) * 100), "—"],
            ]}
          />
        ) : null}
        <DetailsTable
          caption={t("Semanas")}
          head={[t("Semana"), t("s por 100 m"), "%", t("Reps")]}
          rows={data.weeks.map((item) => [formatDatePt(item.week), secText(item.per100S), pctText(item.pct), String(item.n)])}
        />
        <DetailsTable
          caption={t("Fatores aprendidos")}
          head={[t("Fator"), "%", t("Margem"), t("Reps")]}
          rows={[...data.profile].sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct)).map((effect) => [effect.label, pctText(effect.pct), `± ${pctText(effect.marginPct).replace("+", "")}`, String(effect.support)])}
        />
        <ul className="mt-2 space-y-0.5 text-xs text-mute">
          <li>{t("Normal = diferença abaixo de 1 % face ao habitual (mediana ponderada das reps iguais anteriores).")}</li>
          <li>{t("Só aparecem fatores aprendidos em 8 ou mais reps e associações fora da margem. A parte de contexto do modelo não passou no backtest.")}</li>
          {data.abnormal.length ? <li>{t("Dias fora do normal (todas as reps no mesmo sentido): {days}.", { days: data.abnormal.map((day) => formatDatePt(day).slice(0, 5)).join(", ") })}</li> : null}
        </ul>
      </details>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <section id="tempos" className="rounded-2xl border border-line bg-panel p-4 sm:p-5" aria-labelledby="tempos-titulo">
      <h2 id="tempos-titulo" className="font-display text-xl font-bold">
        {t("Tempos explicados")}
      </h2>
      {children}
    </section>
  );
}

function DetailsTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <table className="mt-3 w-full text-[13px] tabular-nums">
      <caption className="text-left text-xs font-semibold text-mist">{caption}</caption>
      <thead>
        <tr className="text-left text-xs text-mute">
          {head.map((cell, i) => (
            <th key={i} scope="col" className={`py-1 font-medium ${i ? "pl-2 text-right" : ""}`}>
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-t border-line">
            {row.map((cell, i) => (
              <td key={i} className={`py-1 ${i ? "pl-2 text-right" : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DOT_FILL: Record<WeekRead["state"], string> = { faster: "fill-good", normal: "fill-line-strong", slower: "fill-slower" };

/** D. One dot per week in its state's colour; faster is up. Tapping a week opens its card. */
function SeasonDots({ weeks, races, selected, onPick }: { weeks: WeekRead[]; races: { date: string }[]; selected: string; onPick: (week: string) => void }) {
  const t = useT();
  const say = useSay();
  const W = 640;
  const H = 150;
  const first = Date.parse(weeks[0].week);
  const last = Date.parse(weeks[weeks.length - 1].week);
  const x = (iso: string) => 20 + ((Date.parse(iso) - first) / Math.max(1, last - first)) * (W - 40);
  const span = Math.max(1, ...weeks.map((week) => Math.abs(week.per100S)));
  const y = (s: number) => 20 + ((Math.max(-span, Math.min(span, s)) + span) / (2 * span)) * (H - 44);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="group" aria-label={t("Uma bola por semana: mais rápido em cima. Toque numa semana para ver o cartão.")}>
      <line x1={20} x2={W - 20} y1={y(0)} y2={y(0)} className="stroke-line" />
      <text x={W - 20} y={y(0) - 4} textAnchor="end" className="fill-mute text-[10px]">
        {t("costume")}
      </text>
      {[...new Set(races.map((race) => race.date))].map((date) => (
        <path key={date} d={`M${x(date) - 4},4 L${x(date) + 4},4 L${x(date)},10 Z`} className="fill-mute">
          <title>{t("prova")}</title>
        </path>
      ))}
      {weeks.map((week) => {
        const s = Math.round(Math.abs(week.per100S) * 10) / 10;
        const label = say({
          key: week.state === "normal" ? "Semana de {date}: normal" : week.state === "slower" ? "Semana de {date}: {s} s mais lenta por 100 m" : "Semana de {date}: {s} s mais rápida por 100 m",
          vars: { date: formatDatePt(week.week), s },
        });
        return (
          <g
            key={week.week}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={week.week === selected}
            className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-pool"
            onClick={() => onPick(week.week)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPick(week.week);
              }
            }}
          >
            <title>{label}</title>
            <circle cx={x(week.week)} cy={y(week.per100S)} r={14} fill="transparent" />
            <circle cx={x(week.week)} cy={y(week.per100S)} r={week.week === selected ? 9 : 6} className={`${DOT_FILL[week.state]} stroke-mist`} strokeWidth={week.week === selected ? 2.5 : 0} />
          </g>
        );
      })}
      {weeks.filter((_, i) => i % 4 === 0).map((week) => (
        <text key={week.week} x={x(week.week)} y={H - 4} textAnchor="middle" className="fill-mute text-[10px]">
          {formatDatePt(week.week).slice(0, 5)}
        </text>
      ))}
    </svg>
  );
}
