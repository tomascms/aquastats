"use client";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  ttlMs: number;
};

type Listener = () => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function pushToast(input: Omit<Toast, "id" | "ttlMs"> & { ttlMs?: number }) {
  const toast: Toast = {
    id: crypto.randomUUID?.() ?? `${Date.now()}`,
    ttlMs: input.ttlMs ?? (input.tone === "error" ? 8000 : 4000),
    ...input,
  };
  toasts = [toast, ...toasts].slice(0, 4);
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(toast.id), toast.ttlMs);
  }
  return toast.id;
}

export const toast = {
  success(message: string, detail?: string) {
    pushToast({ tone: "success", message, detail });
  },
  error(message: string, detail?: string, onAction?: () => void) {
    pushToast({
      tone: "error",
      message,
      detail,
      actionLabel: onAction ? "Repetir" : undefined,
      onAction,
    });
  },
  info(message: string, detail?: string) {
    pushToast({ tone: "info", message, detail });
  },
};
