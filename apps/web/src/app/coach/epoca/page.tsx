"use client";

import { AcwrChart } from "@/components/season/acwr-chart";
import { SeasonPlanner } from "@/components/season/season-planner";
import { useT } from "@/i18n/provider";
import { useAppState } from "@/lib/store";

export default function SeasonPage() {
  const t = useT();
  const { workouts } = useAppState();
  return (
    <div className="space-y-5">
      <header>
        <h1>{t("Época")}</h1>
        <p className="mt-1 text-sm text-mute">
          {t("Macrociclos e cada semana dia a dia, com os treinos e as competições.")}
        </p>
      </header>
      <SeasonPlanner />
      <AcwrChart workouts={workouts} title={t("Carga A:C da equipa (média por atleta)")} />
    </div>
  );
}
