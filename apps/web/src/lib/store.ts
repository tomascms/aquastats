"use client";

import { useEffect, useSyncExternalStore } from "react";
import { tx, txDynamic } from "@/i18n";
import { api, formatApiError, type ApiError } from "./api";
import { addDays, todayIso } from "./dates";
import { toast } from "./toast";
import {
  buildTimeDraft,
  flushAllTimeSaves as flushAllScheduledTimeSaves,
  isTimeComplete,
  scheduleTimeSave as enqueueTimeSave,
  timeQueueKey,
  type TimeSavePayload,
} from "./time-save";
import { sameMeters } from "./distances";
import { meetTitle, treinoTitle } from "./labels";
import { flattenInner, flatRepNumber, innerCount, persistDraft } from "./set";
import { analyzeRace } from "./race";
import { RECENT_DAYS, takeEarlySnapshot } from "./early-snapshot";
import {
  commitClockParts,
  EMPTY_PARTS,
  fromCentiseconds,
  hasClockTime,
  isEmptyParts,
  isValidSeconds,
  normalizeParts,
  partsFromNumbers,
} from "./swim-time";
import type {
  AppState,
  Athlete,
  AthleteInput,
  AttendanceSession,
  BlockType,
  CellRef,
  Competition,
  CompetitionInput,
  Goal,
  GoalInput,
  HrSession,
  MeetEntry,
  MeetResult,
  RaceSession,
  SeasonPlan,
  SeedRecord,
  SplitTime,
  Stroke,
  TimeLog,
  TimeParts,
  Workout,
  WellnessEntry,
  WorkoutInput,
} from "./types";

export type MeetFileOptions = {
  dryRun?: boolean;
  clubKey?: string;
  mapping?: Record<string, string>;
  competitionId?: string;
  /** Regulations creating a new competition: what the coach confirmed. */
  title?: string;
  course?: "scm" | "lcm";
  date?: string;
  endDate?: string;
};

export type SwimRankingsImport = {
  found: number;
  added: number;
  updated: number;
  kept: number;
  records: { course: string; stroke: string; distanceM: number; timeS: number; date: string | null; meet: string; action: "added" | "updated" | "kept" | "team" }[];
};

export type MeetFileSummary = {
  kind: "entries" | "results" | "rules";
  status: "needsClub" | "needsCompetition" | "ready" | "done";
  competition?: Competition;
  facts?: { label: string; value: string }[];
  meet: { name: string; city: string; course: "scm" | "lcm" | ""; date: string; endDate: string };
  clubs?: { key: string; name: string; code: string | null; athletes: number }[];
  club?: { key: string; name: string };
  competitionId?: string | null;
  competitionTitle?: string;
  createsCompetition?: boolean;
  athletes?: { name: string; events: number }[];
  unmatched?: { key: string; name: string; birthDate: string | null }[];
  teamAthletes?: { id: string; name: string }[];
  entries?: number;
  results?: number;
};

const LOCAL_KEYS =["swimanalytics-ui-v9", "swimanalytics-ui-v8"];
const PENDING_TIMES_KEY = "aquastats-pending-times-v1";

type Me = {
  id: string;
  role: "coach" | "swimmer" | "pending";
  teamName: string | null;
  teamId?: string | null;
  joinCode?: string | null;
  athleteId?: string | null;
  next?: string;
};

type Snapshot = {
  teamName: string;
  joinCode?: string | null;
  swimmerId?: string;
  athletes: Athlete[];
  workouts: Workout[];
  timeLogs: TimeLog[];
  competitions: Competition[];
  meetEntries: MeetEntry[];
  meetResults: MeetResult[];
  raceSessions?: RaceSession[];
  seasonPlans?: SeasonPlan[];
  attendance?: AttendanceSession[];
  goals?: Goal[];
  hrSessions?: HrSession[];
};

function emptyState(): AppState {
  return {
    role: null,
    swimmerId: "",
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    syncing: false,
    historyLoaded: false,
    teamName: "",
    joinCode: "",
    athletes: [],
    workouts: [],
    timeLogs: [],
    competitions: [],
    meetEntries: [],
    meetResults: [],
    raceSessions: [],
    seasonPlans: [],
    attendance: [],
    goals: [],
    hrSessions: [],
  };
}

let state: AppState = emptyState();
const serverState: AppState = emptyState();
let bootstrapped = false;
let bootError: string | null = null;
let pendingRetryTimer: number | null = null;
const listeners = new Set<() => void>();

function requiresAuthBootstrap() {
  if (typeof window === "undefined") return false;
  return ["/coach", "/swimmer", "/escolher"].some(
    (prefix) => window.location.pathname === prefix || window.location.pathname.startsWith(`${prefix}/`),
  );
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return serverState;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(patch: Partial<AppState> | ((current: AppState) => AppState)) {
  state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
  persistPendingTimes(state.timeLogs);
  emit();
}

function persistPendingTimes(logs: TimeLog[]) {
  if (typeof window === "undefined") return;
  const pending = logs.filter((log) => log.pending && (log.skipped || hasClockTime(log.mm, log.ss, log.cc) || (log.splits?.length ?? 0) > 0));
  if (pending.length) localStorage.setItem(PENDING_TIMES_KEY, JSON.stringify(pending));
  else localStorage.removeItem(PENDING_TIMES_KEY);
}

function restorePendingTimes() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PENDING_TIMES_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw) as TimeLog[];
    if (!Array.isArray(pending)) return;
    setState((current) => {
      const pendingKeys = new Set(pending.map((log) => timeLogKey(log)));
      return {
        ...current,
        timeLogs: [...current.timeLogs.filter((log) => !pendingKeys.has(timeLogKey(log))), ...pending],
      };
    });
  } catch {
    localStorage.removeItem(PENDING_TIMES_KEY);
  }
}

