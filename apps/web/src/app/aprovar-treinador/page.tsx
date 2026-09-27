"use client";

import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { useT } from "@/i18n/provider";

type Details = {
  name: string;
  email: string;
  contact: string;
  teamName: string;
  message: string;
  requestedAt: string;
  role: string;
};

export default function ApproveCoachPage() {
  const t = useT();
  const [token, setToken] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const link = new URLSearchParams(window.location.search).get("t") || "";
    setToken(link);
    if (!link) {
      setError(t("Falta o link completo."));
      return;
    }
    void api<Details>(`/api/v1/coach-approval?t=${encodeURIComponent(link)}`)
      .then(setDetails)
      .catch((err) => setError(formatApiError(err as ApiError)));
  }, []);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ status: "approved" | "rejected" }>("/api/v1/coach-approval", {
        method: "POST",
        body: JSON.stringify({ t: token, action }),
      });
      setDone(result.status);
    } catch (err) {
      setError(formatApiError(err as ApiError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold">{t("Pedido de treinador")}</h1>
      {done ? (
        <p className="mt-4 rounded-lg bg-aqua-soft px-3 py-3 text-sm text-mist">
          {done === "approved"
            ? t("Aprovado. A equipa foi criada e a pessoa recebeu um email.")
            : t("Recusado. A pessoa recebeu um email e pode continuar como atleta.")}
        </p>
      ) : details ? (
        <>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              [t("Nome"), details.name],
              [t("Email"), details.email],
              [t("Contacto"), details.contact],
              [t("Equipa"), details.teamName],
              [t("Mensagem"), details.message || "—"],
              [t("Pedido em"), details.requestedAt?.slice(0, 16).replace("T", " ")],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                <dt className="text-mute">{label}</dt>
                <dd className="break-words font-medium text-mist">{value}</dd>
              </div>
            ))}
          </dl>
          {details.role !== "pending" ? (
            <p className="mt-4 text-sm text-coral">{t("Esta conta já tem um tipo definido ({role}).", { role: details.role })}</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} className="btn-primary" onClick={() => void decide("approve")}>
                {t("Aprovar")}
              </button>
              <button type="button" disabled={busy} className="btn-ghost text-coral" onClick={() => void decide("reject")}>
                {t("Recusar")}
              </button>
            </div>
          )}
        </>
      ) : !error ? (
        <p className="mt-4 text-sm text-mute">{t("A carregar…")}</p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </AuthFrame>
  );
}
