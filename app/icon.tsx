import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 512,
  height: 512,
};
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
          background: "linear-gradient(135deg, #0f172a 0%, #0284c7 50%, #00B4D8 100%)",
          borderRadius: "50%",
          padding: "24px",
          border: "16px solid #ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "220px",
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-8px",
              fontFamily: "sans-serif",
              lineHeight: 1,
            }}
          >
            CT
          </span>
          <span
            style={{
              fontSize: "42px",
              fontWeight: 800,
              color: "#E0F7FA",
              letterSpacing: "4px",
              marginTop: "8px",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
            }}
          >
            SOLAR
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
