"use client";

import { useT } from "@/i18n/provider";
import { pendingCount, useAppState } from "@/lib/store";
import { IconWifi, IconWifiOff } from "@/components/ui/icons";

/**
 * Connection status. `compact` (crowded mobile header) drops the word "Online" when everything
 * is synced — the icon is enough — but keeps the text whenever something needs attention.
 */
export function OfflinePill({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { online, timeLogs } = useAppState();
  const pending = pendingCount(timeLogs);
  const quiet = compact && online && pending === 0;
  const label = online
    ? pending > 0
      ? t("Sync {count}", { count: pending })
      : t("Online")
    : pending > 0
      ? t("{count} pendente", { count: pending })
      : t("Sem rede");

  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full py-1 text-[11px] font-semibold ${
        quiet ? "px-1.5" : "px-2.5"
      } ${online ? "bg-good-soft text-good" : "bg-[#fdecea] text-coral"}`}
      title={pending > 0 ? t("{count} tempos por sincronizar", { count: pending }) : quiet ? label : undefined}
      role="status"
      aria-label={quiet ? label : undefined}
    >
      {online ? <IconWifi /> : <IconWifiOff />}
      {quiet ? null : label}
    </span>
  );
}
