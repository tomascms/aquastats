import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastHost } from "@/components/ui/toast-host";
import { ConfirmHost } from "@/components/ui/confirm-host";
import { ErrorReporter } from "@/components/error-reporter";
import { INTL_LOCALE, translate } from "@/i18n";
import { LocaleProvider } from "@/i18n/provider";
import { getServerLocale } from "@/i18n/server";
import { EARLY_SNAPSHOT_SCRIPT } from "@/lib/early-snapshot";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// Not preloaded: 4 font files at high priority competed with the app's JavaScript on phone networks; they
// still load when used (font-display: swap paints with the fallback first).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  preload: false,
});

// Render HTML per request: prerendered pages ship `s-maxage=31536000`, which lets browsers keep
// serving an old app shell after a deploy. Hashed JS/CSS under /_next/static stay immutable.
export const dynamic = "force-dynamic";

const site = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const description = translate(locale, "Tempos, treinos e resultados para natação competitiva.");
  return {
    metadataBase: new URL(site),
    title: {
      default: "Aquastats",
      template: "%s · Aquastats",
    },
    description,
    applicationName: "Aquastats",
    robots: { index: false, follow: false, nocache: true },
    category: "sports",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Aquastats",
    },
    alternates: { canonical: site },
    openGraph: {
      type: "website",
      locale: INTL_LOCALE[locale].replace("-", "_"),
      siteName: "Aquastats",
      title: "Aquastats",
      description,
      url: site,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b2545",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getServerLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Aquastats",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    inLanguage: INTL_LOCALE[locale],
    description: translate(locale, "Tempos, treinos e resultados para natação competitiva."),
  };

  return (
    <html lang={locale} className={`${geist.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: EARLY_SNAPSHOT_SCRIPT }} />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-aqua focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          {translate(locale, "Saltar para o conteúdo")}
        </a>
        <LocaleProvider initialLocale={locale}>
          <div id="conteudo" className="min-h-dvh w-full">
            {children}
            <ToastHost />
            <ConfirmHost />
            <ErrorReporter />
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
