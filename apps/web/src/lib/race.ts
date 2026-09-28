import { tx, type MessageKey } from "@/i18n";
import { COURSE_LABEL, DAY_PART_LABEL, STROKE_LABEL } from "./labels";
import type { DayPart, PoolCourse, RaceLap, RaceSession, Stroke } from "./types";

export const RACE_DISTANCES = [25, 50, 100, 200, 400, 800, 1500] as const;

export { DAY_PART_LABEL };

export function poolLength(course: PoolCourse): 25 | 50 {
  return course === "lcm" ? 50 : 25;
}

export function lapCount(distanceM: number, course: PoolCourse): number {
  return Math.max(1, Math.round(distanceM / poolLength(course)));
}

export const DETAIL_OFFSETS = [15, 25, 35, 45, 50] as const;
export type MarkOffset = (typeof DETAIL_OFFSETS)[number];

export function isDetailedRace(distanceM: number): boolean {
  return distanceM <= 200;
}

export function raceBlocks(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / 50));
}

export function lengthOffsets(course: PoolCourse): readonly number[] {
  // A 25 m pool has no room for 35/45; 20 (5 m before the wall) takes 45's slot instead, so the
  // last 5 m of every length is always captured, in a 25 m pool just as in a 50 m one.
  return course === "lcm" ? DETAIL_OFFSETS : ([15, 20, 25] as const);
}

export function raceMarks(distanceM: number, course: PoolCourse): number[] {
  if (isDetailedRace(distanceM)) {
    const pool = poolLength(course);
    const marks: number[] = [];
    for (let base = 0; base < distanceM; base += pool) {
      for (const offset of lengthOffsets(course)) {
        const at = base + offset;
        if (offset <= pool && at <= distanceM) marks.push(at);
      }
    }
    return marks;
  }
  return Array.from({ length: raceBlocks(distanceM) }, (_, index) => (index + 1) * 50);
}

export function markMeta(atM: number, course: PoolCourse, distanceM: number): { lapIndex: number; offset: MarkOffset } {
  if (!isDetailedRace(distanceM)) {
    return { lapIndex: Math.max(0, Math.round(atM / 50) - 1), offset: 50 };
  }
  const pool = poolLength(course);
  const lapIndex = Math.max(0, Math.floor((Math.max(1, atM) - 1) / pool));
  const raw = atM - lapIndex * pool;
  // 20 (a 25 m pool's "5 m before the wall") has no literal slot of its own: it reuses 45's, the
  // same slot a 50 m pool's own "5 m before the wall" mark already uses.
  const offset = (raw === 20 ? 45 : DETAIL_OFFSETS.includes(raw as MarkOffset) ? raw : pool) as MarkOffset;
  return { lapIndex, offset };
}

export function strokeAtMark(eventStroke: Stroke, distanceM: number, atM: number): Stroke {
  if (eventStroke !== "im") return eventStroke;
  const legs: Stroke[] = ["fly", "back", "breast", "free"];
  const legM = Math.max(25, distanceM / 4);
  const index = Math.min(3, Math.floor((Math.max(1, atM) - 1) / legM));
  return legs[index];
}

export function strokeRateFromCount(sc: number, sectorS: number, stroke: Stroke): number {
  if (sc <= 0 || sectorS <= 0) return 0;
  const cycles = stroke === "free" || stroke === "back" ? sc / 2 : sc;
  return Math.round((cycles / sectorS) * 60 * 10) / 10;
}

export function timeKeyForOffset(offset: MarkOffset): keyof RaceLap {
  if (offset === 15) return "sec15";
  if (offset === 25) return "sec25";
  if (offset === 35) return "sec35";
  if (offset === 45) return "sec45";
  return "sec50";
}

export function scKeyForOffset(offset: MarkOffset): keyof RaceLap {
  if (offset === 15) return "sc15";
  if (offset === 25) return "sc25";
  if (offset === 35) return "sc35";
  if (offset === 45) return "sc45";
  return "sc50";
}

export function srKeyForOffset(offset: MarkOffset): keyof RaceLap {
  if (offset === 15) return "sr15";
  if (offset === 25) return "sr25";
  if (offset === 35) return "sr35";
  if (offset === 45) return "sr45";
  return "sr50";
}

export function roundHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

export function markTime(laps: RaceLap[], atM: number, course: PoolCourse, distanceM: number): number {
  const { lapIndex, offset } = markMeta(atM, course, distanceM);
  const lap = laps[lapIndex];
  if (!lap) return 0;
  return Number(lap[timeKeyForOffset(offset)]) || 0;
}

