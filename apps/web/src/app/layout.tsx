import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastHost } from "@/components/ui/toast-host";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Render HTML per request: prerendered pages ship `s-maxage=31536000`, which lets browsers keep
// serving an old app shell after a deploy. Hashed JS/CSS under /_next/static stay immutable.
export const dynamic = "force-dynamic";

const site = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "Aquastats",
    template: "%s · Aquastats",
  },
  description: "Tempos, treinos e resultados para natação competitiva.",
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
    locale: "pt_PT",
    siteName: "Aquastats",
    title: "Aquastats",
    description: "Tempos, treinos e resultados para natação competitiva.",
    url: site,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2545",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Aquastats",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  inLanguage: "pt-PT",
  description: "Tempos, treinos e resultados para natação competitiva.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className={`${geist.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-aqua focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Saltar para o conteúdo
        </a>
        <div id="conteudo" className="min-h-dvh w-full">
          {children}
          <ToastHost />
        </div>
      </body>
    </html>
  );
}
