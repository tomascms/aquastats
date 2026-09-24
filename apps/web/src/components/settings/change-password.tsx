"use client";

import { useState } from "react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { api, formatApiError, type ApiError } from "@/lib/api";

export function ChangePasswordSection({
  hasPassword,
  onPasswordSet,
}: {
  hasPassword: boolean;
  onPasswordSet?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("Mínimo 8 caracteres, com letras e números.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api<{ ok: boolean }>("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
      setSaved(hasPassword ? "Palavra-passe alterada." : "Palavra-passe definida.");
      onPasswordSet?.();
      window.setTimeout(() => setSaved(""), 2500);
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível alterar a palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="seguranca" className="card space-y-3 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">Segurança</p>
        <h2 className="text-lg font-semibold">{hasPassword ? "Alterar palavra-passe" : "Definir palavra-passe"}</h2>
        <p className="mt-1 text-sm text-mute">
          {hasPassword
            ? "Precisas da palavra-passe actual para definir uma nova."
            : "Entraste com Google — podes criar uma palavra-passe para entrar também por email."}
        </p>
      </div>

      {saved ? <p className="text-sm text-mute">{saved}</p> : null}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-11 w-full">
          {hasPassword ? "Alterar palavra-passe" : "Definir palavra-passe"}
        </button>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          {hasPassword ? (
            <label className="block text-sm">
              Palavra-passe actual
              <input
                type="password"
                className="field mt-1.5"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
          ) : null}
          <label className="block text-sm">
            Nova palavra-passe
            <input
              type="password"
              className="field mt-1.5"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <PasswordStrength password={newPassword} />
          <label className="block text-sm">
            Confirmar nova palavra-passe
            <input
              type="password"
              className="field mt-1.5"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="btn-ghost h-11"
            >
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn-primary h-11">
              {busy ? "A guardar…" : "Guardar"}
            </button>
          </div>
          {error ? (
            <p className="text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
