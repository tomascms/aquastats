"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";
import { useT } from "@/i18n/provider";

export default function ForgotPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [devUrl, setDevUrl] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ ok: boolean; resetUrl?: string }>("/api/v1/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDone(true);
      if (result.resetUrl) setDevUrl(safeNext(result.resetUrl));
    } catch {
      setDone(true);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Palavra-passe")}</h1>

      {done ? (
        <div className="mt-6 space-y-4 text-sm">
          <p role="status">
            {t("Se existir conta com esse email, enviámos um link para repor a palavra-passe. Verifica a caixa de entrada (e spam) — o email vem de")}{" "}
            <span className="text-mist">confirmation@aquastats.net</span>.
          </p>
          {devUrl && (
            <p>
              <Link href={devUrl} className="underline">
                {t("Abrir link de desenvolvimento")}
              </Link>
            </p>
          )}
          <Link href="/entrar" className="btn-primary h-10 w-full">
            {t("Entrar")}
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm" htmlFor="forgot-email">
            {t("Email")}
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field mt-1.5"
              autoComplete="email"
              required
            />
          </label>
          <button type="submit" disabled={busy} className="btn-primary h-10 w-full">
            {busy ? t("A enviar…") : t("Enviar link")}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm">
        <Link href="/entrar" className="text-mute hover:text-mist">
          {t("Voltar")}
        </Link>
      </p>
    </AuthFrame>
  );
}
