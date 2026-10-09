import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com${
    isProd ? "" : " ws: wss: http://127.0.0.1:3000 http://localhost:3000"
  }`,
  "frame-src https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
