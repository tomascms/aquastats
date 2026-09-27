import type { HrSession } from "./types";

/**
 * Heart rate is shown per session (curve + max), never guessed per rep: the watch clock and the
 * moment a time is typed poolside don't line up reliably, and a wrong per-rep value misleads.
 */
export function sessionFor(sessions: HrSession[], workoutId: string, athleteId: string): HrSession | undefined {
  return sessions.find((item) => item.workoutId === workoutId && item.athleteId === athleteId);
}

/** Reads a File as base64 without the data: prefix. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
