"use client";

import { SeasonPlanner } from "@/components/season/season-planner";
import { useT } from "@/i18n/provider";

export default function SeasonPage() {
  const t = useT();
  return (
    <div className="space-y-5">
      <header>
        <h1>{t("Época")}</h1>
        <p className="mt-1 text-sm text-mute">
          {t("Macrociclos e cada semana dia a dia, com os treinos e as competições.")}
        </p>
      </header>
      <SeasonPlanner />
    </div>
  );
}
