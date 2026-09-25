"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt">
      <body className="min-h-dvh bg-[#061018] px-5 py-16 text-[#d7ece8]">
        <p className="text-sm tracking-[0.22em] text-[#ff6b6b]">Erro</p>
        <h1 className="mt-3 font-sans text-3xl font-bold">A app não conseguiu carregar</h1>
        <p className="mt-3 max-w-md text-sm text-[#7f9aa6]">Tenta recarregar. Os teus dados não são mostrados neste ecrã.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 h-12 rounded-2xl bg-[#3dffe8] px-6 text-sm font-bold text-[#061018]"
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
