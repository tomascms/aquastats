import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev only: without this the dev server blocks 127.0.0.1 and the pages never hydrate (forms submit as plain GETs).
  allowedDevOrigins: ["127.0.0.1"],
  // Cloudflare Workers has no image optimiser here (_next/image served originals with no cache):
  // the few images are static, pre-sized WebP files in public/.
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  compress: true,
  async redirects() {
    return [
      { source: "/", destination: "/entrar", permanent: false },
      { source: "/coach/meets/new", destination: "/coach/competicoes", permanent: true },
      { source: "/coach/meets/:id/results", destination: "/coach/competicoes/:id/resultados", permanent: true },
      { source: "/coach/meets/:id", destination: "/coach/competicoes/:id", permanent: true },
    ];
  },
  async headers() {
    // Content-Security-Policy is set per request in middleware.ts (it carries a nonce).
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};

export default nextConfig;
