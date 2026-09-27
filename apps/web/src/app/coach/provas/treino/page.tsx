"use client";

import { Suspense } from "react";
import { TreinoAnalise } from "@/components/analise/treino-analise";
import { useT } from "@/i18n/provider";

export default function CoachTreinoAnalisePage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="text-sm text-mute">{t("A carregar análise de treino…")}</p>}>
      <TreinoAnalise role="coach" />
    </Suspense>
  );
}
