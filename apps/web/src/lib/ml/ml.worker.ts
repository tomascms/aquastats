/// <reference lib="webworker" />
import { runMlJob, type MlJob } from "./ml-jobs";

type Team = Pick<MlJob, "athletes" | "workouts" | "timeLogs">;
/** The team data of the last job: the page sends it again only when it changes (see ml-client.ts). */
let team: Team | null = null;

/* Runs the model off the main thread: the page keeps answering taps while it works (see ml-client.ts). */
self.onmessage = (event: MessageEvent<{ id: number; job: MlJob; reuse?: boolean }>) => {
  const { id, reuse } = event.data;
  try {
    if (!reuse) team = { athletes: event.data.job.athletes, workouts: event.data.job.workouts, timeLogs: event.data.job.timeLogs };
    if (!team) throw new Error("no team data");
    self.postMessage({ id, result: runMlJob({ ...event.data.job, ...team }) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
