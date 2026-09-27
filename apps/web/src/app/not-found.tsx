import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand";
import { SiteFooter } from "@/components/ui/site-footer";
import { getServerT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getServerT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8">
      <header className="safe-top pt-8">
        <Link href="/" aria-label={t("Ir para a página inicial")}>
          <BrandLockup />
        </Link>
      </header>
      <div className="my-8 h-1.5 w-full overflow-hidden rounded-full lane-stripe opacity-80" />
      <section className="flex-1">
        <p className="text-sm tracking-[0.22em] text-aqua-2">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("Esta página não existe")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          {t("O endereço está errado ou o conteúdo foi movido. Volta ao início e entra na tua área.")}
        </p>
        <Link
          href="/"
          className="mt-8 flex h-12 items-center justify-center rounded-2xl bg-aqua text-sm font-medium text-ink"
        >
          {t("Ir para o início")}
        </Link>
      </section>
      <SiteFooter />
    </div>
  );
}
