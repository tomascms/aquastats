"use client";

import { useEffect, useState } from "react";
import { ChangePasswordSection } from "@/components/settings/change-password";
import { DeleteAccountSection } from "@/components/settings/delete-account";
import { PolarConnect } from "@/components/settings/polar-connect";
import { SwimRankingsCard } from "@/components/team/swimrankings-card";
import { SeedRecordsEditor } from "@/components/team/seed-records";
import { useT, useTDynamic } from "@/i18n/provider";
import { api } from "@/lib/api";
import { GENDER_LABEL, STROKE_LABEL } from "@/lib/labels";
import { TeamJoinCode } from "@/components/team/team-join-code";
import { actions, useAppState } from "@/lib/store";
import { todayIso } from "@/lib/dates";
import type { MessageKey } from "@/i18n";
import type { Gender, GymType, SeedRecord, Stroke, WellnessEntry } from "@/lib/types";

const STROKES: Stroke[] = ["free", "back", "breast", "fly", "im"];
const GENDERS: Gender[] = ["M", "F"];
const GYM_TYPES: Array<{ value: GymType; label: MessageKey }> = [
  { value: "strength", label: "Força" },
  { value: "mobility", label: "Mobilidade" },
  { value: "explosive", label: "Explosão" },
];

export default function SwimmerDefinicoesPage() {
  const t = useT();
  const td = useTDynamic();
  const { athletes, swimmerId, teamName } = useAppState();
  const me = athletes.find((athlete) => athlete.id === swimmerId);
  const personalOnly = Boolean(me?.id.startsWith("profile-"));
  const [name, setName] = useState(me?.name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(me?.dateOfBirth ?? "");
  const [primaryStroke, setPrimaryStroke] = useState<Stroke | "">(me?.primaryStroke ?? "");
  const [gender, setGender] = useState<Gender | "">(me?.gender === "M" || me?.gender === "F" ? me.gender : "");
  const [seedRecords, setSeedRecords] = useState<SeedRecord[]>(me?.seedRecords ?? []);
  const [wellnessDate, setWellnessDate] = useState(todayIso());
  const [sleepHours, setSleepHours] = useState("");
  const [gym, setGym] = useState<GymType | "">("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    void api<{ email?: string | null; hasPassword?: boolean }>("/api/v1/auth/me")
      .then((profile) => {
        setEmail(profile.email || "");
        setHasPassword(Boolean(profile.hasPassword));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setDateOfBirth(me.dateOfBirth ?? "");
    setPrimaryStroke(me.primaryStroke ?? "");
    setGender(me.gender === "M" || me.gender === "F" ? me.gender : "");
    setSeedRecords(me.seedRecords ?? []);
    const todayWellness = (me.wellness ?? []).find((entry) => entry.date === wellnessDate);
    setSleepHours(todayWellness?.sleepHours == null ? "" : String(todayWellness.sleepHours));
    setGym(todayWellness?.gym ?? "");
  }, [me?.id]);

  // Records can change underneath (SwimRankings import): never save a stale copy over them.
  useEffect(() => {
    if (me?.seedRecords) setSeedRecords(me.seedRecords);
  }, [me?.seedRecords]);

  if (!me) {
    return <p className="text-sm text-mute">{t("A preparar a tua ficha…")}</p>;
  }

  const athleteId = me.id;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const currentWellness = me?.wellness ?? [];
    const payload = {
      name: name.trim(),
      dateOfBirth,
      primaryStroke,
      isPlaceholder: false,
      gender,
    };
    try {
      if (personalOnly) await actions.updateSwimmerProfile(payload);
      else await actions.updateAthlete(athleteId, payload);
      setSaved(t("Guardado"));
      window.setTimeout(() => setSaved(""), 1800);
    } catch (err) {
      setError(td((err as { detail?: string }).detail || "Não foi possível guardar."));
    } finally {
      setBusy(false);
    }
  }

  async function leaveTeam() {
    if (!window.confirm(t("Queres sair da equipa? Os teus tempos e dados ficam na equipa e não passam para outra."))) return;
    setBusy(true);
    setError("");
    try {
      await actions.leaveTeam();
      window.location.assign("/swimmer");
    } catch (err) {
      setError(td((err as { detail?: string }).detail || "Não foi possível sair da equipa."));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Definições")}</h1>
        <p className="mt-1 text-sm text-mute">
          {personalOnly
            ? t("Preenche a tua ficha enquanto esperas pelo código ou link da equipa.")
            : t("Os teus dados. O treinador não os altera.")}
        </p>
      </div>

      {!teamName ? <TeamJoinCode compact /> : null}

      <form onSubmit={(event) => void save(event)} className="card space-y-3 p-4">
        <label className="block text-sm">
          {t("Email")}
          <input className="field mt-1.5 bg-ink-2" value={email} readOnly />
        </label>
        <p className="text-sm text-mute">
          <a href="#seguranca" className="text-mist underline-offset-2 hover:underline">
            {hasPassword ? t("Alterar palavra-passe") : t("Definir palavra-passe")}
          </a>
        </p>
        <label className="block text-sm">
          {t("Nome")}
          <input className="field mt-1.5" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block text-sm">
          {t("Data de nascimento")}
          <input
            type="date"
            className="field mt-1.5"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </label>
        <div>
          <p className="text-sm">{t("Estilo principal")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {STROKES.map((stroke) => (
              <button
                key={stroke}
                type="button"
                onClick={() => setPrimaryStroke((current) => (current === stroke ? "" : stroke))}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  primaryStroke === stroke ? "bg-aqua text-ink" : "border border-line text-mute"
                }`}
              >
                {STROKE_LABEL[stroke]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm">{t("Sexo")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {GENDERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGender(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  gender === item ? "bg-aqua text-ink" : "border border-line text-mute"
                }`}
              >
                {GENDER_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={busy} className="btn-primary h-10 w-full">
          {t("Guardar")}
        </button>
        {saved ? <p className="text-sm text-mute">{saved}</p> : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
      </form>


      {teamName ? <SwimRankingsCard athlete={me} role="swimmer" /> : null}

      {teamName ? <PolarConnect /> : null}

      {teamName ? (
        <section className="card space-y-3 p-4">
          <div>
            <h2 className="text-lg font-semibold">{t("Sair da equipa")}</h2>
            <p className="mt-1 text-sm text-mute">
              {t("Os tempos e dados que registaste nesta equipa ficam com o clube. Não os levas para outra equipa.")}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => void leaveTeam()} className="h-10 w-full rounded-md border border-coral/40 text-sm text-coral hover:bg-coral/10">
            {t("Sair da equipa")}
          </button>
        </section>
      ) : null}

      <ChangePasswordSection hasPassword={hasPassword} onPasswordSet={() => setHasPassword(true)} />
      <DeleteAccountSection hasPassword={hasPassword} />
    </div>
  );
}