export function markSc(laps: RaceLap[], atM: number, course: PoolCourse, distanceM: number): number {
  const { lapIndex, offset } = markMeta(atM, course, distanceM);
  const lap = laps[lapIndex];
  if (!lap) return 0;
  return Number(lap[scKeyForOffset(offset)]) || 0;
}

export function markSr(laps: RaceLap[], atM: number, course: PoolCourse, distanceM: number): number {
  const { lapIndex, offset } = markMeta(atM, course, distanceM);
  const lap = laps[lapIndex];
  if (!lap) return 0;
  return Number(lap[srKeyForOffset(offset)]) || 0;
}

export function sectorOf(marks: number[], times: number[], index: number): { from: number; value: number } {
  const from = index <= 0 ? 0 : marks[index - 1];
  const tempo = times[index] ?? 0;
  const previous = index <= 0 ? 0 : times[index - 1] ?? 0;
  if (!tempo || (index > 0 && !previous)) return { from, value: 0 };
  return { from, value: roundHundredths(tempo - previous) };
}

export function sectorLabel(from: number, to: number): string {
  if (!to) return "";
  return `${from}–${to}`;
}

export function officialFromLaps(laps: RaceLap[], distanceM: number, course: PoolCourse): number {
  return markTime(laps, distanceM, course, distanceM);
}

export function applyCalculatedLap(lap: RaceLap): RaceLap {
  // A 50 m pool's wall is sec50; a 25 m pool's is sec25 (sec50 stays unused there).
  const last5 =
    lap.sec50 > 0 && lap.sec45 > 0
      ? roundHundredths(lap.sec50 - lap.sec45)
      : lap.sec50 <= 0 && lap.sec25 > 0 && lap.sec45 > 0
        ? roundHundredths(lap.sec25 - lap.sec45)
        : lap.last5 || 0;
  return { ...lap, last5 };
}

export type RaceMarkRow = {
  atM: number;
  lapIndex: number;
  offset: MarkOffset;
  tempo: number;
  sector: number;
  sectorFrom: number;
  sectorLabel: string;
  sc: number;
  sr: number;
  uwKicks: number;
  uwd: number;
  breakS: number;
  showStart: boolean;
  showUw: boolean;
  showScSr: boolean;
  showNado: boolean;
  isTurn: boolean;
  isFinish: boolean;
  stroke: Stroke;
};

export function raceMarkRows(
  laps: RaceLap[],
  distanceM: number,
  course: PoolCourse,
  eventStroke: Stroke = "free",
): RaceMarkRow[] {
  const marks = raceMarks(distanceM, course);
  const times = marks.map((at) => markTime(laps, at, course, distanceM));
  const detailed = isDetailedRace(distanceM);
  const pool = poolLength(course);
  return marks.map((atM, index) => {
    const { lapIndex, offset } = markMeta(atM, course, distanceM);
    const lap = laps[lapIndex];
    const sector = sectorOf(marks, times, index);
    const isFifteen = detailed && offset === 15;
    const isFinish = atM === distanceM;
    const isTurn = atM % pool === 0 && atM < distanceM;
    const stroke = strokeAtMark(eventStroke, distanceM, atM);
    const sc = markSc(laps, atM, course, distanceM);
    return {
      atM,
      lapIndex,
      offset,
      tempo: times[index] ?? 0,
      sector: sector.value,
      sectorFrom: sector.from,
      sectorLabel: sectorLabel(sector.from, atM),
      sc,
      sr: isFifteen ? 0 : strokeRateFromCount(sc, sector.value, stroke),
      uwKicks: lap?.uwKicks ?? 0,
      uwd: lap?.uwd ?? 0,
      breakS: lap?.uw ?? 0,
      showStart: index === 0,
      showUw: isFifteen || (!detailed && index === 0),
      showScSr: !isFifteen,
      showNado: !(detailed && atM === 15),
      isTurn,
      isFinish,
      stroke,
    };
  });
}

export function emptyLap(n: number): RaceLap {
  return {
    n,
    uw: 0,
    uwd: 0,
    uwKicks: 0,
    sec15: 0,
    sec10: 0,
    sec25: 0,
    sec35: 0,
    sec45: 0,
    sec50: 0,
    last5: 0,
    sr: 0,
    sr1: 0,
    sr2: 0,
    sc: 0,
    sc15: 0,
    sr15: 0,
    sc25: 0,
    sr25: 0,
    sc35: 0,
    sr35: 0,
    sc45: 0,
    sr45: 0,
    sc50: 0,
    sr50: 0,
  };
}

