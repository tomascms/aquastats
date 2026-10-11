"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import { dismissToast, getToasts, subscribeToasts, type Toast } from "@/lib/toast";

const NO_TOASTS: Toast[] = [];

export function ToastHost() {
  const t = useT();
  const items = useSyncExternalStore(subscribeToasts, getToasts, () => NO_TOASTS);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 shadow-lg sm:w-auto ${
            item.tone === "error"
              ? "border-coral/30 bg-panel text-mist"
              : item.tone === "success"
                ? "border-aqua/20 bg-panel text-mist"
                : "border-line bg-panel text-mist"
          }`}
        >
          <p className="text-sm font-semibold">{item.message}</p>
          {item.detail ? <p className="mt-1 text-xs text-mute">{item.detail}</p> : null}
          <div className="mt-2 flex gap-2">
            {item.onAction ? (
              <button
                type="button"
                className="text-xs font-semibold text-aqua"
                onClick={() => {
                  item.onAction?.();
                  dismissToast(item.id);
                }}
              >
                {item.actionLabel ?? t("Repetir")}
              </button>
            ) : null}
            <button type="button" className="text-xs text-mute hover:text-mist" onClick={() => dismissToast(item.id)}>
              {t("Fechar")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
