export type Role = "coach" | "swimmer" | "pending";

export type Shift = "morning" | "afternoon";

export type BlockType = "warmup" | "main" | "recovery";

export type Stroke = "free" | "back" | "breast" | "fly" | "im";

export type Intensity = "SUAVE" | "A1" | "A2" | "A3" | "PROG" | "PA" | "MAX" | "P50" | "P100" | "P200" | "P400";

export type Gear = "legs" | "arms" | "paddles" | "pullbuoy" | "parachute" | "fins" | "suit";

/** What's being swum in a set: the five race strokes, plus "sub" (underwater) for training-only sets. */
export type WorkoutStroke = Stroke | "sub";

export type TimeParts = {
  mm: string;
  ss: string;
  cc: string;
};

export type Gender = "M" | "F";

export type GymType = "strength" | "mobility" | "explosive";

export type WellnessEntry = {
  date: string;
  sleepHours: number | null;
  gym: GymType | null;
  /** How recovered the swimmer feels, 1 (very tired) to 5 (fresh). */
  recovery?: number | null;
  /** Effort of the day's training, CR-10 session RPE (Foster 2001): 0 rest to 10 maximal. */
  rpe?: number | null;
};

export type PoolCourse = "scm" | "lcm";

export type SplitTime = {
  atM: number;
  mm: number;
  ss: number;
  cc: number;
};

export type SeedRecord = {
  stroke: Stroke;
  distanceM: number;
  course: PoolCourse;
  mm: number;
  ss: number;
  cc: number;
  date: string;
  splits?: SplitTime[];
  /** "swimrankings" when it came from the SwimRankings profile (final time only). */
  source?: string;
  meet?: string;
};

export type Athlete = {
  id: string;
  name: string;
  active?: boolean;
  isPlaceholder: boolean;
  dateOfBirth?: string;
  primaryStroke: Stroke | "";
  teamId: string;
  gender?: Gender | "";
  groupName?: string;
  seedRecords?: SeedRecord[];
  wellness?: WellnessEntry[];
  swimrankingsUrl?: string;
  swimrankingsSyncedAt?: string | null;
};

export type RepDetail = {
  intensity: Intensity;
  sendOffSeconds: number;
  fromBlock: boolean;
  gear: Gear[];
  /** Stroke swum for this rep, when the coach wants to fix it (e.g. "pernas mariposa"). */
  stroke?: WorkoutStroke | "";
};

/**
 * A rep broken into ordered chunks with their own pace/stroke ("4×50: 25 prog + 25 A1", or a single
 * 100 as "25/50/25" of different strokes). The chunks' distances should add up to the segment's
 * distanceM, but this isn't enforced — a coach's plan doesn't have to be exact.
 */
export type SegmentPart = {
  distanceM: number;
  intensity: Intensity;
  stroke?: WorkoutStroke | "";
};

export type SetSegment = {
  reps: number;
  distanceM: number;
  intensity: Intensity;
  sendOffSeconds: number;
  fromBlock: boolean;
  gear: Gear[];
  details: RepDetail[];
  splitMarks: number[];
  /** Stroke swum in this segment (same field as RepDetail.stroke, as the segment's default). */
  stroke?: WorkoutStroke | "";
  /** When set, every rep of this segment is swum as these chunks instead of one uniform pace. */
  parts?: SegmentPart[];
  /**
   * Optional per-group send-offs for the same set ("A a 1'10, B a 1'20"). Swimmers whose
   * group isn't listed keep the segment's own send-off.
   */
  bands?: SegmentBand[];
  /**
   * Gear for a specific round of a repeated block ("3×", index 0 = round 1), overriding the
   * segment's own gear for every rep of that round — e.g. round 1 with fins, round 2 without.
   * A missing or null entry falls back to the segment's (or rep's) own gear.
   */
  roundGear?: (Gear[] | null)[];
};

export type SegmentBand = { group: string; sendOffSeconds: number };

