"use client";

import { useEffect, useMemo, useState } from "react";
import { ChangePasswordSection } from "@/components/settings/change-password";
import { DeleteAccountSection } from "@/components/settings/delete-account";
import { api } from "@/lib/api";
import { actions, useAppState } from "@/lib/store";
import { useT } from "@/i18n/provider";

type Me = { email?: string | null; name?: string | null; hasPassword?: boolean };

export default function DefinicoesPage() {
  const t = useT();
  const { teamName, joinCode } = useAppState();
  const [name, setName] = useState(teamName);
  const [coachName, setCoachName] = useState("");
  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const inviteUrl = useMemo(() => {
    if (!joinCode || typeof window === "undefined") return "";
    return `${window.location.origin}/entrar/${joinCode}`;
  }, [joinCode]);

  useEffect(() => {
    setName(teamName);
  }, [teamName]);

  useEffect(() => {
    void api<Me>("/api/v1/auth/me")
      .then((me) => {
        setCoachName(me.name || "");
        setEmail(me.email || "");
        setHasPassword(Boolean(me.hasPassword));
      })
      .catch(() => undefined);
  }, []);

  async function saveTeam(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await actions.updateTeam({ name: name.trim() });
      if (coachName.trim()) await actions.updateProfile(coachName.trim());
      setSaved(t("Guardado"));
      window.setTimeout(() => setSaved(""), 1800);
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setSaved(t("Link copiado"));
    window.setTimeout(() => setSaved(""), 1800);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1>{t("Definições")}</h1>
        <p className="mt-1 text-sm text-mute">{t("Nome da equipa, convite e dados da conta.")}</p>
      </div>

      <form onSubmit={(event) => void saveTeam(event)} className="card space-y-3 p-4">
        <label className="block text-xs font-semibold text-mute">
          {t("Nome da equipa")}
          <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block text-xs font-semibold text-mute">
          {t("O teu nome")}
          <input className="field mt-1" value={coachName} onChange={(event) => setCoachName(event.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-mute">
          {t("Email")}
          <input className="field mt-1 bg-ink-2" value={email} readOnly />
        </label>
        <p className="text-sm text-mute">
          <a href="#seguranca" className="text-mist underline-offset-2 hover:underline">
            {hasPassword ? t("Alterar palavra-passe") : t("Definir palavra-passe")}
          </a>
        </p>
        <button type="submit" disabled={busy} className="btn-primary h-11 w-full">
          {t("Guardar")}
        </button>
        {saved ? <p className="text-sm text-mute">{saved}</p> : null}
      </form>

      <section className="card space-y-3 p-4">
        <p className="text-xs font-semibold text-mute">{t("Convite")}</p>
        <p className="break-all font-mono text-sm">{inviteUrl || t("A carregar…")}</p>
        <p className="text-xs text-mute">{t("Código: {code}", { code: joinCode || "—" })}</p>
        <p className="text-xs text-mute">{t("O código é gerado automaticamente e não pode ser alterado.")}</p>
        <button type="button" onClick={() => void copyInvite()} className="btn-ghost h-11 w-full">
          {t("Copiar link")}
        </button>
      </section>

      <ChangePasswordSection hasPassword={hasPassword} onPasswordSet={() => setHasPassword(true)} />
      <DeleteAccountSection hasPassword={hasPassword} />
    </div>
  );
}
