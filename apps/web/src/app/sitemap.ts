import type { MetadataRoute } from "next";

const origin = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/privacidade", "/termos", "/seguranca"];
  return pages.map((path) => ({
    url: `${origin}${path || "/"}`,
    lastModified: new Date("2026-09-19"),
  }));
}
