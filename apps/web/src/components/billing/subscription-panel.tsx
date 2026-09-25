"use client";

import { useEffect, useState } from "react";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { formatDatePt } from "@/lib/labels";

type Subscription = {
  exempt: boolean;
  active: boolean;
  status: string | null;
  amountCents: number | null;
  currency: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  manageable: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Em período experimental",
  past_due: "Pagamento em atraso",
  canceled: "Cancelada",
  unpaid: "Por pagar",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  paused: "Em pausa",
};

export function SubscriptionPanel({ lapsed = false }: { lapsed?: boolean }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Subscription>("/api/v1/billing/subscription")
      .then(setSub)
      .catch((err) => setError(formatApiError(err as ApiError)));
  }, []);

  async function openPortal() {
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/v1/billing/portal", { method: "POST" });
      window.location.assign(url);
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível abrir a gestão da subscrição.");
      setBusy(false);
    }
  }

  const price =
    sub?.amountCents != null
      ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: (sub.currency || "eur").toUpperCase() }).format(sub.amountCents / 100)
      : "";

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-bold">{lapsed ? "A subscrição não está ativa" : "Subscrição"}</h2>
      {lapsed ? (
        <p className="mt-1 text-sm text-mute">
          Os dados da equipa estão guardados. Reativa a subscrição para voltar a ter acesso.
        </p>
      ) : null}
      {!sub && !error ? <p className="mt-3 text-sm text-mute">A carregar…</p> : null}
      {sub?.exempt ? (
        <p className="mt-3 text-sm text-mist">Esta equipa foi criada antes das subscrições e não paga mensalidade.</p>
      ) : null}
      {sub && !sub.exempt ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-mute">Estado</dt>
            <dd className={`font-semibold ${sub.active ? "text-good" : "text-coral"}`}>
              {sub.status ? STATUS_LABEL[sub.status] ?? sub.status : "Sem subscrição"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Mensalidade</dt>
            <dd className="font-display text-xl font-bold tabular">{price || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{sub.cancelAtPeriodEnd ? "Termina a" : "Próxima renovação"}</dt>
            <dd className="font-semibold tabular">{sub.currentPeriodEnd ? formatDatePt(sub.currentPeriodEnd.slice(0, 10)) : "—"}</dd>
          </div>
        </dl>
      ) : null}
      {sub?.manageable ? (
        <button type="button" disabled={busy} onClick={() => void openPortal()} className="btn-primary mt-4">
          {busy ? "A abrir…" : lapsed ? "Reativar ou atualizar pagamento" : "Gerir subscrição, cartão e faturas"}
        </button>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
