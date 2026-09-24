"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { homeFor } from "@/lib/auth";
import { normalizeInvite, writeInviteCookie } from "@/lib/invite";
import { safeNext } from "@/lib/safe-next";
import { actions, useAppState, useAuthBoot } from "@/lib/store";

type ChooseStatus = { coachSignupEnabled?: boolean };

export default function ChooseRolePage() {
  const router = useRouter();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();
  const [busy, setBusy] = useState<"coach" | "swimmer" | null>(null);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState("");
  const [askTeam, setAskTeam] = useState(false);
  const [coachSignupEnabled, setCoachSignupEnabled] = useState(false);
  const [teamCode, setTeamCode] = useState("");

  useEffect(() => {
    void fetch("/api/v1/auth/status")
      .then((res) => res.json())
      .then((status: ChooseStatus) => setCoachSignupEnabled(Boolean(status.coachSignupEnabled)))
      .catch(() => setCoachSignupEnabled(false));
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!role) router.replace("/entrar");
    if (role === "coach" || role === "swimmer") router.replace(homeFor(role));
  }, [bootstrapped, role, router]);

  async function choose(next: "coach" | "swimmer") {
    if (next === "coach" && !coachSignupEnabled) {
      setError("Registo de treinador indisponível. Pagamentos em breve.");
      return;
    }
    if (next === "coach" && !askTeam) {
      setAskTeam(true);
      return;
    }
    if (next === "coach" && !teamName.trim()) {
      setError("Escreve o nome da equipa.");
      return;
    }
    setBusy(next);
    setError("");
    try {
      const invite = normalizeInvite(teamCode);
      if (invite) writeInviteCookie(invite);
      const path = await actions.chooseRole(next, teamName.trim(), invite);
      window.location.assign(safeNext(path, homeFor(next)));
    } catch (err) {
      setError((err as { detail?: string }).detail || "Não foi possível guardar a escolha.");
      setBusy(null);
    }
  }

  if (!bootstrapped || role !== "pending") {
    return <p className="px-5 py-16 text-center text-sm text-mute">A preparar…</p>;
  }

  return (
    <AuthFrame>
      {askTeam ? (
        <>
          <p className="metric-label">Perfil treinador</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-mist">Nome da equipa</h1>
          <p className="mt-2 text-sm leading-6 text-mute">Este nome identifica o espaço onde vais gerir atletas, treinos e competições.</p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void choose("coach");
            }}
          >
            <label className="block text-sm">
              Equipa
              <input
                className="field mt-1.5"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                autoFocus
                required
              />
            </label>
            <button type="submit" disabled={busy !== null} className="btn-primary h-11 w-full">
              {busy ? "A criar…" : "Continuar"}
            </button>
          </form>
          <button type="button" className="mt-4 text-sm font-medium text-mute hover:text-mist" onClick={() => setAskTeam(false)}>
            Voltar
          </button>
        </>
      ) : (
        <>
          <p className="metric-label">Configuração inicial</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-mist">Escolhe o teu perfil</h1>
          <p className="mt-2 text-sm leading-6 text-mute">A experiência adapta-se ao teu trabalho na piscina. Podes entrar como treinador ou atleta.</p>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              disabled={busy !== null || !coachSignupEnabled}
              onClick={() => void choose("coach")}
              className="group rounded-xl border border-line bg-ink px-4 py-4 text-left transition hover:border-aqua/35 hover:bg-aqua-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-mist">Treinador</span>
                  <span className="mt-1 block text-xs leading-5 text-mute">Planeia sessões, acompanha a equipa e analisa resultados.</span>
                </span>
                <span className="text-lg text-aqua transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </span>
            </button>
            {!coachSignupEnabled && (
              <p className="-mt-1 text-xs text-mute">Registo de treinador disponível após activar pagamentos.</p>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void choose("swimmer")}
              className="group rounded-xl border border-line bg-ink px-4 py-4 text-left transition hover:border-aqua/35 hover:bg-aqua-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-mist">Atleta</span>
                  <span className="mt-1 block text-xs leading-5 text-mute">Consulta treinos, tempos, provas e evolução pessoal.</span>
                </span>
                <span className="text-lg text-aqua transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </span>
            </button>
          </div>
          <label className="mt-5 block text-sm font-medium text-mist">
            Código da equipa <span className="font-normal text-mute">(opcional)</span>
            <input
              className="field mt-1.5 uppercase tracking-widest"
              value={teamCode}
              onChange={(event) =>
                setTeamCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
              }
              placeholder="ABCD1234"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
            />
          </label>
        </>
      )}
      {(error || bootError) && (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error || bootError}
        </p>
      )}
    </AuthFrame>
  );
}
