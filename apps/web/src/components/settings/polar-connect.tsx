"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { api } from "@/lib/api";
import { actions } from "@/lib/store";
import { toast } from "@/lib/toast";
import { formatDatePt } from "@/lib/labels";

type PolarStatus = { available: boolean; linked: boolean; lastSyncAt: string | null };

/** Link once; afterwards Polar sessions land on the matching workout by themselves. Hidden when not configured. */
export function PolarConnect() {
  const t = useT();
  const [status, setStatus] = useState<PolarStatus | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ polar: PolarStatus }>("/api/v1/integrations/status");
      setStatus(data.polar);
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    void load();
    const result = new URLSearchParams(window.location.search).get("polar");
    if (result === "ok") toast.success(t("Conta Polar ligada."), t("Os treinos novos aparecem sozinhos no treino certo."));
    else if (result === "error") toast.error(t("Não foi possível ligar a conta Polar."));
    if (result) window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status?.available) return null;

  async function importNow() {
    setBusy(true);
    const imported = await actions.syncWatches(true);
    toast.info(imported ? t("{count} treinos importados da Polar.", { count: imported }) : t("Sem treinos novos na Polar."));
    await load();
    setBusy(false);
  }

  async function disconnect() {
    if (!window.confirm(t("Desligar a conta Polar? Os batimentos já importados ficam."))) return;
    setBusy(true);
    try {
      await api("/api/v1/integrations/polar", { method: "DELETE", idempotencyKey: `polar-off-${Date.now()}` });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("Relógio Polar")}</h2>
        <p className="mt-1 text-sm text-mute">
          {status.linked
            ? status.lastSyncAt
              ? t("Ligado · última verificação {when}", { when: `${formatDatePt(status.lastSyncAt.slice(0, 10))} ${status.lastSyncAt.slice(11, 16)}` })
              : t("Ligado")
            : t("Liga uma vez e a frequência cardíaca de cada treino aparece junto dos teus tempos.")}
        </p>
      </div>
      {status.linked ? (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void importNow()} className="btn-primary h-10 flex-1">
            {t("Importar agora")}
          </button>
          <button type="button" disabled={busy} onClick={() => void disconnect()} className="h-10 rounded-md border border-line px-4 text-sm text-mute hover:text-mist">
            {t("Desligar")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => window.location.assign("/api/v1/integrations/polar/start")}
          className="btn-primary h-10 w-full"
        >
          {t("Ligar conta Polar")}
        </button>
      )}
    </section>
  );
}