function wipeLegacyStorage() {
  if (typeof window === "undefined") return;
  for (const key of LOCAL_KEYS) localStorage.removeItem(key);
}

function timeLogKey(log: Pick<TimeLog, "workoutId" | "blockId" | "athleteId" | "repNumber">) {
  return `${log.workoutId}:${log.blockId}:${log.athleteId}:${log.repNumber}`;
}

const HISTORY_DELAY_MS = 2000;
const recentSince = () => addDays(todayIso(), -RECENT_DAYS);

/** With `since`, the snapshot only holds workouts from that day on: older ones already loaded are kept. */
function applySnapshot(snapshot: Snapshot, role: AppState["role"], swimmerId = "", since?: string) {
  // Unsynced local edits win over the server copy until the save is confirmed.
  const pendingLogs = state.timeLogs.filter((log) => log.pending);
  const olderWorkouts = since ? state.workouts.filter((workout) => workout.date < since) : [];
  const olderIds = new Set(olderWorkouts.map((workout) => workout.id));
  const olderLogs = state.timeLogs.filter((log) => !log.pending && olderIds.has(log.workoutId));
  // Competitions follow the same window: keep the older ones already merged from the history.
  const shownMeets = new Set(snapshot.competitions.map((meet) => meet.id));
  const olderMeets = since ? state.competitions.filter((meet) => meet.date < since && !shownMeets.has(meet.id)) : [];
  const olderMeetIds = new Set(olderMeets.map((meet) => meet.id));
  const olderEntries = state.meetEntries.filter((entry) => olderMeetIds.has(entry.competitionId));
  const olderEntryIds = new Set(olderEntries.map((entry) => entry.id));
  const olderResults = state.meetResults.filter((result) => olderEntryIds.has(result.entryId));
  const pendingKeys = new Set(pendingLogs.map((log) => timeLogKey(log)));
  setState({
    role,
    swimmerId: snapshot.swimmerId || swimmerId,
    teamName: snapshot.teamName,
    joinCode: snapshot.joinCode || "",
    // The database sorts by byte order ("Álvaro" after "Zé", "Atleta 10" before "Atleta 2").
    athletes: [...snapshot.athletes].sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true, sensitivity: "base" })),
    workouts: [...snapshot.workouts, ...olderWorkouts],
    timeLogs: [
      ...olderLogs,
      ...snapshot.timeLogs
        .filter((log) => !pendingKeys.has(timeLogKey(log)))
        .map((log) => ({ ...log, pending: false, stroke: (log.stroke || "") as TimeLog["stroke"] })),
      ...pendingLogs,
    ],
    competitions: [...snapshot.competitions.map((meet) => ({ ...meet, endDate: meet.endDate || meet.date })), ...olderMeets],
    meetEntries: [...snapshot.meetEntries, ...olderEntries],
    meetResults: [...snapshot.meetResults, ...olderResults],
    raceSessions: (snapshot.raceSessions ?? []).map((session) => ({
      ...session,
      officialTimeS: session.officialTimeS ?? 0,
      entryId: session.entryId ?? null,
      laps: session.laps ?? [],
    })),
    seasonPlans: snapshot.seasonPlans ?? [],
    attendance: snapshot.attendance ?? [],
    goals: snapshot.goals ?? [],
    hrSessions: snapshot.hrSessions ?? [],
    syncing: false,
    historyLoaded: since ? state.historyLoaded : true,
  });
}

async function hydrate() {
  wipeLegacyStorage();
  restorePendingTimes();
  try {
    // Snapshot and session at once (the snapshot usually started in the page's <head>); without a team: 403, ignored.
    const since = recentSince();
    const early = takeEarlySnapshot<Snapshot>(since).then(
      (snapshot) => snapshot ?? api<Snapshot>(`/api/v1/snapshot?since=${since}`).catch(() => null),
    );
    const me = await api<Me>("/api/v1/auth/me");
    if (me.role === "coach" || (me.role === "swimmer" && me.teamId)) {
      const snapshot = (await early) ?? (await api<Snapshot>(`/api/v1/snapshot?since=${since}`));
      applySnapshot(snapshot, me.role, me.athleteId || "", since);
      // After the first paint: on a phone network the history (megabytes) would compete with the page itself.
      setTimeout(() => void loadOlderHistory(since), HISTORY_DELAY_MS);
    } else if (me.role === "swimmer") {
      const profile = await api<Athlete>("/api/v1/swimmer/profile");
      setState({
        role: me.role,
        swimmerId: profile.id,
        teamName: "",
        joinCode: "",
        athletes: [profile],
        workouts: [],
        timeLogs: [],
        competitions: [],
        meetEntries: [],
        meetResults: [],
        raceSessions: [],
        seasonPlans: [],
        attendance: [],
        syncing: false,
      });
    } else {
      setState({
        role: me.role,
        teamName: me.teamName || "",
        joinCode: me.joinCode || "",
        athletes: [],
        workouts: [],
        timeLogs: [],
        competitions: [],
        meetEntries: [],
        meetResults: [],
        raceSessions: [],
        seasonPlans: [],
        attendance: [],
        syncing: false,
      });
    }
    bootError = null;
    if (state.timeLogs.some((log) => log.pending)) void retryPendingTimeLogs();
    if (me.teamId && (me.role === "coach" || me.role === "swimmer")) void syncWatches();
    if (me.teamId && me.role === "coach") void syncLiveMeets();
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      state = emptyState();
      bootError = null;
    } else {
      bootError = txDynamic((error as { detail?: string }).detail || "Não foi possível ligar à API.");
      setState({ role: null });
    }
    emit();
  } finally {
    bootstrapped = true;
    emit();
  }
}

