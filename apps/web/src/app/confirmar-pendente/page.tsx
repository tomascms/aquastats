"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT, useTDynamic } from "@/i18n/provider";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api } from "@/lib/api";

const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

function resendStorageKey(email: string) {
  return `sa_resend_at_${email.trim().toLowerCase()}`;
}

function secondsUntilResend(email: string): number {
  const raw = localStorage.getItem(resendStorageKey(email));
  if (!raw) return 0;
  const elapsed = Date.now() - Number(raw);
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ConfirmPendingPage() {
  const t = useT();
  const td = useTDynamic();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("email")?.trim() || "";
    const fromStorage = sessionStorage.getItem("sa_pending_email") || "";
    setEmail(fromQuery || fromStorage);
  }, []);

  useEffect(() => {
    if (!email.trim()) return;
    const tick = () => setCooldownSeconds(secondsUntilResend(email));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [email]);

  async function resend() {
    if (!email.trim()) {
      setMessage(t("Email em falta. Volta ao registo ou usa o link que recebeste."));
      return;
    }
    if (secondsUntilResend(email) > 0) {
      setMessage(t("Aguarda {time} antes de reenviar.", { time: formatCountdown(secondsUntilResend(email)) }));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api<{ ok: boolean }>("/api/v1/auth/resend-confirmation", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      localStorage.setItem(resendStorageKey(email), String(Date.now()));
      setCooldownSeconds(Math.ceil(RESEND_COOLDOWN_MS / 1000));
      setMessage(t("Se existir conta por confirmar, enviámos um novo email. Pode demorar alguns minutos."));
    } catch (error) {
      const apiError = error as { status?: number; detail?: string };
      if (apiError.status === 429) {
        localStorage.setItem(resendStorageKey(email), String(Date.now()));
        setCooldownSeconds(secondsUntilResend(email) || Math.ceil(RESEND_COOLDOWN_MS / 1000));
        setMessage(td(apiError.detail || "Aguarda 5 minutos antes de reenviar."));
      } else {
        setMessage(t("Não foi possível reenviar. Tenta mais tarde."));
      }
    } finally {
      setBusy(false);
    }
  }

  const resendBlocked = cooldownSeconds > 0;

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Confirma o email")}</h1>
      <p className="mt-4 text-sm text-mute">
        {email ? t("Enviámos um link de confirmação para {email}. Só depois de clicares nele consegues entrar.", { email }) : t("Enviámos um link de confirmação. Só depois de clicares nele consegues entrar.")}
      </p>
      <p className="mt-3 rounded-md border border-line bg-ink-2 px-3 py-2 text-sm text-mute">
        {t("O email pode demorar alguns minutos a chegar — verifica também a pasta de spam antes de reenviar.")}
      </p>
      <div className="mt-6 space-y-3">
        <button
          type="button"
          disabled={busy || resendBlocked}
          onClick={() => void resend()}
          className="btn-primary h-10 w-full disabled:opacity-60"
        >
          {busy ? t("A enviar…") : resendBlocked ? t("Reenviar em {time}", { time: formatCountdown(cooldownSeconds) }) : t("Reenviar email")}
        </button>
        <Link
          href="/"
          className="flex h-10 w-full items-center justify-center rounded-md border border-line text-sm font-medium hover:bg-ink-2"
        >
          {t("Já confirmei")}
        </Link>
      </div>
      {message ? (
        <p className="mt-4 text-sm text-mute" role="status">
          {message}
        </p>
      ) : null}
    </AuthFrame>
  );
}