export type WorkoutBlock = {
  id: string;
  type: BlockType;
  rounds: number;
  noSendOff: boolean;
  segments: SetSegment[];
  /** afterEach: also swum after the very last round, not just between rounds (e.g. before the next block). */
  betweenRounds: { distanceM: number; afterEach?: boolean } | null;
};

export type Workout = {
  id: string;
  title: string;
  date: string;
  shift: Shift;
  course?: PoolCourse | "";
  athleteIds: string[];
  blocks: WorkoutBlock[];
  /** Training groups this session is for (velocidade / intermedio / fundo). */
  groups?: string[];
  /** The coach's word for the day: Potência, Tolerância, Aeróbio, Teste… */
  focus?: string;
};

export type TimeLog = {
  id: string;
  workoutId: string;
  blockId: string;
  athleteId: string;
  repNumber: number;
  mm: number;
  ss: number;
  cc: number;
  splits: SplitTime[];
  stroke: Stroke | "";
  pending: boolean;
  skipped?: boolean;
  recordedAt: string;
};

export type CellRef = {
  athleteId: string;
  blockId: string;
  repNumber: number;
};

export type DraftBlock = Omit<WorkoutBlock, "id"> & { id?: string };

export type WorkoutInput = {
  title: string;
  date: string;
  shift: Shift;
  course: PoolCourse;
  blocks: DraftBlock[];
  groups?: string[];
  focus?: string;
};

export type AthleteInput = {
  name: string;
  dateOfBirth?: string;
  primaryStroke: Stroke | "";
  isPlaceholder: boolean;
  gender?: Gender | "";
  groupName?: string;
  seedRecords?: SeedRecord[];
  wellness?: WellnessEntry[];
  swimrankingsUrl?: string;
  swimrankingsSyncedAt?: string | null;
};

export type DayPart = "am" | "pm";

export type RaceLap = {
  n: number;
  uw: number;
  uwd: number;
  uwKicks: number;
  sec15: number;
  sec10: number;
  sec25: number;
  sec35: number;
  sec45: number;
  sec50: number;
  last5: number;
  sr: number;
  sr1: number;
  sr2: number;
  sc: number;
  sc15: number;
  sr15: number;
  sc25: number;
  sr25: number;
  sc35: number;
  sr35: number;
  sc45: number;
  sr45: number;
  sc50: number;
  sr50: number;
};

export type RaceSession = {
  id: string;
  athleteId: string;
  competitionId?: string | null;
  entryId?: string | null;
  date: string;
  tournament: string;
  course: PoolCourse;
  distanceM: number;
  stroke: Stroke;
  dayPart: DayPart;
  reactionS: number;
  flightS: number;
  officialTimeS: number;
  laps: RaceLap[];
  createdAt: string;
};

export type SeasonCycle = {
  id: string;
  /** Phase kind for macros ("general" | "specific" | "competitive" | "taper" | "transition"). */
  type: string;
  label?: string;
  focus?: string;
  start: string;
  end: string;
};

export type PlanEvent = {
  id: string;
  name: string;
  type?: string;
  date: string;
  description?: string;
};

export type SeasonPlan = {
  id: string;
  name: string;
  start: string;
  end: string;
  description: string;
  macros: SeasonCycle[];
  mesos: SeasonCycle[];
  competitions: PlanEvent[];
  tests: PlanEvent[];
  weeklyVolumes: { week: number; meters: number }[];
};

export type AttendanceStatus = "present" | "late" | "absent";

export type AttendanceMark = {
  athleteId: string;
  status: AttendanceStatus;
  volumeM: number;
};

export type AttendanceSession = {
  id: string;
  workoutId?: string | null;
  date: string;
  groupName: string;
  marks: AttendanceMark[];
  createdAt: string;
};

export type Competition = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  course: PoolCourse;
  venue: string;
  athleteIds: string[];
  /** Live-results page followed during the meet (SPLASH on live.swimrankings.net). */
  live?: { url: string; status?: string; lastSyncAt?: string | null } | null;
  /** Key facts read from the regulations PDF. */
  rules?: { label: string; value: string }[] | null;
};

