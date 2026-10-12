"use client";

import type { MlJob, MlJobResult } from "./ml-jobs";

/*
 * Sends model jobs to a Web Worker (ml.worker.ts), one at a time, so the timing matrix never waits for the
 * model. Without workers (very old browsers) the job runs after the page is idle, loaded on demand.
 */

type Pending = { resolve: (result: MlJobResult) => void; reject: (error: Error) => void };

let worker: Worker | null | undefined;
let sequence = 0;
/** What the worker already holds: copying 300k+ time logs to it froze the page ~0.3 s on every workout visit. */
let sent: Pick<MlJob, "athletes" | "workouts" | "timeLogs"> | null = null;
const pending = new Map<number, Pending>();

function startWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    const created = new Worker(new URL("./ml.worker.ts", import.meta.url), { type: "module" });
    created.onmessage = (event: MessageEvent<{ id: number; result?: MlJobResult; error?: string }>) => {
      const waiting = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (!waiting) return;
      if (event.data.error !== undefined) waiting.reject(new Error(event.data.error));
      else waiting.resolve(event.data.result as MlJobResult);
    };
    created.onerror = () => {
      // A worker that fails to load: finish what was waiting inline and stop using workers.
      for (const [, waiting] of pending) waiting.reject(new Error("ml worker failed"));
      pending.clear();
      worker = null;
      sent = null;
    };
    return created;
  } catch {
    return null;
  }
}

async function runInline(job: MlJob): Promise<MlJobResult> {
  await new Promise<void>((resolve) =>
    "requestIdleCallback" in window ? window.requestIdleCallback(() => resolve(), { timeout: 3000 }) : setTimeout(resolve, 0),
  );
  const { runMlJob } = await import("./ml-jobs");
  return runMlJob(job);
}

export function runMlJob(job: MlJob): Promise<MlJobResult> {
  if (worker === undefined) worker = startWorker();
  const target = worker;
  if (!target) return runInline(job);
  const id = ++sequence;
  return new Promise<MlJobResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const reuse = sent?.athletes === job.athletes && sent.workouts === job.workouts && sent.timeLogs === job.timeLogs;
    if (reuse) target.postMessage({ id, job: { ...job, athletes: [], workouts: [], timeLogs: [] }, reuse });
    else {
      target.postMessage({ id, job });
      sent = { athletes: job.athletes, workouts: job.workouts, timeLogs: job.timeLogs };
    }
  }).catch(() => runInline(job));
}
