"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { formatApiError, type ApiError } from "@/lib/api";
import { formatDatePt } from "@/lib/labels";
import { actions } from "@/lib/store";
import { PersonalBests } from "@/components/team/personal-bests";
import { toast } from "@/lib/toast";
import type { Athlete } from "@/lib/types";

/**
 * Personal bests from the athlete's SwimRankings profile. SwimRankings doesn't allow automated
 * access, so the user copies the profile page in their own browser and pastes it here; only final
 * times are read and nothing already in Aquastats is replaced.
 */
export function SwimRankingsCard({ athlete, role }: { athlete: Athlete; role: "coach" | "swimmer" }) {
  const t = useT();
  const [url, setUrl] = useState(athlete.swimrankingsUrl ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await actions.importSwimRankings(athlete.id, {
        ...(url.trim() !== (athlete.swimrankingsUrl ?? "") ? { url: url.trim() } : {}),
        ...(text.trim() ? { text } : {}),
      });
      setText("");
      if (text.trim()) {
        toast.success(t("Recordes atualizados."), t("{added} novos · {updated} melhorados · {kept} já estavam no Aquastats", { added: result.added, updated: result.updated, kept: result.kept }));
      }
    } catch (error) {
      toast.error(formatApiError(error as ApiError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel-2 px-4 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Recordes pessoais")}</h2>
        {athlete.swimrankingsSyncedAt ? (
          <span className="text-[11px] text-mute">{t("atualizado a {date}", { date: formatDatePt(athlete.swimrankingsSyncedAt.slice(0, 10)) })}</span>
        ) : null}
      </header>
      <div className="space-y-3 px-4 py-3">
        <label className="block text-xs font-semibold text-mute">
          {t("Link do perfil")}
          <span className="mt-1 flex gap-2">
            <input
              className="field h-9 py-1 text-sm"
              inputMode="url"
              placeholder="https://www.swimrankings.net/index.php?page=athleteDetail&athleteId=…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            {athlete.swimrankingsUrl ? (
              <a href={athlete.swimrankingsUrl} target="_blank" rel="noreferrer" className="btn-ghost h-9 shrink-0 px-3 text-sm">
                {t("Abrir perfil")}
              </a>
            ) : null}
          </span>
        </label>
        <div>
          <p className="text-xs text-mute">
            {t("Para atualizar: abre o perfil, carrega Ctrl+A e Ctrl+C, e cola aqui. Só entram os tempos finais; o que já está no Aquastats não é alterado.")}
          </p>
          <textarea
            className="field mt-1 h-20 py-2 font-mono text-xs"
            placeholder={t("Cola aqui a página do perfil…")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-primary h-9" disabled={busy || (!text.trim() && url.trim() === (athlete.swimrankingsUrl ?? ""))} onClick={() => void run()}>
            {busy ? t("A ler…") : text.trim() ? t("Atualizar recordes") : t("Guardar link")}
          </button>
        </div>
      </div>

      <PersonalBests athlete={athlete} role={role} />
    </section>
  );
}