/** Pulls new watch sessions (Polar) in the background; the API throttles per athlete. */
async function syncWatches(force = false) {
  try {
    const result = await api<{ imported: number }>(`/api/v1/integrations/polar/sync${force ? "?force=1" : ""}`, {
      method: "POST",
      idempotencyKey: `polar-sync-${Date.now()}`,
    });
    if (result.imported > 0) await refreshSnapshot();
    return result.imported;
  } catch {
    return 0;
  }
}

/** During a meet with a live-results link, pull new start lists/results (the API throttles). */
async function syncLiveMeets() {
  try {
    const result = await api<{ imported: number }>("/api/v1/live/sync", { method: "POST", idempotencyKey: `live-team-${Date.now()}` });
    if (result.imported > 0) await refreshSnapshot();
  } catch {
    // Following live results is best-effort; the competition page has a manual refresh.
  }
}

async function refreshSnapshot() {
  const since = recentSince();
  applySnapshot(await api<Snapshot>(`/api/v1/snapshot?since=${since}`), state.role, "", since);
}

/** Workouts and competitions before `before` (with times and results), merged once the page is usable. */
async function loadOlderHistory(before: string) {
  try {
    const older = await api<Snapshot>(`/api/v1/snapshot?before=${before}`);
    setState((current) => {
      const knownWorkouts = new Set(current.workouts.map((workout) => workout.id));
      const knownLogs = new Set(current.timeLogs.map((log) => timeLogKey(log)));
      const knownMeets = new Set(current.competitions.map((meet) => meet.id));
      const knownEntries = new Set(current.meetEntries.map((entry) => entry.id));
      const knownResults = new Set(current.meetResults.map((result) => result.id));
      return {
        ...current,
        historyLoaded: true,
        workouts: [...current.workouts, ...older.workouts.filter((workout) => !knownWorkouts.has(workout.id))],
        timeLogs: [
          ...current.timeLogs,
          ...older.timeLogs
            .filter((log) => !knownLogs.has(timeLogKey(log)))
            .map((log) => ({ ...log, pending: false, stroke: (log.stroke || "") as TimeLog["stroke"] })),
        ],
        competitions: [
          ...current.competitions,
          ...older.competitions
            .filter((meet) => !knownMeets.has(meet.id))
            .map((meet) => ({ ...meet, endDate: meet.endDate || meet.date })),
        ],
        meetEntries: [...current.meetEntries, ...older.meetEntries.filter((entry) => !knownEntries.has(entry.id))],
        meetResults: [...current.meetResults, ...older.meetResults.filter((result) => !knownResults.has(result.id))],
      };
    });
  } catch {
    // Older history is a bonus for analysis; the recent weeks already loaded keep the app usable.
  }
}

function onOnline() {
  setState({ online: true });
  void retryPendingTimeLogs();
  toast.info(tx("Ligação restabelecida."), tx("A sincronizar tempos pendentes…"));
}

function onOffline() {
  setState({ online: false });
  toast.info(tx("Sem rede."), tx("Os tempos ficam guardados localmente até voltar a ligar."));
}

// Many components call useAppState; the network listeners must exist once, not once per component
// (otherwise every connectivity change shows N toasts and starts N parallel resyncs).
let networkSubscribers = 0;

