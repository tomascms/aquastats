"use client";

import { Suspense } from "react";
import { ProvaRankings } from "@/components/analise/prova-rankings";
import { useT } from "@/i18n/provider";

export default function SwimmerProvasPage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("A carregar análise de prova…")}</p>}>
      <ProvaRankings role="swimmer" />
    </Suspense>
  );
}
