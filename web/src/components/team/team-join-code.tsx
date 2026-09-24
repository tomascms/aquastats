"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { normalizeInvite, writeInviteCookie } from "@/lib/invite";
import { safeNext } from "@/lib/safe-next";

type Props = {
  compact?: boolean;
  onJoined?: () => void;
};

export function TeamJoinCode({ compact, onJoined }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState("");

  async function preview(nextCode: string) {
    const token = normalizeInvite(nextCode);
    if (!token) return;
    try {
      const info = await api<{ teamName: string }>(`/api/v1/auth/join/${token}`);
      setTeamName(info.teamName);
      setError("");
    } catch {
      setTeamName("");
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    const token = normalizeInvite(code);
    if (!token) {
      setError("Código inválido.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      writeInviteCookie(token);
      const result = await api<{ next: string; teamName?: string }>(`/api/v1/auth/join/${token}`, { method: "POST" });
      if (onJoined) {
        onJoined();
        return;
      }
      window.location.assign(safeNext(result.next, "/swimmer"));
    } catch (err) {
      setError((err as { detail?: string }).detail || "Não foi possível entrar na equipa.");
      setBusy(false);
    }
  }

  return (
    <form className={compact ? "space-y-2" : "card space-y-3 p-4"} onSubmit={(event) => void join(event)}>
      {!compact ? (
        <div>
          <h2 className="text-lg font-semibold">Código da equipa</h2>
          <p className="mt-1 text-sm text-mute">
            Pede ao treinador o código de 8 caracteres (ex.: ABCD1234). Também podes usar o link de convite.
          </p>
        </div>
      ) : null}
      <label className="block text-sm" htmlFor="team-join-code">
        Código
        <input
          id="team-join-code"
          className="field mt-1.5 uppercase tracking-widest"
          value={code}
          onChange={(event) => {
            const next = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
            setCode(next);
            void preview(next);
          }}
          placeholder="ABCD1234"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
        />
      </label>
      {teamName ? <p className="text-sm text-aqua">Equipa: {teamName}</p> : null}
      <button type="submit" disabled={busy || code.length < 4} className="btn-primary h-10 w-full">
        {busy ? "A entrar…" : "Entrar na equipa"}
      </button>
      {error ? (
        <p className="text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
