export type Role = "coach" | "swimmer" | "pending";

export type Shift = "morning" | "afternoon";

export type BlockType = "warmup" | "main" | "recovery";

export type Stroke = "free" | "back" | "breast" | "fly" | "im";

export type Intensity = "SUAVE" | "A1" | "A2" | "A3" | "PA" | "MAX" | "P50" | "P100" | "P200" | "P400";

export type Gear = "legs" | "arms" | "paddles" | "pullbuoy" | "parachute" | "fins";

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
};

export type RepDetail = {
  intensity: Intensity;
  sendOffSeconds: number;
  fromBlock: boolean;
  gear: Gear[];
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
};

export type WorkoutBlock = {
  id: string;
  type: BlockType;
  rounds: number;
  noSendOff: boolean;
  segments: SetSegment[];
  betweenRounds: { distanceM: number } | null;
};

export type Workout = {
  id: string;
  title: string;
  date: string;
  shift: Shift;
  course?: PoolCourse | "";
  athleteIds: string[];
  blocks: WorkoutBlock[];
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
  type: string;
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
};

export type MeetResult = {
  id: string;
  entryId: string;
  mm: number;
  ss: number;
  cc: number;
  splits: SplitTime[];
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
};
