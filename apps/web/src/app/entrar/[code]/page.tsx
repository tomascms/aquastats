"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { useT, useTDynamic } from "@/i18n/provider";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { api } from "@/lib/api";
import { homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { writeInviteCookie } from "@/lib/invite";
import { useAppState, useAuthBoot } from "@/lib/store";

export default function JoinTeamPage() {
  const t = useT();
  const td = useTDynamic();
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
      .then(() => setTeamName(t("Convite válido")))
      .catch((err) => setError(td((err as { detail?: string }).detail || "Este convite não é válido.")));
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
        // Only bounce to login once per visit — a second 401 right after logging in means the
        // session genuinely isn't sticking, and re-bouncing would just loop the two pages forever.
        const bounceKey = `sa_invite_bounce_${token}`;
        if (!sessionStorage.getItem(bounceKey)) {
          sessionStorage.setItem(bounceKey, "1");
          window.location.assign(`/?invite=${encodeURIComponent(token)}`);
          return;
        }
        setError(t("A sessão não ficou guardada. Fecha e abre o link do convite outra vez, ou usa o código da equipa em vez do link."));
        setBusy(false);
        return;
      }
      setError(td((err as { detail?: string }).detail || "Não foi possível entrar na equipa."));
      setBusy(false);
    }
  }

  const loggedIn = bootstrapped && Boolean(role);
  const banner = error || td(bootError || "");
  const autoJoined = useRef(false);

  useEffect(() => {
    if (!token || !loggedIn) return;
    void api<{ teamName: string }>(`/api/v1/auth/join/${token}/details`)
      .then((data) => setTeamName(data.teamName))
      .catch(() => undefined);
  }, [token, loggedIn]);

  // Finish joining automatically once logged in — the coach or swimmer already told us they want
  // to join by opening this link, so a login shouldn't need a second, separate tap to complete it.
  useEffect(() => {
    if (!loggedIn || autoJoined.current || busy || error) return;
    autoJoined.current = true;
    void join();
  }, [loggedIn, busy, error]);

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">{teamName || t("Convite")}</h1>

      {loggedIn ? (
        <button
          type="button"
          disabled={busy || Boolean(error && !teamName)}
          onClick={() => void join()}
          className="btn-primary mt-6 h-10 w-full"
        >
          {busy ? t("A entrar…") : t("Entrar na equipa")}
        </button>
      ) : (
        <div className="mt-6 space-y-3">
          <Link href={`/?invite=${encodeURIComponent(token)}`} className="btn-primary h-10 w-full">
            {t("Entrar")}
          </Link>
          <GoogleSignIn invite={token} disabled={busy} />
        </div>
      )}

      {banner && (
        <p className="mt-4 text-sm text-coral" role="alert">
          {banner}
        </p>
      )}
      {loggedIn && error && (
        <Link href={homeFor(role)} className="btn-ghost mt-3 h-10 w-full">
          {t("Continuar")}
        </Link>
      )}
    </AuthFrame>
  );
}
