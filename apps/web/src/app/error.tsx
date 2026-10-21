"use client";

import { useEffect } from "react";
import { reportError } from "@/components/error-reporter";
import { BrandLockup } from "@/components/ui/brand";
import { useT } from "@/i18n/provider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => reportError(error, error.digest), [error]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8">
      <header className="safe-top pt-8">
        <BrandLockup />
      </header>
      <div className="my-8 h-1.5 w-full overflow-hidden rounded-full lane-stripe opacity-80" />
      <section className="flex-1">
        <p className="text-sm tracking-[0.22em] text-coral">{t("Erro")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("Algo correu mal")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          {t("Não mostramos detalhes técnicos no ecrã. Tenta outra vez. Se persistir, volta mais tarde.")}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 h-12 w-full rounded-2xl bg-aqua text-sm font-medium text-ink"
        >
          {t("Tentar outra vez")}
        </button>
      </section>
    </div>
  );
}
