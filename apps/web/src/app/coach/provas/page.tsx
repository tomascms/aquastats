"use client";

import { Suspense } from "react";
import { ProvaRankings } from "@/components/analise/prova-rankings";

export default function CoachProvasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">A carregar análise de prova…</p>}>
      <ProvaRankings role="coach" />
    </Suspense>
  );
}
