"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { api } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";
import { writeInviteCookie } from "@/lib/invite";
import { useAppState, useAuthBoot } from "@/lib/store";

export default function JoinTeamPage() {
  const { code } = useParams<{ code: string }>();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = (code || "").trim().toUpperCase();

  useEffect(() => {
    if (!token) return;
    writeInviteCookie(token);
    void api<{ valid: boolean }>(`/api/v1/auth/join/${token}`)
      .then(() => setTeamName("Convite válido"))
      .catch((err) => setError((err as { detail?: string }).detail || "Este convite não é válido."));
  }, [token]);

  async function join() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ next: string }>(`/api/v1/auth/join/${token}`, { method: "POST" });
      window.location.assign(safeNext(result.next, "/escolher"));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        window.location.assign(`/?invite=${encodeURIComponent(token)}`);
        return;
      }
      setError((err as { detail?: string }).detail || "Não foi possível entrar na equipa.");
      setBusy(false);
    }
  }

  const loggedIn = bootstrapped && Boolean(role);
  const banner = error || bootError;

  useEffect(() => {
    if (!token || !loggedIn) return;
    void api<{ teamName: string }>(`/api/v1/auth/join/${token}/details`)
      .then((data) => setTeamName(data.teamName))
      .catch(() => undefined);
  }, [token, loggedIn]);

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">{teamName || "Convite"}</h1>

      {loggedIn ? (
        <button
          type="button"
          disabled={busy || Boolean(error && !teamName)}
          onClick={() => void join()}
          className="btn-primary mt-6 h-10 w-full"
        >
          {busy ? "A entrar…" : "Entrar na equipa"}
        </button>
      ) : (
        <div className="mt-6 space-y-3">
          <Link href={`/?invite=${encodeURIComponent(token)}`} className="btn-primary h-10 w-full">
            Entrar
          </Link>
          <GoogleSignIn invite={token} disabled={busy} />
        </div>
      )}

      {banner && (
        <p className="mt-4 text-sm text-coral" role="alert">
          {banner}
        </p>
      )}
    </AuthFrame>
  );
}
