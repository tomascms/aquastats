"use client";

import Link from "next/link";
import { useT } from "@/i18n/provider";

// Lei 58/2019, art. 16.º: below this age a parent or guardian authorises health data (sleep, RPE, HR).
const CONSENT_AGE = 13;

export type Consent = { birthDate: string; guardianEmail: string; acceptTerms: boolean };
export const EMPTY_CONSENT: Consent = { birthDate: "", guardianEmail: "", acceptTerms: false };

export function isUnder13(birthDate: string, today = new Date()): boolean {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (!birthDate || Number.isNaN(birth.getTime())) return false;
  const limit = new Date(today.getFullYear() - CONSENT_AGE, today.getMonth(), today.getDate());
  return birth > limit;
}

/** What the API expects with a signup, a role choice or a join. */
export function consentBody(value: Consent, askBirth = true) {
  return {
    acceptTerms: value.acceptTerms,
    ...(askBirth && value.birthDate ? { birthDate: value.birthDate } : {}),
    ...(askBirth && isUnder13(value.birthDate) ? { guardianEmail: value.guardianEmail.trim() } : {}),
  };
}

export function ConsentFields({
  value,
  onChange,
  askBirth = true,
  askTerms = true,
}: {
  value: Consent;
  onChange: (next: Consent) => void;
  askBirth?: boolean;
  askTerms?: boolean;
}) {
  const t = useT();
  const set = (patch: Partial<Consent>) => onChange({ ...value, ...patch });
  const minor = askBirth && isUnder13(value.birthDate);
  return (
    <div className="space-y-4">
      {askBirth ? (
        <label className="block text-base font-medium text-mist" htmlFor="consent-birth">
          {t("Data de nascimento")}
          <input
            id="consent-birth"
            type="date"
            value={value.birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => set({ birthDate: event.target.value })}
            className="field mt-2"
            autoComplete="bday"
            required
          />
        </label>
      ) : null}
      {minor ? (
        <label className="block text-base font-medium text-mist" htmlFor="consent-guardian">
          {t("Email de um responsável parental")}
          <input
            id="consent-guardian"
            type="email"
            value={value.guardianEmail}
            onChange={(event) => set({ guardianEmail: event.target.value })}
            className="field mt-2"
            autoComplete="off"
            required
            aria-describedby="consent-guardian-hint"
          />
          <span id="consent-guardian-hint" className="mt-1.5 block text-sm font-normal leading-5 text-mute">
            {t("Tens menos de 13 anos: enviamos um pedido de autorização a esse email. Até lá, a conta funciona, mas não guarda sono, RPE, recuperação nem frequência cardíaca.")}
          </span>
        </label>
      ) : null}
      {askTerms ? (
        <label className="flex items-start gap-3 text-sm leading-5 text-mute" htmlFor="consent-terms">
          <input
            id="consent-terms"
            type="checkbox"
            checked={value.acceptTerms}
            onChange={(event) => set({ acceptTerms: event.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0"
            required
          />
          <span>
            {t("Li e aceito os")}{" "}
            <Link href="/termos" target="_blank" className="text-sand underline-offset-2 hover:underline">
              {t("termos e condições")}
            </Link>{" "}
            {t("e a")}{" "}
            <Link href="/privacidade" target="_blank" className="text-sand underline-offset-2 hover:underline">
              {t("política de privacidade")}
            </Link>
            .
          </span>
        </label>
      ) : null}
    </div>
  );
}
