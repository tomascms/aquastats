"use client";

import { useEffect, useState } from "react";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { useT } from "@/i18n/provider";

type Consent = "not_required" | "missing" | "pending" | "granted" | "withdrawn";

/** Right of access (JSON export) and, for athletes under 13, the guardian's consent. */
export function MyDataSection() {
  const t = useT();
  const [consent, setConsent] = useState<Consent>("not_required");
  const [guardian, setGuardian] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ consent?: Consent }>("/api/v1/auth/me")
      .then((me) => setConsent(me.consent || "not_required"))
      .catch(() => undefined);
  }, []);

  async function exportData() {
    setError("");
    try {
      const res = await fetch("/api/v1/auth/export", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "aquastats-dados.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("Não foi possível exportar os dados."));
    }
  }

  async function askGuardian(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/v1/auth/guardian-consent", { method: "POST", body: JSON.stringify({ guardianEmail: guardian }) });
      setConsent("pending");
      setMessage(t("Pedido enviado. O responsável recebe um email com o link."));
    } catch (err) {
      setError(formatApiError(err as ApiError) || t("Não foi possível enviar o pedido."));
    } finally {
      setBusy(false);
    }
  }

  const blocked = consent === "missing" || consent === "pending" || consent === "withdrawn";
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("Os teus dados")}</h2>
        <p className="mt-1 text-sm text-mute">{t("Descarrega uma cópia de tudo o que a Aquastats guarda sobre ti, em JSON.")}</p>
      </div>
      <button type="button" onClick={() => void exportData()} className="btn-ghost h-11 w-full">
        {t("Exportar os meus dados")}
      </button>
      {blocked ? (
        <form className="space-y-3 rounded-lg border border-line bg-aqua-soft p-3" onSubmit={(event) => void askGuardian(event)}>
          <p className="text-sm leading-5 text-mist" role="status">
            {consent === "pending"
              ? t("À espera da autorização do responsável parental. Até lá, não guardamos sono, RPE, recuperação nem frequência cardíaca.")
              : consent === "withdrawn"
                ? t("O responsável parental retirou a autorização. Não guardamos sono, RPE, recuperação nem frequência cardíaca.")
                : t("Tens menos de 13 anos: para guardar sono, RPE, recuperação e frequência cardíaca, um responsável parental tem de autorizar.")}
          </p>
          <label className="block text-sm">
            {t("Email de um responsável parental")}
            <input type="email" className="field mt-1.5" value={guardian} onChange={(event) => setGuardian(event.target.value)} required />
          </label>
          <button type="submit" disabled={busy} className="btn-primary h-11 w-full">
            {busy ? t("A enviar…") : consent === "missing" ? t("Pedir autorização") : t("Pedir de novo")}
          </button>
        </form>
      ) : null}
      {message ? <p className="text-sm text-mute">{message}</p> : null}
      {error ? (
        <p className="text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
