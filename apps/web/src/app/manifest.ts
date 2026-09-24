import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aquastats",
    short_name: "Aquastats",
    description: "Tempos, treinos e resultados para natação competitiva",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#0b1f3a",
    lang: "pt",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
