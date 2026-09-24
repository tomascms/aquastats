"use client";

import { Suspense } from "react";
import { TreinoAnalise } from "@/components/analise/treino-analise";

export default function CoachTreinoAnalisePage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">A carregar análise de treino…</p>}>
      <TreinoAnalise role="coach" />
    </Suspense>
  );
}