export function normalizeLap(lap: Partial<RaceLap> | null | undefined, n = 1): RaceLap {
  return { ...emptyLap(n), ...(lap ?? {}), n: lap?.n || n };
}

export function setMarkTime(laps: RaceLap[], atM: number, course: PoolCourse, distanceM: number, sec: number): RaceLap[] {
  const { lapIndex, offset } = markMeta(atM, course, distanceM);
  return laps.map((lap, index) => (index === lapIndex ? { ...lap, [timeKeyForOffset(offset)]: sec } : lap));
}

export function writeCalculatedRates(laps: RaceLap[], distanceM: number, course: PoolCourse, stroke: Stroke): RaceLap[] {
  const rows = raceMarkRows(laps, distanceM, course, stroke);
  let next = laps;
  for (const row of rows) {
    const { lapIndex, offset } = markMeta(row.atM, course, distanceM);
    next = next.map((lap, index) => (index === lapIndex ? { ...lap, [srKeyForOffset(offset)]: row.sr } : lap));
  }
  return next;
}

export function emptyLaps(distanceM: number, course: PoolCourse = "lcm"): RaceLap[] {
  const count = isDetailedRace(distanceM) ? lapCount(distanceM, course) : raceBlocks(distanceM);
  return Array.from({ length: count }, (_, index) => emptyLap(index + 1));
}

export function hydrateLaps(existing: RaceLap[] | undefined, distanceM: number, course: PoolCourse): RaceLap[] {
  const blank = emptyLaps(distanceM, course);
  if (!existing?.length) return blank;
  if (
    course === "scm" &&
    isDetailedRace(distanceM) &&
    existing.length === raceBlocks(distanceM) &&
    blank.length === lapCount(distanceM, course)
  ) {
    return blank.map((lap, index) => {
      const old = existing[Math.floor(index / 2)];
      if (!old) return lap;
      if (index % 2 === 0) {
        return applyCalculatedLap(normalizeLap({ ...old, sec35: 0, sec45: 0, sec50: 0, n: lap.n }, lap.n));
      }
      return applyCalculatedLap(
        normalizeLap({ n: lap.n, sec25: old.sec50, sc25: old.sc50, sr25: old.sr50, uwd: old.uwd, uwKicks: old.uwKicks }, lap.n),
      );
    });
  }
  return blank.map((lap, index) => applyCalculatedLap(normalizeLap(existing[index], lap.n)));
}

export function lapTime(lap: RaceLap, course: PoolCourse): number {
  if (lap.sec50 > 0) return lap.sec50;
  if (lap.sec35 > 0) return lap.sec35;
  if (lap.sec25 > 0) return lap.sec25;
  if (course === "scm" && lap.sec15 > 0 && lap.sec10 > 0) return lap.sec15 + lap.sec10;
  if (lap.sec15 > 0) return lap.sec15;
  return 0;
}

export function srAvg(lap: RaceLap, course: PoolCourse): number {
  const rates = [lap.sr15, lap.sr25, lap.sr35, lap.sr45, lap.sr50, lap.sr, lap.sr1, lap.sr2].filter((value) => value > 0);
  if (rates.length) return rates.reduce((sum, value) => sum + value, 0) / rates.length;
  if (course === "scm") return lap.sr || 0;
  return 0;
}

export function swimTime(lap: RaceLap, course: PoolCourse): number {
  const tLap = lapTime(lap, course);
  if (tLap <= 0) return 0;
  return Math.max(0, tLap - (lap.uw || 0));
}

export type RaceLapView = RaceLap & {
  lapTime: number;
  swimTime: number;
  srAvg: number;
  velocity: number;
  dps: number;
  v15: number;
  v10: number;
  v25: number;
  v50: number;
};

export type RaceView = {
  session: RaceSession;
  laps: RaceLapView[];
  totalTime: number;
  avgSr: number;
  avgVelocity: number;
};

