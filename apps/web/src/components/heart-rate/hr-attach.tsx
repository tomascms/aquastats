"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatApiError, type ApiError } from "@/lib/api";
import { fileToBase64 } from "@/lib/heart-rate";
import { actions } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { HrSession } from "@/lib/types";

/**
 * One quiet line on the workout: attach the watch file, or show the session summary once attached.
 * Heart rate then appears next to each rep; there is no separate screen for it.
 */
export function HrAttach({ athleteId, workoutId, session }: { athleteId: string; workoutId: string; session?: HrSession }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const saved = await actions.uploadHeartRate({ name: file.name, data: await fileToBase64(file) }, athleteId);
      toast.success(saved.workoutId === workoutId ? t("Frequência cardíaca adicionada ao treino.") : t("Ficheiro guardado, mas é de outro dia."));
    } catch (error) {
      toast.error(formatApiError(error as ApiError));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
      {session ? (
        <>
          <span className="font-mono text-coral">♥</span>
          <span>
            {t("Média {avg} · máx. {max} bpm", { avg: session.avgHr ?? "—", max: session.maxHr ?? "—" })}
          </span>
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => void actions.deleteHeartRate(session.id)}>
            {t("Remover")}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          className="underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
          onClick={() => input.current?.click()}
        >
          {busy ? t("A ler ficheiro…") : t("♥ Juntar ficheiro do relógio (.FIT/.TCX)")}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept=".fit,.tcx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