export function useAppState(): AppState {
  useEffect(() => {
    if (!bootstrapped) {
      if (requiresAuthBootstrap()) void hydrate();
      else {
        bootstrapped = true;
        emit();
      }
    }
    if (networkSubscribers++ === 0) {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }
    return () => {
      if (--networkSubscribers === 0) {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAuthBoot() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { bootstrapped, bootError };
}

function applyTimeDraft(draft: TimeSavePayload, nextStroke: string) {
  const key = draft.logKey;
  if (draft.deleting) {
    setState((current) => ({
      ...current,
      timeLogs: current.timeLogs.filter((log) => timeLogKey(log) !== key),
    }));
    return;
  }
  const payload = draft.payload;
  const cellDraft: TimeLog = {
    id: String(payload.id),
    workoutId: String(payload.workoutId),
    blockId: String(payload.blockId),
    athleteId: String(payload.athleteId),
    repNumber: Number(payload.repNumber),
    mm: Number(payload.mm),
    ss: Number(payload.ss),
    cc: Number(payload.cc),
    splits: (payload.splits as SplitTime[]) ?? [],
    stroke: (String(payload.stroke || nextStroke) as TimeLog["stroke"]) || "free",
    pending: true,
    skipped: Boolean(payload.skipped),
    recordedAt: String(payload.recordedAt),
  };
  setState((current) => {
    const existing = current.timeLogs.some((log) => timeLogKey(log) === key);
    return {
      ...current,
      timeLogs: existing
        ? current.timeLogs.map((log) => (timeLogKey(log) === key ? cellDraft : log))
        : [...current.timeLogs, cellDraft],
    };
  });
}

function withoutStale(row: TimeLog & { stale?: boolean }): TimeLog {
  const log = { ...row };
  delete log.stale;
  return log;
}

async function persistTimeDraft(draft: TimeSavePayload, nextStroke: string) {
  const key = draft.logKey;
  try {
    const stored = await api<TimeLog | { deleted: true }>("/api/v1/times", {
      method: "PUT",
      body: JSON.stringify(draft.payload),
      idempotencyKey: draft.idempotencyKey,
    });
    if ("deleted" in stored && stored.deleted) {
      setState((current) => ({
        ...current,
        timeLogs: current.timeLogs.filter((log) => timeLogKey(log) !== key),
      }));
      return;
    }
    setState((current) => ({
      ...current,
      timeLogs: current.timeLogs.map((log) =>
        timeLogKey(log) === key
          ? {
              // A "stale" reply carries the newer time already stored (another device, or a later edit).
              ...withoutStale(stored as TimeLog & { stale?: boolean }),
              pending: false,
              skipped: Boolean((stored as TimeLog).skipped),
              stroke: ((stored as TimeLog).stroke || nextStroke) as TimeLog["stroke"],
            }
          : log,
      ),
    }));
  } catch (error) {
    const apiError = error as ApiError;
    if (!draft.deleting) {
      setState((current) => ({
        ...current,
        timeLogs: current.timeLogs.map((log) => (timeLogKey(log) === key ? { ...log, pending: true } : log)),
      }));
    }
    if (!pendingRetryTimer && typeof window !== "undefined") {
      pendingRetryTimer = window.setTimeout(() => {
        pendingRetryTimer = null;
        void retryPendingTimeLogs();
      }, 5000);
    }
    throw error;
  }
}

async function retryPendingTimeLogs() {
  const pending = state.timeLogs.filter((log) => log.pending && (log.skipped || hasClockTime(log.mm, log.ss, log.cc) || (log.splits?.length ?? 0) > 0));
  await Promise.allSettled(
    pending.map(async (log) => {
      const cell: CellRef = { athleteId: log.athleteId, blockId: log.blockId, repNumber: log.repNumber };
      const parts = partsFromNumbers(log.mm, log.ss, log.cc);
      const draft = buildTimeDraft(log.workoutId, cell, parts, null, log.stroke, log, Boolean(log.skipped));
      if (!draft) return;
      await persistTimeDraft(draft, log.stroke || "free");
    }),
  );
}

export const actions = {
  async updateAthlete(id: string, input: AthleteInput) {
    const athlete = await api<Athlete>(`/api/v1/athletes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: `athlete-update-${id}-${Date.now()}`,
    });
    setState((current) => ({
      ...current,
      athletes: current.athletes.map((item) => (item.id === id ? athlete : item)),
    }));
  },
  /** The swimmer's own partial update (only the fields sent change). */
  async patchOwnAthlete(id: string, input: { wellness?: WellnessEntry[]; seedRecords?: SeedRecord[] }) {
    const personal = id.startsWith("profile-");
    const athlete = await api<Athlete>(personal ? "/api/v1/swimmer/profile" : `/api/v1/athletes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: `athlete-patch-${id}-${Date.now()}`,
    });
    setState((current) => ({ ...current, athletes: current.athletes.map((item) => (item.id === id || personal ? athlete : item)) }));
    return athlete;
  },
  /** Coach-owned athlete fields: training group, and gender while the athlete hasn't set it. */
  async coachUpdateAthlete(id: string, input: { groupName?: string; gender?: "M" | "F" }) {
    const athlete = await api<Athlete>(`/api/v1/athletes/${id}/coach`, {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: `athlete-coach-${id}-${Date.now()}`,
    });
    setState((current) => ({
      ...current,
      athletes: current.athletes.map((item) => (item.id === id ? athlete : item)),
    }));
  },
  /** `purge`: also delete every record of theirs in this team (times, races, goals…). */
  async removeAthlete(id: string, purge = false) {
    await api(`/api/v1/athletes/${id}${purge ? "?purge=1" : ""}`, { method: "DELETE", idempotencyKey: `athlete-del-${id}${purge ? "-purge" : ""}` });
    await refreshSnapshot();
  },
  async addWorkout(input: WorkoutInput) {
    const workout = await api<Workout>("/api/v1/workouts", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        title: input.title.trim() || treinoTitle(input.date),
        blocks: input.blocks.map((block) => ({ ...persistDraft(block), id: crypto.randomUUID() })),
      }),
    });
    setState((current) => ({ ...current, workouts: [workout, ...current.workouts] }));
    return workout.id;
  },
  async deleteWorkout(id: string) {
    await api(`/api/v1/workouts/${id}`, { method: "DELETE", idempotencyKey: `workout-del-${id}` });
    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((item) => item.id !== id),
      timeLogs: current.timeLogs.filter((log) => log.workoutId !== id),
    }));
  },
  async updateWorkout(id: string, input: WorkoutInput) {
    const current = state.workouts.find((item) => item.id === id);
    const workout = await api<Workout>(`/api/v1/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...input,
        title: input.title.trim() || treinoTitle(input.date),
        blocks: input.blocks.map((block) => ({
          ...persistDraft(block),
          id: block.id ?? crypto.randomUUID(),
        })),
      }),
      idempotencyKey: `workout-update-${id}-${Date.now()}`,
    });
    setState((s) => ({ ...s, workouts: s.workouts.map((item) => (item.id === id ? workout : item)) }));
  },
  async addAthleteToWorkout(workoutId: string, athleteId: string) {
    const workout = state.workouts.find((item) => item.id === workoutId);
    if (!workout || workout.athleteIds.includes(athleteId)) return;
    const athleteIds = [...workout.athleteIds, athleteId];
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((item) => (item.id === workoutId ? { ...item, athleteIds } : item)),
    }));
    await api(`/api/v1/workouts/${workoutId}`, {
      method: "PATCH",
      body: JSON.stringify({ athleteIds }),
      idempotencyKey: `w-ath-${workoutId}-${athleteId}-add`,
    });
  },
  async removeAthleteFromWorkout(workoutId: string, athleteId: string) {
    const workout = state.workouts.find((item) => item.id === workoutId);
    if (!workout) return;
    const athleteIds = workout.athleteIds.filter((id) => id !== athleteId);
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((item) => (item.id === workoutId ? { ...item, athleteIds } : item)),
    }));
    await api(`/api/v1/workouts/${workoutId}`, {
      method: "PATCH",
      body: JSON.stringify({ athleteIds }),
      idempotencyKey: `w-ath-${workoutId}-${athleteId}-rm`,
    });
  },
  async addCompetition(input: CompetitionInput) {
    const meet = await api<Competition>("/api/v1/competitions", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        title: input.title.trim() || meetTitle(input.date),
        venue: "",
        endDate: input.endDate || input.date,
      }),
    });
    setState((current) => ({ ...current, competitions: [{ ...meet, endDate: meet.endDate || input.endDate || meet.date }, ...current.competitions] }));
    return meet.id;
  },
  async deleteCompetition(id: string) {
    await api(`/api/v1/competitions/${id}`, { method: "DELETE", idempotencyKey: `meet-del-${id}` });
    setState((current) => {
      const meetEntries = current.meetEntries.filter((entry) => entry.competitionId !== id);
      const kept = new Set(meetEntries.map((entry) => entry.id));
      return {
        ...current,
        competitions: current.competitions.filter((item) => item.id !== id),
        meetEntries,
        meetResults: current.meetResults.filter((result) => kept.has(result.entryId)),
        raceSessions: current.raceSessions.filter((session) => session.competitionId !== id),
      };
    });
  },
  async updateCompetition(id: string, input: CompetitionInput) {
    const meet = await api<Competition>(`/api/v1/competitions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...input,
        title: input.title.trim() || meetTitle(input.date),
        venue: "",
        endDate: input.endDate || input.date,
      }),
      idempotencyKey: `meet-update-${id}`,
    });
    setState((current) => ({
      ...current,
      competitions: current.competitions.map((item) => (item.id === id ? meet : item)),
    }));
  },
  async toggleMeetAthlete(competitionId: string, athleteId: string) {
    const meet = state.competitions.find((item) => item.id === competitionId);
    if (!meet) return;
    const inMeet = meet.athleteIds.includes(athleteId);
    const athleteIds = inMeet ? meet.athleteIds.filter((id) => id !== athleteId) : [...meet.athleteIds, athleteId];
    setState((current) => {
      const meetEntries = inMeet
        ? current.meetEntries.filter((entry) => !(entry.competitionId === competitionId && entry.athleteId === athleteId))
        : current.meetEntries;
      const keptIds = new Set(meetEntries.map((entry) => entry.id));
      return {
        ...current,
        competitions: current.competitions.map((item) => (item.id === competitionId ? { ...item, athleteIds } : item)),
        meetEntries,
        meetResults: current.meetResults.filter((result) => keptIds.has(result.entryId)),
      };
    });
    await api(`/api/v1/competitions/${competitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ athleteIds }),
      idempotencyKey: `meet-ath-${competitionId}-${athleteId}-${inMeet ? "rm" : "add"}`,
    });
  },
  /**
   * Sends an official meet file (Lenex). With dryRun the API only reports what it found;
   * otherwise it fills the competition, selection, heats/lanes and results, then we reload.
   */
  async processMeetFile(file: { name: string; data: string }, options: MeetFileOptions = {}): Promise<MeetFileSummary> {
    const body = { filename: file.name, data: file.data, ...options };
    const summary = await api<MeetFileSummary>("/api/v1/meet-files/lenex", {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey: options.dryRun ? undefined : `meet-file-${file.name}-${file.data.length}-${Date.now()}`,
    });
    if (!options.dryRun) await refreshSnapshot();
    return summary;
  },
  async saveGoal(input: GoalInput): Promise<Goal> {
    const saved = await api<Goal>("/api/v1/goals", {
      method: "PUT",
      body: JSON.stringify(input),
      idempotencyKey: `goal-${input.id ?? "new"}-${Date.now()}`,
    });
    setState((current) => ({
      ...current,
      goals: current.goals.some((goal) => goal.id === saved.id)
        ? current.goals.map((goal) => (goal.id === saved.id ? saved : goal))
        : [saved, ...current.goals],
    }));
    return saved;
  },
  /** Uploads a watch file (.FIT/.TCX); the API links it to the workout of that day and shift. */
  async uploadHeartRate(file: { name: string; data: string }, athleteId: string, workoutId?: string): Promise<HrSession> {
    const saved = await api<HrSession>("/api/v1/hr/upload", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, data: file.data, athleteId, workoutId }),
      idempotencyKey: `hr-${athleteId}-${file.name}-${file.data.length}`,
    });
    setState((current) => ({ ...current, hrSessions: [saved, ...current.hrSessions.filter((item) => item.id !== saved.id)] }));
    return saved;
  },
  syncWatches,
  /** Personal bests from a pasted SwimRankings profile (final times only; never overrides team data). */
  async importSwimRankings(athleteId: string, input: { url?: string; text?: string }) {
    const result = await api<SwimRankingsImport>(`/api/v1/athletes/${athleteId}/swimrankings`, {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: `sr-${athleteId}-${Date.now()}`,
    });
    await refreshSnapshot();
    return result;
  },
  /** Splits of a SwimRankings best time (coach or the athlete); the time itself never changes. */
  async saveRecordSplits(athleteId: string, record: { course: string; stroke: string; distanceM: number; splits: SplitTime[] }) {
    const athlete = await api<Athlete>(`/api/v1/athletes/${athleteId}/records/splits`, {
      method: "PUT",
      body: JSON.stringify(record),
      idempotencyKey: `splits-${athleteId}-${record.course}-${record.stroke}-${record.distanceM}-${Date.now()}`,
    });
    setState((current) => ({ ...current, athletes: current.athletes.map((item) => (item.id === athleteId ? athlete : item)) }));
    return athlete;
  },
  async setLiveLink(competitionId: string, url: string | null) {
    await api(`/api/v1/competitions/${competitionId}/live`, {
      method: "PUT",
      body: JSON.stringify({ url }),
      idempotencyKey: `live-${competitionId}-${Date.now()}`,
    });
    await refreshSnapshot();
  },
  async syncLive(competitionId: string): Promise<{ imported: number; status: string }> {
    const result = await api<{ imported: number; status: string }>(`/api/v1/competitions/${competitionId}/live/sync`, {
      method: "POST",
      idempotencyKey: `live-sync-${competitionId}-${Date.now()}`,
    });
    await refreshSnapshot();
    return result;
  },
  async deleteHeartRate(id: string) {
    await api(`/api/v1/hr/${id}`, { method: "DELETE", idempotencyKey: `hr-del-${id}` });
    setState((current) => ({ ...current, hrSessions: current.hrSessions.filter((item) => item.id !== id) }));
  },
  async deleteGoal(id: string) {
    await api(`/api/v1/goals/${id}`, { method: "DELETE", idempotencyKey: `goal-del-${id}` });
    setState((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
  },
  /** Adds or corrects an event by hand (number, day, heat/lane, entry time). */
  async saveMeetEntry(input: Partial<MeetEntry> & { competitionId: string; athleteId: string; stroke: MeetEntry["stroke"]; distanceM: number }) {
    const saved = await api<MeetEntry>("/api/v1/meet-entries", {
      method: "PUT",
      body: JSON.stringify(input),
      idempotencyKey: `entry-save-${input.competitionId}-${input.athleteId}-${input.stroke}-${input.distanceM}-${Date.now()}`,
    });
    await refreshSnapshot();
    return saved;
  },
  /** Deletes an event and its result. */
  async deleteMeetEntry(id: string) {
    await api(`/api/v1/meet-entries/${id}`, { method: "DELETE", idempotencyKey: `entry-del-${id}-${Date.now()}` });
    await refreshSnapshot();
  },
  async toggleMeetEntry(competitionId: string, athleteId: string, stroke: MeetEntry["stroke"], distanceM: number) {
    const result = await api<MeetEntry | { deleted: true; id: string }>("/api/v1/meet-entries/toggle", {
      method: "POST",
      body: JSON.stringify({ competitionId, athleteId, stroke, distanceM }),
      idempotencyKey: `entry-${competitionId}-${athleteId}-${stroke}-${distanceM}-${Date.now()}`,
    });
    await refreshSnapshot();
    return result;
  },
  saveMeetResult(entryId: string, parts: TimeParts, splitAt: number | null = null) {
    if (!isEmptyParts(parts) && !isValidSeconds(parts.ss)) return;
    const empty = isEmptyParts(parts);
    const normalized = empty ? { mm: 0, ss: 0, cc: 0 } : normalizeParts(parts);
    let next: MeetResult | null = null;
    setState((current) => {
      const existing = current.meetResults.find((result) => result.entryId === entryId);
      const splits: SplitTime[] = [...(existing?.splits ?? [])].filter((split) => hasClockTime(split.mm, split.ss, split.cc));
      let mm = existing?.mm ?? 0;
      let ss = existing?.ss ?? 0;
      let cc = existing?.cc ?? 0;
      let hasFinal = hasClockTime(mm, ss, cc);

      if (splitAt == null) {
        hasFinal = !empty;
        mm = empty ? 0 : normalized.mm;
        ss = empty ? 0 : normalized.ss;
        cc = empty ? 0 : normalized.cc;
      } else if (empty) {
        const index = splits.findIndex((item) => sameMeters(item.atM, splitAt));
        if (index >= 0) splits.splice(index, 1);
      } else {
        const nextSplit: SplitTime = { atM: splitAt, mm: normalized.mm, ss: normalized.ss, cc: normalized.cc };
        const index = splits.findIndex((item) => sameMeters(item.atM, splitAt));
        if (index >= 0) splits[index] = nextSplit;
        else splits.push(nextSplit);
        splits.sort((a, b) => a.atM - b.atM);
      }

      if (!hasFinal && splits.length === 0) {
        next = { id: existing?.id ?? "", entryId, mm: 0, ss: 0, cc: 0, splits: [], recordedAt: new Date().toISOString() };
        return { ...current, meetResults: current.meetResults.filter((result) => result.entryId !== entryId) };
      }

      next = {
        id: existing?.id ?? crypto.randomUUID(),
        entryId,
        mm,
        ss,
        cc,
        splits,
        recordedAt: new Date().toISOString(),
      };
      const meetResults = existing
        ? current.meetResults.map((result) => (result.id === existing.id ? next! : result))
        : [...current.meetResults, next];
      return { ...current, meetResults };
    });
    const savedResult = next as MeetResult | null;
    if (!savedResult) return;
    void api("/api/v1/meet-results", {
      method: "PUT",
      body: JSON.stringify(savedResult),
      idempotencyKey: `meet-res-${entryId}-${splitAt ?? "final"}-${savedResult.recordedAt}`,
    });
  },
  async setSplitMarks(workoutId: string, blockId: string, segmentIndex: number, splitMarks: number[]) {
    const workout = state.workouts.find((item) => item.id === workoutId);
    const block = workout?.blocks.find((item) => item.id === blockId);
    const previous = block?.segments[segmentIndex]?.splitMarks ?? [];
    const removed = previous.filter((mark) => !splitMarks.some((item) => sameMeters(item, mark)));
    const inners = block ? flattenInner(block) : [];
    const innerReps = innerCount(block ?? { segments: [] });
    const matchingInners = inners
      .map((item, index) => (item.segmentIndex === segmentIndex ? index + 1 : 0))
      .filter((item) => item > 0);
    const repNumbers = new Set<number>();
    if (block && innerReps) {
      for (let round = 1; round <= Math.max(1, block.rounds); round += 1) {
        for (const innerRep of matchingInners) {
          repNumbers.add(flatRepNumber(round, innerRep, innerReps));
        }
      }
    }

    setState((current) => ({
      ...current,
      workouts: current.workouts.map((item) => {
        if (item.id !== workoutId) return item;
        return {
          ...item,
          blocks: item.blocks.map((currentBlock) => {
            if (currentBlock.id !== blockId) return currentBlock;
            return {
              ...currentBlock,
              segments: currentBlock.segments.map((segment, index) =>
                index === segmentIndex ? { ...segment, splitMarks } : segment,
              ),
            };
          }),
        };
      }),
      timeLogs: current.timeLogs.flatMap((log) => {
        if (removed.length === 0) return [log];
        if (log.workoutId !== workoutId || log.blockId !== blockId || !repNumbers.has(log.repNumber)) return [log];
        const splits = (log.splits ?? []).filter(
          (split) => hasClockTime(split.mm, split.ss, split.cc) && !removed.some((mark) => sameMeters(mark, split.atM)),
        );
        const hasFinal = hasClockTime(log.mm, log.ss, log.cc);
        if (!hasFinal && splits.length === 0) return [];
        return [{ ...log, splits }];
      }),
    }));

    const nextWorkout = state.workouts.find((item) => item.id === workoutId);
    if (!nextWorkout) return;
    await api(`/api/v1/workouts/${workoutId}`, {
      method: "PATCH",
      body: JSON.stringify({ blocks: nextWorkout.blocks }),
      idempotencyKey: `splits-${workoutId}-${blockId}-${segmentIndex}-${splitMarks.join(",")}`,
    });
  },
  scheduleTimeSave(
    workoutId: string,
    cell: CellRef,
    parts: TimeParts,
    splitAt: number | null = null,
    stroke?: Stroke | "",
    options: { immediate?: boolean; distanceM?: number | null } = {},
  ): Promise<void> {
    const existing = state.timeLogs.find(
      (log) =>
        log.workoutId === workoutId &&
        log.blockId === cell.blockId &&
        log.athleteId === cell.athleteId &&
        log.repNumber === cell.repNumber,
    );
    const nextStroke = stroke || existing?.stroke || "free";
    const draft = buildTimeDraft(workoutId, cell, parts, splitAt, nextStroke, existing);
    if (!draft) return Promise.resolve();
    const complete = options.immediate || draft.deleting || isTimeComplete(parts, options.distanceM);
    if (complete || draft.deleting) applyTimeDraft(draft, nextStroke);
    const queueKey = timeQueueKey(workoutId, cell, splitAt);
    return enqueueTimeSave(
      queueKey,
      draft,
      () => persistTimeDraft(draft, nextStroke),
      { immediate: options.immediate || draft.deleting, complete },
    );
  },
  skipTime(workoutId: string, cell: CellRef, stroke?: Stroke | ""): Promise<void> {
    const existing = state.timeLogs.find((log) => timeLogKey(log) === timeLogKey({ workoutId, ...cell }));
    const draft = buildTimeDraft(workoutId, cell, EMPTY_PARTS, null, stroke || existing?.stroke || "free", existing, true);
    if (!draft) return Promise.resolve();
    applyTimeDraft(draft, stroke || existing?.stroke || "free");
    const queueKey = timeQueueKey(workoutId, cell, null);
    return enqueueTimeSave(queueKey, draft, () => persistTimeDraft(draft, stroke || existing?.stroke || "free"), {
      immediate: true,
      complete: true,
    });
  },
  flushTimeSave(
    workoutId: string,
    cell: CellRef,
    parts: TimeParts,
    splitAt: number | null = null,
    stroke?: Stroke | "",
    distanceM?: number | null,
  ): Promise<void> {
    return actions.scheduleTimeSave(workoutId, cell, parts, splitAt, stroke, { immediate: true, distanceM });
  },
  flushAllTimeSaves(): Promise<void> {
    return flushAllScheduledTimeSaves();
  },
  /** @deprecated Use scheduleTimeSave or flushTimeSave */
  saveTime(
    workoutId: string,
    cell: CellRef,
    parts: TimeParts,
    splitAt: number | null = null,
    stroke?: Stroke | "",
  ): Promise<void> {
    return actions.scheduleTimeSave(workoutId, cell, parts, splitAt, stroke, { immediate: true });
  },
  async saveRaceSession(session: RaceSession) {
    const saved = await api<RaceSession>("/api/v1/race-sessions", {
      method: "PUT",
      body: JSON.stringify({
        ...session,
        officialTimeS: session.officialTimeS || 0,
        entryId: session.entryId || null,
      }),
      idempotencyKey: `race-${session.id}-${Date.now()}`,
    });
    setState((current) => {
      const exists = current.raceSessions.some((item) => item.id === saved.id);
      return {
        ...current,
        raceSessions: exists
          ? current.raceSessions.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current.raceSessions],
      };
    });
    return { ...saved, officialTimeS: saved.officialTimeS ?? session.officialTimeS ?? 0, entryId: saved.entryId ?? session.entryId };
  },
  async saveCompetitionAnalysis(entryId: string, session: RaceSession) {
    const saved = await actions.saveRaceSession({ ...session, entryId });
    const view = analyzeRace(saved);
    const total = saved.officialTimeS > 0 ? saved.officialTimeS : view.totalTime;
    if (total > 0) {
      const clock = fromCentiseconds(Math.round(total * 100));
      actions.saveMeetResult(entryId, partsFromNumbers(clock.mm, clock.ss, clock.cc));
    }
    return saved;
  },
  async deleteCompetitionResult(entryId: string, sessionId?: string | null) {
    actions.saveMeetResult(entryId, emptyParts());
    if (sessionId) await actions.deleteRaceSession(sessionId);
  },
  async deleteRaceSession(id: string) {
    await api(`/api/v1/race-sessions/${id}`, { method: "DELETE", idempotencyKey: `race-del-${id}` });
    setState((current) => ({ ...current, raceSessions: current.raceSessions.filter((item) => item.id !== id) }));
  },
  async saveSeasonPlan(plan: SeasonPlan) {
    const saved = await api<SeasonPlan>("/api/v1/season-plans", {
      method: "PUT",
      body: JSON.stringify(plan),
      // A new key per save: the same plan is saved many times while it is being edited.
      idempotencyKey: `plan-${plan.id || "new"}-${Date.now()}`,
    });
    setState((current) => {
      const exists = current.seasonPlans.some((item) => item.id === saved.id);
      return {
        ...current,
        seasonPlans: exists
          ? current.seasonPlans.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current.seasonPlans],
      };
    });
    return saved;
  },
  async deleteSeasonPlan(id: string) {
    await api(`/api/v1/season-plans/${id}`, { method: "DELETE", idempotencyKey: `plan-del-${id}` });
    setState((current) => ({ ...current, seasonPlans: current.seasonPlans.filter((item) => item.id !== id) }));
  },
  async saveAttendance(row: AttendanceSession) {
    const saved = await api<AttendanceSession>("/api/v1/attendance", {
      method: "PUT",
      body: JSON.stringify(row),
      idempotencyKey: `att-${row.id}-${row.date}`,
    });
    setState((current) => {
      const exists = current.attendance.some((item) => item.id === saved.id);
      return {
        ...current,
        attendance: exists
          ? current.attendance.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current.attendance],
      };
    });
    return saved;
  },
  async chooseRole(role: "coach" | "swimmer", teamName = "", invite = "") {
    const result = await api<{ role: "coach" | "swimmer"; next: string }>("/api/v1/auth/choose-role", {
      method: "POST",
      body: JSON.stringify({ role, teamName, invite }),
    });
    await hydrate();
    return result.next;
  },
  async updateSwimmerProfile(input: AthleteInput) {
    const athlete = await api<Athlete>("/api/v1/swimmer/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: `swimmer-profile-${Date.now()}`,
    });
    setState((current) => ({
      ...current,
      athletes: [athlete],
      swimmerId: athlete.id,
    }));
    return athlete;
  },
  /** `purge`: delete the swimmer's own data in the team instead of leaving it behind. */
  async leaveTeam(purge = false) {
    const result = await api<{ next: string }>(`/api/v1/auth/leave-team${purge ? "?purge=1" : ""}`, { method: "POST" });
    await hydrate();
    return result.next;
  },
  async updateTeam(input: { name?: string }) {
    const saved = await api<{ name: string; joinCode: string }>("/api/v1/team", {
      method: "PATCH",
      body: JSON.stringify(input),
      idempotencyKey: `team-name-${Date.now()}`,
    });
    setState((current) => ({ ...current, teamName: saved.name, joinCode: saved.joinCode }));
    return saved;
  },
  async updateProfile(name: string) {
    const saved = await api<{ name: string }>("/api/v1/profile", {
      method: "PATCH",
      body: JSON.stringify({ name }),
      idempotencyKey: `profile-${Date.now()}`,
    });
    return saved;
  },
  async logout() {
    await api("/api/v1/auth/logout", { method: "POST" });
    state = emptyState();
    bootstrapped = true;
    emit();
  },
};

export function pendingCount(logs: TimeLog[]): number {
  return logs.filter((log) => log.pending).length;
}

export function emptyParts(): TimeParts {
  return { ...EMPTY_PARTS };
}

export const BLOCK_TYPES: BlockType[] = ["warmup", "main", "recovery"];
