import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
];

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-[radial-gradient(circle_at_top_right,rgba(115,151,205,0.16),transparent_34%),linear-gradient(135deg,#f5f8fd_0%,#eaf1fa_100%)] lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="relative hidden overflow-hidden bg-aqua lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(122,168,221,0.3),transparent_34%)]" aria-hidden="true" />
        <Image
          src="/aquastats-logo.png"
          alt="Aquastats"
          width={900}
          height={880}
          className="relative h-[min(58vh,540px)] w-auto brightness-0 invert"
          priority
        />
        <div className="relative -mt-3 text-center">
          <p className="text-base font-medium tracking-wide text-white/85">know your swim</p>
          <p className="mt-3 max-w-[250px] text-sm leading-6 text-white/55">Dados de treino e competição para decisões mais claras.</p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col bg-white">
        <header className="safe-top flex flex-col items-center px-6 pt-7 lg:hidden">
          <Image
            src="/aquastats-logo.png"
            alt="Aquastats"
            width={280}
            height={274}
            className="h-36 w-auto"
            priority
          />
          <p className="-mt-1 text-base font-medium tracking-wide text-sand">know your swim</p>
        </header>
        <main id="conteudo" className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[390px] rounded-2xl border border-line bg-white p-7 shadow-[0_20px_55px_rgba(16,33,61,0.08)] sm:p-9">{children}</div>
        </main>
        <footer className="safe-bottom px-6 pb-6">
          <nav aria-label="Informação legal" className="flex justify-center gap-5 text-xs text-sand">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-mist font-medium">
                {item.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}
