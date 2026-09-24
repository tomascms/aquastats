"use client";

import { pendingCount, useAppState } from "@/lib/store";
import { IconWifi, IconWifiOff } from "@/components/ui/icons";

export function OfflinePill() {
  const { online, timeLogs } = useAppState();
  const pending = pendingCount(timeLogs);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
        online ? "border-aqua/20 bg-aqua/10 text-aqua" : "border-sand/25 bg-sand/10 text-sand"
      }`}
      title={pending > 0 ? `${pending} tempos por sincronizar` : undefined}
    >
      {online ? <IconWifi /> : <IconWifiOff />}
      {online ? (pending > 0 ? `Sync ${pending}` : "Online") : pending > 0 ? `${pending} pendente` : "Sem rede"}
    </span>
  );
}
