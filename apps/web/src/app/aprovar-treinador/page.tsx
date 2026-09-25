"use client";

import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api, formatApiError, type ApiError } from "@/lib/api";

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
  const [token, setToken] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);
    if (!t) {
      setError("Falta o link completo.");
      return;
    }
    void api<Details>(`/api/v1/coach-approval?t=${encodeURIComponent(t)}`)
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
      <h1 className="text-3xl font-bold">Pedido de treinador</h1>
      {done ? (
        <p className="mt-4 rounded-lg bg-aqua-soft px-3 py-3 text-sm text-mist">
          {done === "approved"
            ? "Aprovado. A equipa foi criada e a pessoa recebeu um email."
            : "Recusado. A pessoa recebeu um email e pode continuar como atleta."}
        </p>
      ) : details ? (
        <>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Nome", details.name],
              ["Email", details.email],
              ["Contacto", details.contact],
              ["Equipa", details.teamName],
              ["Mensagem", details.message || "—"],
              ["Pedido em", details.requestedAt?.slice(0, 16).replace("T", " ")],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                <dt className="text-mute">{label}</dt>
                <dd className="break-words font-medium text-mist">{value}</dd>
              </div>
            ))}
          </dl>
          {details.role !== "pending" ? (
            <p className="mt-4 text-sm text-coral">Esta conta já tem um tipo definido ({details.role}).</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} className="btn-primary" onClick={() => void decide("approve")}>
                Aprovar
              </button>
              <button type="button" disabled={busy} className="btn-ghost text-coral" onClick={() => void decide("reject")}>
                Recusar
              </button>
            </div>
          )}
        </>
      ) : !error ? (
        <p className="mt-4 text-sm text-mute">A carregar…</p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </AuthFrame>
  );
}
