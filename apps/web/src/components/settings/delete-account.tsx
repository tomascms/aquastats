"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { actions } from "@/lib/store";

export function DeleteAccountSection({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    if (hasPassword && password.length < 8) {
      setError("Escreve a tua palavra-passe.");
      return;
    }
    if (confirm.trim().toUpperCase() !== "ELIMINAR") {
      setError("Escreve ELIMINAR para confirmar.");
      return;
    }
    setConfirmOpen(false);
    setBusy(true);
    setError("");
    try {
      await api<{ ok: boolean }>("/api/v1/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ password: hasPassword ? password : undefined, confirm: "ELIMINAR" }),
      });
      await actions.logout();
      router.replace("/");
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível eliminar a conta.");
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 border-coral/30 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-coral">Zona perigosa</p>
        <h2 className="text-lg font-semibold">Eliminar conta</h2>
        <p className="mt-1 text-sm text-mute">Remove o acesso e desactiva a conta. Os dados da equipa mantêm-se.</p>
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-11 w-full text-coral">
          Eliminar conta
        </button>
      ) : (
        <div className="space-y-3">
          {hasPassword ? (
            <label className="block text-sm">
              Palavra-passe
              <input
                type="password"
                className="field mt-1.5"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
          ) : null}
          <label className="block text-sm">
            Escreve <span className="font-semibold">ELIMINAR</span> para confirmar
            <input
              type="text"
              className="field mt-1.5"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost h-11">
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
              className="h-11 rounded-md bg-coral text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "A eliminar…" : "Continuar"}
            </button>
          </div>
          {error ? (
            <p className="text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <Modal open={confirmOpen} title="Eliminar conta?" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-mute">Esta acção não se pode desfazer. Perdes acesso imediato à app.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost h-11" onClick={() => setConfirmOpen(false)}>
            Voltar
          </button>
          <button type="button" disabled={busy} className="h-11 rounded-md bg-coral text-sm font-semibold text-white" onClick={() => void confirmDelete()}>
            {busy ? "A eliminar…" : "Eliminar"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
