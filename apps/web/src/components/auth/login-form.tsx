"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Turnstile } from "@/components/auth/turnstile";
import { PasswordStrength } from "@/components/ui/password-strength";
import { useT, useTDynamic } from "@/i18n/provider";
import { homeFor } from "@/lib/auth";
import { api, formatApiError, type ApiError } from "@/lib/api";
import { normalizeInvite, writeInviteCookie } from "@/lib/invite";
import { safeNext } from "@/lib/safe-next";
import { useAppState, useAuthBoot } from "@/lib/store";

type AuthStatus = { apiAvailable: boolean; database: boolean; google: boolean; clientId?: string };

export function LoginForm({ turnstileSiteKey = "" }: { turnstileSiteKey?: string }) {
  const t = useT();
  const td = useTDynamic();
  const router = useRouter();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [invite, setInvite] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaRound, setCaptchaRound] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");
    const token = normalizeInvite(params.get("invite"));
    if (token) {
      writeInviteCookie(token);
      setInvite(token);
      setTeamCode(token);
    }
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);
  }, []);

  useEffect(() => {
    void fetch("/api/v1/auth/status", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          setStatus({ apiAvailable: false, database: false, google: false });
          return;
        }
        setStatus({ apiAvailable: true, ...(await res.json()) });
      })
      .catch(() => setStatus({ apiAvailable: false, database: false, google: false }));
  }, []);

  useEffect(() => {
    if (!bootstrapped || !role) return;
    if (invite) router.replace(`/entrar/${invite}`);
    else router.replace(homeFor(role));
  }, [bootstrapped, role, invite, router]);

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ role?: string; next: string; needsConfirmation?: boolean; confirmUrl?: string }>(
        mode === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login",
        {
          method: "POST",
          headers: turnstileSiteKey ? { "x-turnstile-token": captcha } : undefined,
          body: JSON.stringify({ email, password, name, invite: invite || teamCode }),
        },
      );
      if (result.needsConfirmation) {
        const pendingEmail = email.trim();
        sessionStorage.setItem("sa_pending_email", pendingEmail);
        localStorage.setItem(`sa_resend_at_${pendingEmail.toLowerCase()}`, String(Date.now()));
        if (result.confirmUrl) window.location.assign(result.confirmUrl);
        else window.location.assign(`/confirmar-pendente?email=${encodeURIComponent(pendingEmail)}`);
        return;
      }
      window.location.assign(safeNext(result.next, homeFor(result.role || "pending")));
    } catch (err) {
      setError(formatApiError(err as ApiError) || t("Não foi possível entrar."));
      setBusy(false);
      // The token was spent on this attempt.
      setCaptcha("");
      setCaptchaRound((round) => round + 1);
    }
  }

  const banner =
    status && !status.apiAvailable
      ? t("O serviço está temporariamente indisponível. Tenta novamente dentro de instantes.")
      : status && !status.database
        ? t("A base de dados está temporariamente indisponível.")
        : td(error || bootError || "");

  const title = invite ? t("Convite") : mode === "login" ? t("Entrar") : t("Criar conta");

  return (
    <AuthFrame>
      <h1 className="text-3xl font-bold tracking-tight text-mist">{title}</h1>

      <form className="mt-8 space-y-4" onSubmit={(event) => void submitCredentials(event)}>
        {mode === "register" && (
          <>
            <label className="block text-base font-medium text-mist" htmlFor="auth-name">
              {t("Nome")}
              <input
                id="auth-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field mt-2"
                autoComplete="name"
              />
            </label>
            {!invite ? (
              <label className="block text-base font-medium text-mist" htmlFor="auth-team-code">
                {t("Código da equipa")} <span className="text-mute text-sm">{t("(opcional)")}</span>
                <input
                  id="auth-team-code"
                  value={teamCode}
                  onChange={(event) =>
                    setTeamCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                  }
                  className="field mt-2 uppercase tracking-widest"
                  placeholder="ABCD1234"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={8}
                />
              </label>
            ) : null}
          </>
        )}
        <label className="block text-base font-medium text-mist" htmlFor="auth-email">
          {t("Email")}
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field mt-2"
            autoComplete="email"
            required
            aria-invalid={Boolean(banner)}
            aria-describedby={banner ? "auth-error" : undefined}
          />
        </label>
        <label className="block text-base font-medium text-mist" htmlFor="auth-password">
          {t("Palavra-passe")}
          <span className="relative mt-1.5 block">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field pr-20"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={mode === "register" ? 12 : undefined}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-1.5 my-auto h-11 rounded-md px-2.5 text-xs text-mute hover:text-mist"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? t("Ocultar") : t("Mostrar")}
            </button>
          </span>
          {mode === "register" ? <PasswordStrength password={password} /> : null}
        </label>

        {banner && (
          <p id="auth-error" className="text-sm text-coral" role="alert">
            {banner}
          </p>
        )}

        <Turnstile siteKey={turnstileSiteKey} round={captchaRound} onToken={setCaptcha} />

        <button type="submit" disabled={busy || Boolean(turnstileSiteKey && !captcha)} className="btn-primary mt-2 h-11 w-full font-semibold text-base">
          {busy ? t("A entrar…") : mode === "register" ? t("Criar conta") : t("Entrar")}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm font-medium">
        {mode === "login" ? (
          <Link href="/repor" className="inline-flex min-h-11 items-center text-sand hover:text-aqua transition-colors">
            {t("Recuperar")}
          </Link>
        ) : (
          <span />
        )}
        <button type="button" className="inline-flex min-h-11 items-center text-sand hover:text-aqua transition-colors" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? t("Criar conta") : t("Já tenho conta")}
        </button>
      </div>

      <GoogleSignIn invite={invite} disabled={busy} />
    </AuthFrame>
  );
}
