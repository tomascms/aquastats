"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { useT, useTDynamic } from "@/i18n/provider";
import { api, formatApiError, type ApiError } from "@/lib/api";

type Consent = { name: string; status: "pending" | "granted" | "withdrawn" };

/** Opened from the email sent to a parent or guardian of an athlete under 13: authorise, refuse or withdraw. */
export default function GuardianConsentPage() {
  const t = useT();
  const td = useTDynamic();
  const { token } = useParams<{ token: string }>();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Consent>(`/api/v1/auth/guardian/${encodeURIComponent(token)}`)
      .then(setConsent)
      .catch((err) => setError(formatApiError(err as ApiError) || t("Este link já não é válido. Pede um novo ao atleta.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function decide(decision: "grant" | "withdraw") {
    setBusy(true);
    setError("");
    try {
      setConsent(
        await api<Consent>(`/api/v1/auth/guardian/${encodeURIComponent(token)}`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        }),
      );
    } catch (err) {
      setError(formatApiError(err as ApiError) || t("Não foi possível guardar a decisão."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold tracking-tight text-mist">{t("Autorização parental")}</h1>
      {consent ? (
        <div className="mt-5 space-y-4 text-sm leading-6 text-mute">
          <p>
            {t("{name} usa a Aquastats, uma app de treino de natação, e indicou-te como responsável parental.", { name: consent.name })}
          </p>
          <p>
            {t("Como tem menos de 13 anos, só guardamos dados de saúde e bem-estar (sono, esforço percebido, recuperação e frequência cardíaca) com a tua autorização. Os treinos, tempos e provas registados pelo treinador não dependem disto.")}
          </p>
          <p>
            {t("Podes retirar a autorização a qualquer momento. Ao retirar, apagamos os dados de saúde e bem-estar já guardados.")}{" "}
            <Link href="/privacidade" className="text-sand underline-offset-2 hover:underline">
              {t("Política de privacidade")}
            </Link>
          </p>
          <p className="rounded-lg border border-line bg-aqua-soft px-3 py-3 font-medium text-mist" role="status">
            {consent.status === "granted"
              ? t("Autorização dada.")
              : consent.status === "withdrawn"
                ? t("Sem autorização: não guardamos dados de saúde nem de bem-estar.")
                : t("À espera da tua decisão.")}
          </p>
          {consent.status === "pending" ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void decide("withdraw")} className="btn-ghost h-11">
                {t("Recusar")}
              </button>
              <button type="button" disabled={busy} onClick={() => void decide("grant")} className="btn-primary h-11">
                {t("Autorizar")}
              </button>
            </div>
          ) : consent.status === "granted" ? (
            <button type="button" disabled={busy} onClick={() => void decide("withdraw")} className="btn-ghost h-11 w-full text-coral">
              {t("Retirar autorização")}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {td(error)}
        </p>
      ) : null}
    </AuthFrame>
  );
}
