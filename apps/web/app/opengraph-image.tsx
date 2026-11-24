import { ImageResponse } from "next/og";
import { INSTALL_COMMAND, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// CSS variables do not exist here: the colours are the dark theme of globals.css.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        color: "#e7e9ef",
        backgroundColor: "#0a0c12",
        backgroundImage:
          "radial-gradient(circle at 80% 0%, rgba(123,87,242,0.45), rgba(10,12,18,0) 60%)",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
        {SITE_NAME}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          fontSize: 84,
          lineHeight: 1.1,
          letterSpacing: -2,
        }}
      >
        Every crash, grouped and&nbsp;
        <span style={{ color: "#a892ff" }}>explained.</span>
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#8e96ab" }}>
        {`${SITE_TAGLINE}  ·  ${INSTALL_COMMAND}`}
      </div>
    </div>,
    size,
  );
}
