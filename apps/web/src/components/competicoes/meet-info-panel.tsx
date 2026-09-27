"use client";

import { useState } from "react";
import { useT, useTDynamic } from "@/i18n/provider";
import { formatApiError, type ApiError } from "@/lib/api";
import { actions } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Competition } from "@/lib/types";

const LIVE_STATUS: Record<string, string> = {
  waiting: "À espera dos primeiros resultados",
  following: "A acompanhar",
  catchingUp: "A importar…",
  finished: "Competição terminada",
  needsClub: "Não encontrei o clube nos resultados",
};

/**
 * What the organiser published, kept next to the selection: the live-results link (followed
 * automatically during the meet) and the key facts from the regulations.
 */
export function MeetInfoPanel({ meet, highlightLive = false }: { meet: Competition; highlightLive?: boolean }) {
  const t = useT();
  const td = useTDynamic();
  const [url, setUrl] = useState(meet.live?.url ?? "");
  const [busy, setBusy] = useState(false);

  async function save(next: string | null) {
    setBusy(true);
    try {
      await actions.setLiveLink(meet.id, next);
      if (next) {
        const result = await actions.syncLive(meet.id);
        toast.success(
          t("Resultados em direto ligados."),
          result.imported ? t("{count} ficheiros importados.", { count: result.imported }) : t("Vou verificando enquanto a competição decorre."),
        );
      }
    } catch (error) {
      toast.error(formatApiError(error as ApiError));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const result = await actions.syncLive(meet.id);
      toast.info(result.imported ? t("{count} ficheiros importados.", { count: result.imported }) : t("Sem novidades nos resultados."));
    } catch (error) {
      toast.error(formatApiError(error as ApiError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`overflow-hidden rounded-xl border bg-panel ${highlightLive ? "border-pool ring-2 ring-pool/20" : "border-line"}`}>
      <div className="border-b border-line px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Resultados em direto")}</p>
        {highlightLive ? (
          <p className="mt-1 text-sm text-mist">{t("Start list importada. Cola agora o link dos resultados em direto (na página da prova no SwimRankings) e os resultados entram sozinhos à medida que saem.")}</p>
        ) : null}
        {meet.live?.url ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-mist">
              <span className={`h-2 w-2 rounded-full ${meet.live.status === "following" || meet.live.status === "catchingUp" ? "bg-good" : "bg-mute"}`} />
              {td(LIVE_STATUS[meet.live.status ?? "waiting"] ?? LIVE_STATUS.waiting)}
            </span>
            {meet.live.lastSyncAt ? (
              <span className="text-xs text-mute">
                {t("última verificação {time}", { time: meet.live.lastSyncAt.slice(11, 16) })}
              </span>
            ) : null}
            <a href={meet.live.url} target="_blank" rel="noreferrer" className="truncate text-xs text-pool hover:underline">
              {meet.live.url.replace("https://", "")}
            </a>
            <span className="ml-auto flex gap-3 text-xs font-semibold">
              <button type="button" disabled={busy} className="text-pool hover:underline" onClick={() => void refresh()}>
                {t("Verificar agora")}
              </button>
              <button type="button" disabled={busy} className="text-coral hover:underline" onClick={() => void save(null)}>
                {t("Desligar")}
              </button>
            </span>
          </div>
        ) : (
          <form
            className="mt-1.5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (url.trim()) void save(url.trim());
            }}
          >
            <input
              className="field h-9 py-1 text-sm"
              placeholder="https://live.swimrankings.net/10242/"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              inputMode="url"
            />
            <button type="submit" disabled={busy || !url.trim()} className="btn-primary h-9 shrink-0 px-3 text-sm">
              {t("Ligar")}
            </button>
          </form>
        )}
      </div>

      {meet.rules?.length ? (
        <table className="w-full text-sm">
          <caption className="bg-panel-2 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-mute">
            {t("Regulamento")}
          </caption>
          <tbody>
            {meet.rules.map((fact) => (
              <tr key={fact.label} className="border-t border-line">
                <th className="w-40 px-4 py-1.5 text-left align-top text-xs font-semibold text-mute">{td(fact.label)}</th>
                <td className="px-4 py-1.5 text-mist">{fact.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
