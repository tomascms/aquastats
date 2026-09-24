import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacidade", "/termos", "/seguranca"],
        disallow: ["/coach", "/swimmer", "/escolher", "/entrar", "/repor", "/api"],
      },
    ],
  };
}
