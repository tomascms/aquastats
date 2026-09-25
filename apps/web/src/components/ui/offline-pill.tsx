"use client";

import { pendingCount, useAppState } from "@/lib/store";
import { IconWifi, IconWifiOff } from "@/components/ui/icons";

export function OfflinePill() {
  const { online, timeLogs } = useAppState();
  const pending = pendingCount(timeLogs);

  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        online ? "bg-good-soft text-good" : "bg-[#fdecea] text-coral"
      }`}
      title={pending > 0 ? `${pending} tempos por sincronizar` : undefined}
    >
      {online ? <IconWifi /> : <IconWifiOff />}
      {online ? (pending > 0 ? `Sync ${pending}` : "Online") : pending > 0 ? `${pending} pendente` : "Sem rede"}
    </span>
  );
}
