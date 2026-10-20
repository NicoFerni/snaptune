import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview for chats and social sites, rendered once at build time: the hero's promise on the
// left, the real plugin window bleeding off the right edge. twitter-image.tsx reuses it.

export const alt = "SnapTune: free pitch correction plugin for Mac and Windows. Hard-tune. Live. Free.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [regular, semibold, screenshot] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Inter-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/screenshot.png")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          // A teal wash toward the window (ImageResponse draws linear gradients cleanly; radial ones band).
          background: "linear-gradient(115deg, #0a0c10 45%, #0f2620 100%)",
          color: "#eef2f7",
          fontFamily: "Inter",
          overflow: "hidden",
        }}
      >
        <img
          alt=""
          src={`data:image/png;base64,${screenshot.toString("base64")}`}
          width={781}
          height={500}
          style={{
            position: "absolute",
            left: 600,
            top: 92,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px", width: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="52" height="52" viewBox="0 0 32 32">
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#4bf0c0" />
                  <stop offset="1" stopColor="#1fb98c" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#bg)" />
              <path
                d="M6 18.5c2.2 0 2.6-5 4.8-5s2.4 5 4.6 5h1.6c2.2 0 2.6-5 4.8-5h4.2"
                fill="none"
                stroke="#0b1418"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>
              Snap<span style={{ color: "#3cf0bf" }}>Tune</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.04em" }}>
              <span>Hard-tune.</span>
              <span>Live.</span>
              <span style={{ color: "#3cf0bf" }}>Free.</span>
            </div>
            <div style={{ marginTop: 26, fontSize: 27, lineHeight: 1.3, color: "#9aa4b5", letterSpacing: "-0.01em" }}>
              Pitch correction you hear while you record, with 2.7 ms of delay.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 21, color: "#7d879a", whiteSpace: "nowrap" }}>
            <span style={{ color: "#eef2f7", fontWeight: 600 }}>getsnaptune.com</span>
            <span>·</span>
            <span>VST3 · AU · Mac &amp; Windows</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: regular, style: "normal", weight: 400 },
        { name: "Inter", data: semibold, style: "normal", weight: 600 },
      ],
    },
  );
}
