"use client";

import { COURSE_LABEL, STROKE_LABEL, STROKES } from "@/lib/labels";
import { RACE_DISTANCES, sessionTitle } from "@/lib/race";
import type { PoolCourse, RaceSession, Stroke } from "@/lib/types";

export type RaceFilters = {
  athleteId: string;
  stroke: Stroke | "";
  distanceM: number | "";
  course: PoolCourse | "";
  tournament: string;
  sessionId: string;
};

export const EMPTY_FILTERS: RaceFilters = {
  athleteId: "",
  stroke: "",
  distanceM: "",
  course: "",
  tournament: "",
  sessionId: "",
};

export function RaceFilterBar({
  athletes,
  sessions,
  value,
  onChange,
  hideAthlete = false,
}: {
  athletes: { id: string; name: string }[];
  sessions: RaceSession[];
  value: RaceFilters;
  onChange: (next: RaceFilters) => void;
  hideAthlete?: boolean;
}) {
  function set<K extends keyof RaceFilters>(key: K, next: RaceFilters[K]) {
    const patch = { ...value, [key]: next };
    if (key !== "sessionId") patch.sessionId = "";
    onChange(patch);
  }
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {hideAthlete ? null : (
          <select className="field !py-2.5" value={value.athleteId} onChange={(e) => set("athleteId", e.target.value)}>
            <option value="">Todos os atletas</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        )}
        <select className="field !py-2.5" value={value.stroke} onChange={(e) => set("stroke", e.target.value as Stroke | "")}>
          <option value="">Todos os estilos</option>
          {STROKES.map((stroke) => (
            <option key={stroke} value={stroke}>
              {STROKE_LABEL[stroke]}
            </option>
          ))}
        </select>
        <select
          className="field !py-2.5"
          value={value.distanceM}
          onChange={(e) => set("distanceM", e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Todas as distâncias</option>
          {RACE_DISTANCES.map((item) => (
            <option key={item} value={item}>
              {item} m
            </option>
          ))}
        </select>
        <select className="field !py-2.5" value={value.course} onChange={(e) => set("course", e.target.value as PoolCourse | "")}>
          <option value="">Qualquer piscina</option>
          <option value="scm">{COURSE_LABEL.scm}</option>
          <option value="lcm">{COURSE_LABEL.lcm}</option>
        </select>
        <input
          className="field !py-2.5"
          placeholder="Torneio"
          value={value.tournament}
          onChange={(e) => set("tournament", e.target.value)}
        />
        <select className="field !py-2.5" value={value.sessionId} onChange={(e) => set("sessionId", e.target.value)}>
          <option value="">Primeira sessão</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {sessionTitle(session, athletes.find((item) => item.id === session.athleteId)?.name)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
