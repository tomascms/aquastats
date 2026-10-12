"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import { fractionsFromSplits, levelOfPoints, referenceFractions, splitPlan } from "@/lib/indicators";
import { formatEvent } from "@/lib/labels";
import { parseTime } from "@/lib/race-analysis";
import { finaPoints } from "@/lib/rankings";
import { personalRecords } from "@/lib/records";
import { useAppState } from "@/lib/store";
import type { Athlete } from "@/lib/types";

/*
 * "Que tempo e que parciais pedir?" — race preparation from the athlete's own races (docs/natacao/produto-treinador.md §D).
 * The split shape comes from the athlete's best race with splits, else from the reference shape (referencias §2.4).
 */

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m ? `${m}:${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
};

export function RacePlan({ athlete }: { athlete: Athlete }) {
  const t = useT();
  const { competitions, meetEntries, meetResults } = useAppState();
  const gender = athlete.gender === "M" || athlete.gender === "F" ? athlete.gender : undefined;

  const events = useMemo(() => {
    const records = personalRecords(competitions, meetEntries, meetResults, athlete.id, athlete.seedRecords);
    return records
      .filter((r) => r.distanceM >= 100)
      .map((r) => {
        const timeS = r.mm * 60 + r.ss + r.cc / 100;
        const splits = r.splits?.length ? r.splits : (meetResults.find((m) => m.id === r.resultId)?.splits ?? []);
        return { key: `${r.course}:${r.stroke}:${r.distanceM}`, ...r, timeS, splits, points: finaPoints(timeS, r.course, r.stroke, r.distanceM, gender) };
      })
      .sort((a, b) => b.points - a.points);
  }, [competitions, meetEntries, meetResults, athlete, gender]);

  const [eventKey, setEventKey] = useState("");
  const [target, setTarget] = useState("");
  const event = events.find((e) => e.key === eventKey) ?? events[0];
  if (!event) return null;

  const targetS = parseTime(target) || event.timeS;
  const own = fractionsFromSplits(event.splits, event.distanceM);
  const plan = splitPlan(targetS, own ?? referenceFractions(event.distanceM));
  const points = finaPoints(targetS, event.course, event.stroke, event.distanceM, gender);
  const gap = targetS - event.timeS;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby="plano-prova-titulo">
      <h2 id="plano-prova-titulo" className="font-display text-2xl font-bold">
        {t("Que tempo e que parciais pedir?")}
      </h2>
      <p className="mt-1 text-sm text-mute">{t("Plano de prova a partir das provas do atleta.")}</p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-mute">{t("Prova")}</span>
          <select
            className="mt-1 rounded-lg border border-line bg-panel px-2 py-1.5"
            value={event.key}
            onChange={(e) => {
              setEventKey(e.target.value);
              setTarget("");
            }}
          >
            {events.map((e) => (
              <option key={e.key} value={e.key}>
                {formatEvent(e.distanceM, e.stroke)} {e.course === "lcm" ? "PL" : "PC"} · {clock(e.timeS)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-mute">{t("Tempo-alvo")}</span>
          <input
            className="mt-1 w-28 rounded-lg border border-line bg-panel px-2 py-1.5 tabular-nums"
            inputMode="decimal"
            placeholder={clock(event.timeS)}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-mute">{t("Melhor tempo")}</dt>
          <dd className="font-semibold tabular-nums">{clock(event.timeS)}</dd>
        </div>
        <div>
          <dt className="text-xs text-mute">{t("Diferença ao melhor")}</dt>
          <dd className="font-semibold tabular-nums">
            {gap >= 0 ? "+" : ""}
            {gap.toFixed(2)} s ({((gap / event.timeS) * 100).toFixed(1)} %)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-mute">{t("Pontos do alvo")}</dt>
          <dd className="font-semibold">{points ? `${points} · ${t(levelOfPoints(points) as MessageKey)}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-mute">{t("Ritmo médio")}</dt>
          <dd className="font-semibold tabular-nums">{clock((targetS / event.distanceM) * 100)} /100 m</dd>
        </div>
      </dl>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-xs tabular-nums sm:text-sm">
          <caption className="text-left text-xs text-mute">
            {own ? t("Distribuição dos parciais da melhor prova do atleta.") : t("Distribuição de referência (o atleta não tem parciais desta prova).")}
          </caption>
          <thead className="text-left text-xs text-mute">
            <tr>
              <th className="py-1 pr-3 font-medium">{t("Marca")}</th>
              <th className="py-1 pr-3 font-medium">{t("Parcial")}</th>
              <th className="py-1 font-medium">{t("Acumulado")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plan.map((row) => (
              <tr key={row.atM}>
                <td className="py-1 pr-3">{row.atM} m</td>
                <td className="py-1 pr-3">{clock(row.lapS)}</td>
                <td className="py-1">{clock(row.cumulativeS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-mute">
        {t("Um polimento bem feito vale em média 1–3 % (com grande variação entre atletas); diferenças abaixo de ~1 % são ruído.")}
      </p>
    </section>
  );
}
