"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { homeFor } from "@/lib/auth";
import { normalizeInvite, writeInviteCookie } from "@/lib/invite";
import { formatDatePt } from "@/lib/labels";
import { safeNext } from "@/lib/safe-next";
import { actions, useAppState, useAuthBoot } from "@/lib/store";

type CoachRequest = { requested: boolean; requestedAt?: string | null; teamName?: string | null };

export default function ChooseRolePage() {
  const router = useRouter();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();
  const [busy, setBusy] = useState<"coach" | "swimmer" | null>(null);
  const [error, setError] = useState("");
  const [askCoach, setAskCoach] = useState(false);
  const [teamCode, setTeamCode] = useState("");
  const [request, setRequest] = useState<CoachRequest | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", teamName: "", message: "" });

  useEffect(() => {
    if (!bootstrapped || role !== "pending") return;
    void api<CoachRequest>("/api/v1/auth/coach-request")
      .then(setRequest)
      .catch(() => setRequest({ requested: false }));
  }, [bootstrapped, role]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!role) router.replace("/entrar");
    if (role === "coach" || role === "swimmer") router.replace(homeFor(role));
  }, [bootstrapped, role, router]);

  async function chooseSwimmer() {
    setBusy("swimmer");
    setError("");
    try {
      const invite = normalizeInvite(teamCode);
      if (invite) writeInviteCookie(invite);
      const path = await actions.chooseRole("swimmer", "", invite);
      window.location.assign(safeNext(path, homeFor("swimmer")));
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível guardar a escolha.");
      setBusy(null);
    }
  }

  async function sendCoachRequest(event: React.FormEvent) {
    event.preventDefault();
    setBusy("coach");
    setError("");
    try {
      const result = await api<CoachRequest>("/api/v1/auth/coach-request", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setRequest({ ...result, teamName: form.teamName });
      setAskCoach(false);
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível enviar o pedido.");
    } finally {
      setBusy(null);
    }
  }

  if (!bootstrapped || role !== "pending") {
    return <p className="px-5 py-16 text-center text-sm text-mute">A preparar…</p>;
  }

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <AuthFrame>
      {askCoach ? (
        <>
          <h1 className="text-3xl font-bold">Pedir conta de treinador</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            As contas de treinador são ativadas manualmente. Deixa os teus dados e respondemos por email.
          </p>
          <form className="mt-5 space-y-4" onSubmit={(event) => void sendCoachRequest(event)}>
            <label className="block text-sm font-medium text-mist">
              Nome
              <input className="field mt-1.5" value={form.name} onChange={set("name")} required maxLength={80} autoFocus />
            </label>
            <label className="block text-sm font-medium text-mist">
              Telemóvel ou outro contacto
              <input className="field mt-1.5" value={form.contact} onChange={set("contact")} required maxLength={80} />
            </label>
            <label className="block text-sm font-medium text-mist">
              Equipa ou clube
              <input className="field mt-1.5" value={form.teamName} onChange={set("teamName")} required maxLength={80} />
            </label>
            <label className="block text-sm font-medium text-mist">
              Mensagem <span className="font-normal text-mute">(opcional)</span>
              <textarea className="field mt-1.5 min-h-24" value={form.message} onChange={set("message")} maxLength={600} />
            </label>
            <button type="submit" disabled={busy !== null} className="btn-primary h-11 w-full">
              {busy === "coach" ? "A enviar…" : "Enviar pedido"}
            </button>
          </form>
          <button type="button" className="mt-4 text-sm font-medium text-mute hover:text-mist" onClick={() => setAskCoach(false)}>
            Voltar
          </button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Escolhe o teu perfil</h1>
          <p className="mt-2 text-sm leading-6 text-mute">Podes entrar como atleta já, ou pedir uma conta de treinador.</p>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void chooseSwimmer()}
              className="rounded-xl border border-line bg-panel px-4 py-4 text-left transition-colors hover:border-aqua disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-display text-xl font-bold text-mist">Atleta</span>
              <span className="mt-1 block text-sm leading-5 text-mute">Consulta treinos, tempos, provas e evolução pessoal.</span>
            </button>
            {request?.requested ? (
              <div className="rounded-xl border border-line bg-aqua-soft px-4 py-4">
                <p className="font-display text-xl font-bold text-mist">Pedido de treinador enviado</p>
                <p className="mt-1 text-sm leading-5 text-mute">
                  {request.teamName ? `${request.teamName} · ` : ""}
                  {request.requestedAt ? `enviado a ${formatDatePt(request.requestedAt.slice(0, 10))}. ` : ""}
                  Vais receber um email quando a conta for ativada.
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setError("");
                  setAskCoach(true);
                }}
                className="rounded-xl border border-line bg-panel px-4 py-4 text-left transition-colors hover:border-aqua disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="font-display text-xl font-bold text-mist">Treinador</span>
                <span className="mt-1 block text-sm leading-5 text-mute">
                  Planeia sessões, acompanha a equipa e analisa resultados. Ativada após pedido.
                </span>
              </button>
            )}
          </div>
          <label className="mt-5 block text-sm font-medium text-mist">
            Código da equipa <span className="font-normal text-mute">(opcional, para atletas)</span>
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