export type CompetitionInput = {
  title: string;
  date: string;
  endDate: string;
  course: PoolCourse;
  venue: string;
};

export type MeetEntry = {
  id: string;
  competitionId: string;
  athleteId: string;
  stroke: Stroke;
  distanceM: number;
  /** From the organiser's files: present once the start list is published. */
  heat?: number | null;
  lane?: number | null;
  entryTimeS?: number | null;
  eventNumber?: number | null;
  date?: string | null;
  sessionTime?: string | null;
  /** Pool of the entry time (a 25 m time can be used to enter a 50 m meet). */
  entryCourse?: PoolCourse | null;
  /** The final, when the swimmer makes it; heats (heat/lane above) are always kept. */
  finalHeat?: number | null;
  finalLane?: number | null;
  finalDate?: string | null;
  finalTime?: string | null;
};

export type OfficialSwim = {
  timeS: number;
  reactionS?: number | null;
  heat?: number | null;
  lane?: number | null;
  date?: string | null;
  place?: number | null;
  category?: string | null;
};

export type MeetResult = {
  id: string;
  entryId: string;
  mm: number;
  ss: number;
  cc: number;
  splits: SplitTime[];
  reactionS?: number | null;
  source?: "manual" | "lenex" | "pdf";
  /** Official swims by round when both heats and final were swum. */
  swims?: { heat?: OfficialSwim; final?: OfficialSwim };
  recordedAt: string;
};

export type PersonalRecord = {
  athleteId: string;
  stroke: Stroke;
  distanceM: number;
  course: PoolCourse;
  mm: number;
  ss: number;
  cc: number;
  competitionId: string;
  resultId: string;
  date: string;
  source?: "seed" | "meet";
  splits?: SplitTime[];
};

export type AppState = {
  role: Role | null;
  swimmerId: string;
  online: boolean;
  syncing: boolean;
  /** Older workouts (beyond the recent window) are loaded too: the model may now use the whole history. */
  historyLoaded: boolean;
  teamName: string;
  joinCode: string;
  athletes: Athlete[];
  workouts: Workout[];
  timeLogs: TimeLog[];
  competitions: Competition[];
  meetEntries: MeetEntry[];
  meetResults: MeetResult[];
  raceSessions: RaceSession[];
  seasonPlans: SeasonPlan[];
  attendance: AttendanceSession[];
  goals: Goal[];
  hrSessions: HrSession[];
};

/** Heart rate from a watch, attached to a workout. Offsets are seconds from startedAt. */
export type HrSession = {
  id: string;
  athleteId: string;
  workoutId: string | null;
  source: "file" | "polar" | "whoop";
  startedAt: string;
  endedAt: string | null;
  avgHr: number | null;
  maxHr: number | null;
  samples: [number, number][];
  laps: { start: number; end: number; distanceM: number; avgHr: number | null; maxHr: number | null }[];
  summary: Record<string, unknown>;
};

export type GoalKind = "time" | "technical" | "other";
export type GoalMetric = "reaction" | "at15" | "dps" | "sr" | "underwater";
export type GoalStatus = "active" | "achieved" | "dropped";

export type Goal = {
  id: string;
  athleteId: string;
  /** Who set it: the coach ("o que espero") or the athlete ("o que quero"). */
  author: "coach" | "athlete";
  kind: GoalKind;
  stroke: Stroke | null;
  distanceM: number | null;
  course: PoolCourse | null;
  metric: GoalMetric | null;
  /** Seconds for time goals; metric units for technical goals. */
  targetValue: number | null;
  targetDate: string | null;
  competitionId: string | null;
  text: string;
  /** The other side's answer. */
  response: string;
  status: GoalStatus;
  achievedAt: string | null;
  createdAt: string;
};

export type GoalInput = Partial<Omit<Goal, "id" | "author" | "achievedAt" | "createdAt">> & { id?: string; athleteId: string };