export function analyzeLap(lap: RaceLap, course: PoolCourse): RaceLapView {
  const pool = poolLength(course);
  const tLap = lapTime(lap, course);
  const tSwim = swimTime(lap, course);
  const rate = srAvg(lap, course);
  const velocity = tLap > 0 ? pool / tLap : 0;
  const dpsFromSr = rate > 0 && velocity > 0 ? (velocity * 60) / rate : 0;
  const strokeCount = [lap.sc15, lap.sc25, lap.sc35, lap.sc45, lap.sc50, lap.sc].filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const dpsFromSc = strokeCount > 0 ? pool / strokeCount : 0;
  const v15 = lap.sec15 > 0 ? 15 / lap.sec15 : 0;
  const v10 = lap.sec10 > 0 ? 10 / lap.sec10 : 0;
  const v25 = lap.sec25 > 0 ? 25 / lap.sec25 : 0;
  const secondHalf = lap.sec50 > 0 ? lap.sec50 : tLap > lap.sec25 + (lap.uw || 0) ? tLap - (lap.sec25 || 0) - (lap.uw || 0) : 0;
  const v50 = course === "lcm" && secondHalf > 0 ? 25 / secondHalf : 0;
  return {
    ...lap,
    sc: strokeCount || lap.sc,
    lapTime: tLap,
    swimTime: tSwim,
    srAvg: rate,
    velocity,
    dps: dpsFromSc || dpsFromSr,
    v15,
    v10,
    v25,
    v50,
  };
}

export function analyzeRace(session: RaceSession): RaceView {
  const padded = hydrateLaps(session.laps, session.distanceM, session.course);
  const laps = padded.map((lap) => analyzeLap(lap, session.course));
  const withSr = laps.filter((lap) => lap.srAvg > 0);
  const withV = laps.filter((lap) => lap.velocity > 0);
  const fromLaps = officialFromLaps(padded, session.distanceM, session.course);
  return {
    session,
    laps,
    totalTime: fromLaps > 0 ? fromLaps : session.officialTimeS || 0,
    avgSr: withSr.length ? withSr.reduce((sum, lap) => sum + lap.srAvg, 0) / withSr.length : 0,
    avgVelocity: withV.length ? withV.reduce((sum, lap) => sum + lap.velocity, 0) / withV.length : 0,
  };
}

export function sessionForEntry(
  sessions: RaceSession[],
  entry: { id: string; athleteId: string; stroke: Stroke; distanceM: number },
  competitionId: string,
): RaceSession | undefined {
  return (
    sessions.find((session) => session.entryId === entry.id) ??
    sessions.find(
      (session) =>
        session.competitionId === competitionId &&
        session.athleteId === entry.athleteId &&
        session.stroke === entry.stroke &&
        session.distanceM === entry.distanceM,
    )
  );
}

export function formatSeconds(value: number, digits = 2): string {
  if (!value || !Number.isFinite(value)) return "—";
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = value - minutes * 60;
    return `${minutes}:${seconds.toFixed(digits).padStart(digits + 3, "0")}`;
  }
  return `${value.toFixed(digits)} s`;
}

export function formatRaceClock(total: number): string {
  if (!total || !Number.isFinite(total)) return "—";
  const rounded = Math.round(total * 100);
  const minutes = Math.floor(rounded / 6000);
  const rest = rounded % 6000;
  const whole = Math.floor(rest / 100);
  const hundredths = rest % 100;
  if (minutes > 0) {
    return `${String(minutes).padStart(2, "0")}'${String(whole).padStart(2, "0")}"${String(hundredths).padStart(2, "0")}`;
  }
  return `${whole}"${String(hundredths).padStart(2, "0")}`;
}

export function eventLabel(session: Pick<RaceSession, "distanceM" | "stroke" | "course">): string {
  return `${session.distanceM} ${STROKE_LABEL[session.stroke]} · ${COURSE_LABEL[session.course]}`;
}

export function sessionTitle(session: RaceSession, athleteName?: string): string {
  const who = athleteName ? `${athleteName} — ` : "";
  return `${who}${eventLabel(session)} (${session.date}) ${formatRaceClock(analyzeRace(session).totalTime)}`;
}

export function filterRaces(
  sessions: RaceSession[],
  filters: {
    athleteId?: string;
    stroke?: Stroke | "";
    distanceM?: number | "";
    course?: PoolCourse | "";
    tournament?: string;
    sessionId?: string;
  },
): RaceSession[] {
  return sessions.filter((session) => {
    if (filters.athleteId && session.athleteId !== filters.athleteId) return false;
    if (filters.stroke && session.stroke !== filters.stroke) return false;
    if (filters.distanceM && session.distanceM !== filters.distanceM) return false;
    if (filters.course && session.course !== filters.course) return false;
    if (filters.tournament && !session.tournament.toLowerCase().includes(filters.tournament.toLowerCase())) return false;
    if (filters.sessionId && session.id !== filters.sessionId) return false;
    return true;
  });
}

