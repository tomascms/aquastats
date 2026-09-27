"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

/**
 * Two-step destructive button that works everywhere (the browser's confirm() dialog is blocked in
 * embedded browsers and some PWAs): first click arms it, second click within a few seconds acts.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = "",
  armedClassName = "bg-coral text-white",
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  armedClassName?: string;
}) {
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={busy}
      aria-live="polite"
      className={`${className} ${armed ? armedClassName : ""}`}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      {armed ? confirmLabel ?? t("Confirmar") : label}
    </button>
  );
}
