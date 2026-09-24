"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { PasswordStrength } from "@/components/ui/password-strength";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";

export default function ResetPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ next: string }>("/api/v1/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      window.location.assign(safeNext(result.next, "/entrar"));
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível gravar a nova palavra-passe.");
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">Nova palavra-passe</h1>
      <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm" htmlFor="reset-password">
          Palavra-passe
          <input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1.5"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <PasswordStrength password={password} />
        {error && (
          <p className="text-sm text-coral" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary h-10 w-full">
          {busy ? "A gravar…" : "Guardar"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/entrar" className="text-mute hover:text-mist">
          Voltar
        </Link>
      </p>
    </AuthFrame>
  );
}
