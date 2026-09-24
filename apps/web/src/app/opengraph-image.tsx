import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aquastats";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#f4f6f8",
          color: "#0b1f3a",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#667085" }}>
          Natação competitiva
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 84, fontWeight: 600, letterSpacing: -3 }}>
          aquastats
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: "#667085" }}>
          Tempos, treinos e resultados da equipa.
        </div>
      </div>
    ),
    size,
  );
}
