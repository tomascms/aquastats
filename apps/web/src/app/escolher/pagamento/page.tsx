"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api, formatApiError, type ApiError } from "@/lib/api";

type Confirm = { role: string; status: "active" | "pending"; next?: string };

export default function PaymentReturnPage() {
  const [state, setState] = useState<"working" | "waiting" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";
    let cancelled = false;

    async function confirm(attempt: number) {
      try {
        const result = await api<Confirm>("/api/v1/billing/confirm", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        if (cancelled) return;
        if (result.status === "active") {
          window.location.assign(result.next || "/coach");
          return;
        }
        if (attempt < 10) {
          setState("waiting");
          window.setTimeout(() => void confirm(attempt + 1), 2000);
        } else {
          setState("error");
          setMessage("O pagamento ainda está a ser processado. Recebes um email do Stripe quando ficar concluído.");
        }
      } catch (err) {
        if (cancelled) return;
        setState("error");
        setMessage(formatApiError(err as ApiError) || "Não foi possível confirmar o pagamento.");
      }
    }

    if (!sessionId) {
      setState("error");
      setMessage("Falta a referência do pagamento.");
    } else {
      void confirm(0);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold">{state === "error" ? "Pagamento por confirmar" : "A ativar a tua conta"}</h1>
      {state === "error" ? (
        <>
          <p className="mt-3 text-sm leading-6 text-mute">{message}</p>
          <p className="mt-2 text-sm leading-6 text-mute">
            Se o valor foi cobrado e a conta não ativar em alguns minutos, escreve para o contacto indicado nos Termos com a data do
            pagamento.
          </p>
          <Link href="/escolher" className="btn-ghost mt-5 w-full">
            Voltar
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-mute">
          {state === "waiting" ? "O Stripe está a concluir o pagamento…" : "Pagamento recebido. A criar a tua equipa…"}
        </p>
      )}
    </AuthFrame>
  );
}
