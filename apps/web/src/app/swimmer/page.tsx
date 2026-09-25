"use client";

import Link from "next/link";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, formatDatePt, strokeLabel } from "@/lib/labels";
import { formatSet } from "@/lib/set";
import { todayIso } from "@/lib/dates";
import { athleteVolumeM, formatMeters } from "@/lib/rankings";
import { TeamJoinCode } from "@/components/team/team-join-code";
import { useAppState } from "@/lib/store";

export default function SwimmerHomePage() {
  const { athletes, swimmerId, workouts, timeLogs, teamName } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId) ?? athletes[0];
  if (!teamName) {
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-line bg-panel p-5">
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ainda sem equipa</h1>
          <p className="mt-3 text-sm leading-relaxed text-mute">
            Enquanto esperas, podes preencher a tua ficha e recordes pessoais em Definições. Quando tiveres o código ou
            link do treinador, entra na equipa abaixo.
          </p>
          <Link href="/swimmer/definicoes" className="mt-4 flex h-11 items-center justify-center rounded-2xl border border-line text-sm font-semibold">
            Abrir definições
          </Link>
        </section>
        <TeamJoinCode />
      </div>
    );
  }
  const today = workouts.find((workout) => workout.date === todayIso()) ?? workouts[0];
  const mine = timeLogs.filter((log) => log.athleteId === me?.id && log.workoutId === today?.id);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-aqua/20 bg-panel p-5">
        <p className="text-xs font-semibold text-aqua">
          Olá{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{today?.title ?? "Ainda sem treino"}</h1>
        <p className="mt-2 text-sm text-mute">
          {today
            ? `${formatDatePt(today.date)} · ${SHIFT_LABEL[today.shift]}${today.course === "scm" || today.course === "lcm" ? ` · ${COURSE_LABEL[today.course]}` : ""}`
            : ""}
          {me && strokeLabel(me.primaryStroke) ? ` · ${strokeLabel(me.primaryStroke)}` : ""}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-ink-2 px-3 py-3">
            <p className="text-xs tracking-[0.16em] text-mute">Volume</p>
            <p className="font-mono text-xl text-aqua">{formatMeters(me ? athleteVolumeM(workouts, me.id) : 0)}</p>
          </div>
          <div className="rounded-2xl bg-ink-2 px-3 py-3">
            <p className="text-xs tracking-[0.16em] text-mute">Tempos hoje</p>
            <p className="text-xl font-semibold tracking-tight">{mine.length}</p>
          </div>
        </div>
        {today ? (
          <Link
            href={`/swimmer/workout/${today.id}`}
            className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-aqua text-sm font-medium text-ink"
          >
            Ver a minha série
          </Link>
        ) : (
          <p className="mt-5 text-sm text-mute">Quando o treinador te convocar, o treino aparece aqui.</p>
        )}
        {!(me?.seedRecords?.length) ? (
          <Link href="/swimmer/definicoes" className="mt-3 flex h-11 items-center justify-center rounded-2xl border border-line text-sm font-semibold">
            Meter recordes pessoais
          </Link>
        ) : null}
        <Link href="/swimmer/provas" className="mt-3 flex h-11 items-center justify-center rounded-2xl border border-line text-sm font-semibold">
          As minhas provas
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Blocos de hoje</h2>
        <div className="space-y-2">
          {today?.blocks.map((block) => {
            const count = mine.filter((log) => log.blockId === block.id).length;
            return (
              <div key={block.id} className="rounded-2xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold">{BLOCK_LABEL[block.type]}</p>
                <p className="text-xs text-mute">
                  {formatSet(block)} · {count} tempos teus
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
