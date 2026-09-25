"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { homeFor } from "@/lib/auth";
import { normalizeInvite, writeInviteCookie } from "@/lib/invite";
import { safeNext } from "@/lib/safe-next";
import { actions, useAppState, useAuthBoot } from "@/lib/store";

type BillingConfig = { enabled: boolean; amountCents?: number; currency?: string; interval?: string };

function formatPrice(config: BillingConfig): string {
  if (!config.amountCents) return "";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: (config.currency || "eur").toUpperCase() }).format(
    config.amountCents / 100,
  );
}

export default function ChooseRolePage() {
  const router = useRouter();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();
  const [busy, setBusy] = useState<"coach" | "swimmer" | null>(null);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState("");
  const [askTeam, setAskTeam] = useState(false);
  const [billing, setBilling] = useState<BillingConfig>({ enabled: false });
  const [teamCode, setTeamCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [immediateStart, setImmediateStart] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    setCancelled(new URLSearchParams(window.location.search).get("pagamento") === "cancelado");
    void fetch("/api/v1/billing/config")
      .then((res) => res.json())
      .then((config: BillingConfig) => setBilling(config))
      .catch(() => setBilling({ enabled: false }));
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!role) router.replace("/entrar");
    if (role === "coach" || role === "swimmer") router.replace(homeFor(role));
  }, [bootstrapped, role, router]);

  async function chooseSwimmer() {
    setBusy("swimmer");
    setError("");
    try {
      const invite = normalizeInvite(teamCode);
      if (invite) writeInviteCookie(invite);
      const path = await actions.chooseRole("swimmer", "", invite);
      window.location.assign(safeNext(path, homeFor("swimmer")));
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível guardar a escolha.");
      setBusy(null);
    }
  }

  async function startCoachCheckout() {
    if (!teamName.trim()) {
      setError("Escreve o nome da equipa.");
      return;
    }
    if (!acceptTerms || !immediateStart) {
      setError("Para continuar, marca as duas confirmações.");
      return;
    }
    setBusy("coach");
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ teamName: teamName.trim(), acceptTerms, immediateStart }),
      });
      window.location.assign(url);
    } catch (err) {
      setError(formatApiError(err as ApiError) || "Não foi possível abrir o pagamento.");
      setBusy(null);
    }
  }

  if (!bootstrapped || role !== "pending") {
    return <p className="px-5 py-16 text-center text-sm text-mute">A preparar…</p>;
  }

  const price = formatPrice(billing);

  return (
    <AuthFrame>
      {askTeam ? (
        <>
          <h1 className="text-3xl font-bold">Conta de treinador</h1>
          <p className="mt-2 text-sm leading-6 text-mute">Cria o espaço da tua equipa: atletas, treinos, competições e análise.</p>

          <div className="mt-5 flex items-baseline justify-between rounded-xl bg-aqua px-4 py-3 text-white">
            <span className="text-sm text-white/75">Subscrição mensal</span>
            <span className="font-display text-3xl font-bold tabular">
              {price}
              <span className="ml-1 font-sans text-sm font-medium text-white/70">/mês</span>
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-mute">
            <li>Preço final, com IVA incluído quando aplicável.</li>
            <li>Renova todos os meses. Cancelas quando quiseres e mantens o acesso até ao fim do mês pago.</li>
            <li>Pagamento seguro no Stripe. O Aquastats nunca vê os dados do teu cartão.</li>
          </ul>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void startCoachCheckout();
            }}
          >
            <label className="block text-sm font-medium text-mist">
              Nome da equipa
              <input
                className="field mt-1.5"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                autoFocus
                required
                maxLength={80}
              />
            </label>
            <label className="flex gap-3 text-sm leading-5 text-mist">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0b2545]"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" className="font-semibold text-pool underline">
                  Termos
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" className="font-semibold text-pool underline">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-5 text-mist">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0b2545]"
                checked={immediateStart}
                onChange={(event) => setImmediateStart(event.target.checked)}
              />
              <span>
                Peço que o serviço comece já. Sei que posso desistir nos primeiros 14 dias e que, nesse caso, pago apenas a parte
                proporcional ao tempo usado.
              </span>
            </label>
            <button type="submit" disabled={busy !== null} className="btn-primary h-11 w-full">
              {busy === "coach" ? "A abrir pagamento…" : `Subscrever por ${price}/mês`}
            </button>
          </form>
          <button type="button" className="mt-4 text-sm font-medium text-mute hover:text-mist" onClick={() => setAskTeam(false)}>
            Voltar
          </button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Escolhe o teu perfil</h1>
          <p className="mt-2 text-sm leading-6 text-mute">Podes entrar como treinador ou como atleta.</p>
          {cancelled ? (
            <p className="mt-4 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5300]">
              O pagamento foi cancelado e nada foi cobrado. Podes tentar de novo quando quiseres.
            </p>
          ) : null}
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              disabled={busy !== null || !billing.enabled}
              onClick={() => {
                setError("");
                setAskTeam(true);
              }}
              className="rounded-xl border border-line bg-panel px-4 py-4 text-left transition-colors hover:border-aqua disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl font-bold text-mist">Treinador</span>
                {price ? <span className="text-sm font-semibold text-pool tabular">{price}/mês</span> : null}
              </span>
              <span className="mt-1 block text-sm leading-5 text-mute">Planeia sessões, acompanha a equipa e analisa resultados.</span>
            </button>
            {!billing.enabled && <p className="-mt-1 text-xs text-mute">O registo de treinador abre em breve.</p>}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void chooseSwimmer()}
              className="rounded-xl border border-line bg-panel px-4 py-4 text-left transition-colors hover:border-aqua disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl font-bold text-mist">Atleta</span>
                <span className="text-sm font-semibold text-good">Gratuito</span>
              </span>
              <span className="mt-1 block text-sm leading-5 text-mute">Consulta treinos, tempos, provas e evolução pessoal.</span>
            </button>
          </div>
          <label className="mt-5 block text-sm font-medium text-mist">
            Código da equipa <span className="font-normal text-mute">(opcional, para atletas)</span>
            <input
              className="field mt-1.5 uppercase tracking-widest"
              value={teamCode}
              onChange={(event) =>
                setTeamCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
              }
              placeholder="ABCD1234"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
            />
          </label>
        </>
      )}
      {(error || bootError) && (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error || bootError}
        </p>
      )}
    </AuthFrame>
  );
}
