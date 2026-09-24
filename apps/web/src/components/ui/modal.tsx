"use client";

import { useEffect } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-xl">
        <h2 id="modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
