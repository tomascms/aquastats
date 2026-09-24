import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1f3a",
          borderRadius: 96,
          color: "#ffffff",
          fontSize: 210,
          fontWeight: 600,
          letterSpacing: -6,
        }}
      >
        a
      </div>
    ),
    size,
  );
}
