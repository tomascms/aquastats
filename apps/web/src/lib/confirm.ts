/**
 * The site's own confirmation dialog (never the browser's confirm()). Call `confirmDialog(...)` and
 * await the answer; <ConfirmHost /> in the root layout renders it.
 */

export type ConfirmRequest = {
  id: number;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for deletions and other things that can't be undone. */
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

let current: ConfirmRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function confirmDialog(options: Omit<ConfirmRequest, "id" | "resolve">): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...options, id: nextId++, resolve };
    emit();
  });
}

export function answerConfirm(ok: boolean) {
  const request = current;
  current = null;
  emit();
  request?.resolve(ok);
}

export function subscribeConfirm(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConfirm() {
  return current;
}
