"use client";

import { useState } from "react";
import { AthleteChips } from "@/components/analise/athlete-chips";
import { LoadResponse } from "@/components/season/load-response";
import { SeasonPlanner } from "@/components/season/season-planner";
import { ZoneDistribution } from "@/components/season/zone-distribution";
import { useT } from "@/i18n/provider";
import { useAppState } from "@/lib/store";

export default function SeasonPage() {
  const t = useT();
  const { athletes } = useAppState();
  const [picked, setPicked] = useState("");
  const athlete = athletes.find((item) => item.id === picked) ?? athletes[0];
  return (
    <div className="space-y-5">
      <header>
        <h1>{t("Época")}</h1>
        <p className="mt-1 text-sm text-mute">
          {t("Macrociclos e cada semana dia a dia, com os treinos e as competições.")}
        </p>
      </header>
      <SeasonPlanner />
      <ZoneDistribution />
      {athlete ? (
        <div className="space-y-3">
          <AthleteChips athletes={athletes} selectedId={athlete.id} onSelect={setPicked} />
          <LoadResponse athlete={athlete} />
        </div>
      ) : null}
    </div>
  );
}
