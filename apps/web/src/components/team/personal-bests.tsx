"use client";

import { useRouter } from "next/navigation";
import { RaceResultSheet } from "@/components/competicoes/race-result-sheet";
import { useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { STROKE_LABEL, formatDatePt } from "@/lib/labels";
import { formatRaceClock } from "@/lib/race";
import { finaPoints, personalBests, raceRecords, type RaceRecord } from "@/lib/rankings";
import { useAppState } from "@/lib/store";
import type { Athlete, Competition, MeetEntry, MeetResult, PoolCourse, Stroke } from "@/lib/types";

/** SwimRankings order: stroke by stroke, each distance with the 25 m and the 50 m pool side by side. */
const LAYOUT: { stroke: Stroke; distances: number[] }[] = [
  { stroke: "free", distances: [50, 100, 200, 400, 800, 1500] },
  { stroke: "back", distances: [50, 100, 200] },
  { stroke: "breast", distances: [50, 100, 200] },
  { stroke: "fly", distances: [50, 100, 200] },
  { stroke: "im", distances: [100, 200, 400] },
];
const COURSES: PoolCourse[] = ["scm", "lcm"];

/**
 * Every personal best in one table: from meets in Aquastats (with all their details) and from the
 * SwimRankings profile (final time only). Clicking a time opens its details, or lets the coach add them.
 */
export function PersonalBests({ athlete, role }: { athlete: Athlete; role: "coach" | "swimmer" }) {
  const t = useT();
  const router = useRouter();
  const { competitions, meetEntries, meetResults, raceSessions } = useAppState();
  const best = useMemo(
    () => personalBests(raceRecords(competitions, meetEntries, meetResults, raceSessions, athlete.id, athlete.seedRecords)),
    [athlete.id, athlete.seedRecords, competitions, meetEntries, meetResults, raceSessions],
  );
  const [detailFor, setDetailFor] = useState<RaceRecord | null>(null);
  const seedOf = (record: RaceRecord) =>
    (athlete.seedRecords ?? []).find((seed) => seed.course === record.course && seed.stroke === record.stroke && seed.distanceM === record.distanceM);

  function open(record: RaceRecord) {
    if (record.competitionId) {
      if (role === "coach") router.push(`/coach/competicoes/${record.competitionId}/resultados/${record.entryId}`);
      return;
    }
    // A best time from SwimRankings: the same race sheet as a meet (reaction, 15 m, underwater, splits…),
    // right here. No competition is created.
    setDetailFor(record);
  }

  if (!best.length) {
    return <p className="px-4 py-5 text-sm text-mute">{t("Ainda não há recordes pessoais.")}</p>;
  }

  return (
    <div>
      <PbGrid
        bests={best}
        gender={athlete.gender}
        isFromProfile={(record) => !record.competitionId && seedOf(record)?.source === "swimrankings"}
        canOpen={(record) => role === "coach" || !record.competitionId}
        titleFor={(record) => (record.competitionId ? t("Ver detalhes") : role === "coach" ? t("Adicionar detalhes da prova") : t("Ver detalhes da prova"))}
        onOpen={open}
      />
      {detailFor ? (
        <RecordDetails key={detailFor.id} athlete={athlete} record={detailFor} role={role} onClose={() => setDetailFor(null)} />
      ) : null}
      <p className="px-4 py-2 text-[11px] text-mute">
        {role === "coach"
          ? t("Carrega num tempo para ver ou juntar os detalhes da prova (reação, 15 m, subaquático, parciais…). SR = tempo vindo do SwimRankings.")
          : t("Carrega num tempo para ver os detalhes da prova, se o treinador já os tiver adicionado. SR = tempo vindo do SwimRankings.")}
      </p>
    </div>
  );
}

/**
 * The personal-best grid (SwimRankings layout): stroke sections, one row per distance, the 25 m and
 * 50 m pools side by side with time, FINA points and date. Shared by the athlete page and race analysis.
 */
export function PbGrid({
  bests,
  gender,
  onOpen,
  onOpenEvent,
  canOpen = () => true,
  isFromProfile = () => false,
  titleFor,
}: {
  bests: RaceRecord[];
  gender?: "M" | "F" | "";
  onOpen: (record: RaceRecord) => void;
  onOpenEvent?: (stroke: Stroke, distanceM: number) => void;
  canOpen?: (record: RaceRecord) => boolean;
  isFromProfile?: (record: RaceRecord) => boolean;
  titleFor?: (record: RaceRecord) => string;
}) {
  const t = useT();
  const find = (course: PoolCourse, stroke: Stroke, distanceM: number) =>
    bests.find((record) => record.course === course && record.stroke === stroke && record.distanceM === distanceM);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm tabular">
        <thead>
          <tr className="bg-panel-2 text-[11px] font-semibold uppercase tracking-wide text-mute">
            <th className="px-4 py-1.5 text-left">{t("Prova")}</th>
            {COURSES.map((course) => (
              <th key={course} colSpan={3} className="border-l border-line px-3 py-1.5 text-center">
                {course === "scm" ? "25 m" : "50 m"}
              </th>
            ))}
          </tr>
          <tr className="bg-panel-2 text-[10px] font-semibold uppercase tracking-wide text-mute">
            <th />
            {COURSES.map((course) => (
              <FragmentHeaders key={course} />
            ))}
          </tr>
        </thead>
        {LAYOUT.map(({ stroke, distances }) => {
          const rows = distances.filter((distance) => COURSES.some((course) => find(course, stroke, distance)));
          if (!rows.length) return null;
          return (
            <tbody key={stroke}>
              <tr className="bg-aqua-soft">
                <th colSpan={7} className="px-4 py-1 text-left text-xs font-bold text-aqua">
                  {STROKE_LABEL[stroke]}
                </th>
              </tr>
              {rows.map((distance) => (
                <tr key={distance} className="border-t border-line">
                  <td className="px-4 py-1.5 font-semibold text-mist">
                    {onOpenEvent ? (
                      <button type="button" className="hover:text-pool hover:underline" onClick={() => onOpenEvent(stroke, distance)}>
                        {distance} m
                      </button>
                    ) : (
                      `${distance} m`
                    )}
                  </td>
                  {COURSES.map((course) => {
                    const record = find(course, stroke, distance);
                    if (!record) {
                      return (
                        <td key={course} colSpan={3} className="border-l border-line px-3 py-1.5 text-center text-mute">
                          —
                        </td>
                      );
                    }
                    const points = finaPoints(record.timeS, course, stroke, distance, gender);
                    return (
                      <FragmentCells key={course}>
                        <td className="border-l border-line px-3 py-1.5 text-right">
                          {canOpen(record) ? (
                            <button
                              type="button"
                              onClick={() => onOpen(record)}
                              title={titleFor?.(record)}
                              className="font-mono font-bold text-pool hover:underline"
                            >
                              {formatRaceClock(record.timeS)}
                            </button>
                          ) : (
                            <span className="font-mono font-bold text-mist">{formatRaceClock(record.timeS)}</span>
                          )}
                          {isFromProfile(record) ? <span className="ml-1 text-[9px] font-semibold text-mute">SR</span> : null}
                        </td>
                        <td className="px-2 py-1.5 text-right text-mute">{points || "—"}</td>
                        <td className="px-2 py-1.5 text-mute">{record.date ? formatDatePt(record.date) : "—"}</td>
                      </FragmentCells>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
function FragmentHeaders() {
  const t = useT();
  return (
    <>
      <th className="border-l border-line px-3 py-1 text-right">{t("Tempo")}</th>
      <th className="px-2 py-1 text-right">{t("Pts")}</th>
      <th className="px-2 py-1 text-left">{t("Data")}</th>
    </>
  );
}

function FragmentCells({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** The meet race sheet for a best time that has no competition in Aquastats (e.g. from SwimRankings).
 * Only the coach can add or change these details; an athlete can only view what's already there. */
export function RecordDetails({
  athlete,
  record,
  role,
  onClose,
}: {
  athlete: Athlete;
  record: RaceRecord;
  role: "coach" | "swimmer";
  onClose: () => void;
}) {
  const t = useT();
  const { raceSessions } = useAppState();
  const seed = (athlete.seedRecords ?? []).find((item) => item.course === record.course && item.stroke === record.stroke && item.distanceM === record.distanceM);
  const date = record.date || new Date().toISOString().slice(0, 10);
  const meet: Competition = {
    id: "",
    title: record.meetTitle || seed?.meet || t("Recorde pessoal"),
    date,
    endDate: date,
    course: record.course,
    venue: record.venue || "",
    athleteIds: [athlete.id],
  };
  const entry: MeetEntry = { id: "", competitionId: "", athleteId: athlete.id, stroke: record.stroke, distanceM: record.distanceM };
  const hundredths = Math.round(record.timeS * 100);
  const result: MeetResult = {
    id: "",
    entryId: "",
    mm: Math.floor(hundredths / 6000),
    ss: Math.floor((hundredths % 6000) / 100),
    cc: hundredths % 100,
    splits: seed?.splits ?? [],
    recordedAt: "",
  };
  // Details already added for this best time (same event, pool and day, outside any competition).
  const existing = raceSessions.find(
    (item) =>
      item.athleteId === athlete.id &&
      !item.competitionId &&
      item.stroke === record.stroke &&
      item.distanceM === record.distanceM &&
      item.course === record.course &&
      item.date === date,
  );
  if (role !== "coach" && !existing) {
    return (
      <div className="space-y-2 border-t border-line bg-panel-2 p-3">
        <div className="flex justify-end">
          <button type="button" className="btn-ghost h-9" onClick={onClose}>
            {t("Fechar")}
          </button>
        </div>
        <p className="text-sm text-mute">{t("Ainda sem detalhes desta prova. Só o treinador pode adicioná-los.")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t border-line bg-panel-2 p-3">
      <div className="flex justify-end">
        <button type="button" className="btn-ghost h-9" onClick={onClose}>
          {t("Fechar")}
        </button>
      </div>
      <RaceResultSheet meet={meet} entry={entry} athleteName={athlete.name} existing={existing} result={result} mode={role === "coach" ? "edit" : "view"} />
    </div>
  );
}