function zone(id: string, code: string, name: MessageKey, pct: number, hr: string, hint: MessageKey) {
  return {
    id,
    code,
    pct,
    hr,
    get name() {
      return tx(name);
    },
    get hint() {
      return tx(hint);
    },
  };
}

export const ZONES = [
  zone("Z1", "EN1", "Aeróbio baixo", 1.22, "60–70%", "Suave, aquecimento e soltar."),
  zone("Z2", "EN2", "Aeróbio médio", 1.14, "70–80%", "Base de resistência."),
  zone("Z3", "EN3", "Limiar", 1.07, "80–90%", "Série exigente, ritmo de limiar."),
  zone("Z4", "SP1", "Tolerância", 1.03, "85–95%", "Lactato, séries curtas com descanso."),
  zone("Z5", "SP2", "VO2 máx.", 1.0, "90–100%", "Potência aeróbia máxima."),
  zone("Z6", "SP3", "Velocidade", 0.96, "95–100%", "Sprint explosivo."),
] as const;

export function pace100(totalS: number, distanceM: number): number {
  if (!totalS || !distanceM) return 0;
  return (totalS / distanceM) * 100;
}

export function scaleTime(totalS: number, fromM: number, toM: number): number {
  if (!totalS || !fromM) return 0;
  return totalS * (toM / fromM);
}

export type WhatIfStrategy = "constant" | "faster-start" | "stronger-finish";

export function whatIfLaps(view: RaceView, improvePct: number, strategy: WhatIfStrategy): number[] {
  const factor = 1 - improvePct / 100;
  const times = view.laps.map((lap) => lap.lapTime);
  if (!times.length) return [];
  if (strategy === "constant") return times.map((time) => time * factor);
  return times.map((time, index) => {
    const t = times.length <= 1 ? 0.5 : index / (times.length - 1);
    const bias = strategy === "faster-start" ? 1.18 - t * 0.36 : 0.82 + t * 0.36;
    const raw = time * (1 - (improvePct / 100) * bias);
    return Math.max(time * 0.85, raw);
  });
}

export function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportRacesCsv(sessions: RaceSession[], athleteName: (id: string) => string): void {
  const header = [
    tx("Atleta"),
    tx("Data"),
    tx("Torneio"),
    tx("Prova"),
    tx("Estilo"),
    tx("Piscina"),
    tx("Sessão"),
    tx("Tempo total"),
    tx("SR médio"),
    tx("V média"),
    tx("Reacção"),
    tx("Voo"),
  ];
  const rows = sessions.map((session) => {
    const view = analyzeRace(session);
    return [
      athleteName(session.athleteId),
      session.date,
      session.tournament,
      session.distanceM,
      STROKE_LABEL[session.stroke],
      COURSE_LABEL[session.course],
      DAY_PART_LABEL[session.dayPart],
      formatRaceClock(view.totalTime),
      view.avgSr.toFixed(1),
      view.avgVelocity.toFixed(3),
      session.reactionS,
      session.flightS,
    ];
  });
  const summary = [header, ...rows].map((line) => line.map(csvEscape).join(";")).join("\n");
  const lapSheets = sessions.map((session) => {
    const view = analyzeRace(session);
    const title = `${athleteName(session.athleteId)}_${session.date}_${session.distanceM}`;
    const lapHeader = ["#", "UW", "UWD", "Sec15", "Sec10", "Sec25", "Sec50", "SR", "SR1", "SR2", "SC", tx("T.Nado"), tx("T.Volta"), "V", "DPS"];
    const lapRows = view.laps.map((lap) => [
      lap.n,
      lap.uw,
      lap.uwd,
      lap.sec15,
      lap.sec10,
      lap.sec25,
      lap.sec50,
      lap.sr,
      lap.sr1,
      lap.sr2,
      lap.sc,
      lap.swimTime.toFixed(2),
      lap.lapTime.toFixed(2),
      lap.velocity.toFixed(3),
      lap.dps.toFixed(2),
    ]);
    return [`# ${title}`, lapHeader.join(";"), ...lapRows.map((line) => line.map(csvEscape).join(";"))].join("\n");
  });
  downloadText(`${tx("provas")}-${new Date().toISOString().slice(0, 10)}.csv`, [summary, "", ...lapSheets].join("\n\n"));
}
