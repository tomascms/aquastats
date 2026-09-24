"use client";

import { BrandLockup } from "@/components/ui/brand";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8">
      <header className="safe-top pt-8">
        <BrandLockup />
      </header>
      <div className="my-8 h-1.5 w-full overflow-hidden rounded-full lane-stripe opacity-80" />
      <section className="flex-1">
        <p className="text-sm uppercase tracking-[0.22em] text-coral">Erro</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Algo correu mal</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Não mostramos detalhes técnicos no ecrã. Tenta outra vez. Se persistir, volta mais tarde.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 h-12 w-full rounded-2xl bg-aqua text-sm font-medium text-ink"
        >
          Tentar outra vez
        </button>
      </section>
    </div>
  );
}
