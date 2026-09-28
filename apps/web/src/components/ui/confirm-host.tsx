"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import { answerConfirm, getConfirm, subscribeConfirm } from "@/lib/confirm";

export function ConfirmHost() {
  const t = useT();
  const request = useSyncExternalStore(subscribeConfirm, getConfirm, () => null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") answerConfirm(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={request.message ? "confirm-message" : undefined}
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t("Cancelar")} onClick={() => answerConfirm(false)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-semibold text-mist">
          {request.title}
        </h2>
        {request.message ? (
          <p id="confirm-message" className="mt-1.5 text-sm text-mute">
            {request.message}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => answerConfirm(false)}>
            {request.cancelLabel ?? t("Cancelar")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={request.destructive ? "btn-primary !bg-coral" : "btn-primary"}
            onClick={() => answerConfirm(true)}
          >
            {request.confirmLabel ?? t("Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
