/// <reference lib="webworker" />
import { runMlJob, type MlJob } from "./ml-jobs";

/* Runs the model off the main thread: the page keeps answering taps while it works (see ml-client.ts). */
self.onmessage = (event: MessageEvent<{ id: number; job: MlJob }>) => {
  const { id, job } = event.data;
  try {
    self.postMessage({ id, result: runMlJob(job) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
