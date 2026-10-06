"use client";

import { useState } from "react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { useT } from "@/i18n/provider";
import { api, formatApiError, type ApiError } from "@/lib/api";

export function ChangePasswordSection({
  hasPassword,
  onPasswordSet,
}: {
  hasPassword: boolean;
  onPasswordSet?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 12 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t("Mínimo 12 caracteres, com letras e números."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("As palavras-passe não coincidem."));
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
      setSaved(hasPassword ? t("Palavra-passe alterada.") : t("Palavra-passe definida."));
      onPasswordSet?.();
      window.setTimeout(() => setSaved(""), 2500);
    } catch (err) {
      setError(formatApiError(err as ApiError) || t("Não foi possível alterar a palavra-passe."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="seguranca" className="card space-y-3 p-4">
      <div>
        <p className="text-xs font-semibold text-mute">{t("Segurança")}</p>
        <h2 className="text-lg font-semibold">{hasPassword ? t("Alterar palavra-passe") : t("Definir palavra-passe")}</h2>
        <p className="mt-1 text-sm text-mute">
          {hasPassword
            ? t("Precisas da palavra-passe actual para definir uma nova.")
            : t("Entraste com Google — podes criar uma palavra-passe para entrar também por email.")}
        </p>
      </div>

      {saved ? <p className="text-sm text-mute">{saved}</p> : null}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-11 w-full">
          {hasPassword ? t("Alterar palavra-passe") : t("Definir palavra-passe")}
        </button>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          {hasPassword ? (
            <label className="block text-sm">
              {t("Palavra-passe actual")}
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
            {t("Nova palavra-passe")}
            <input
              type="password"
              className="field mt-1.5"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <PasswordStrength password={newPassword} />
          <label className="block text-sm">
            {t("Confirmar nova palavra-passe")}
            <input
              type="password"
              className="field mt-1.5"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
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
              {t("Cancelar")}
            </button>
            <button type="submit" disabled={busy} className="btn-primary h-11">
              {busy ? t("A guardar…") : t("Guardar")}
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
