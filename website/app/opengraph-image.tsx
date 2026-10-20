import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview for chats and social sites, rendered once at build time: the gold cover of the
// manual on the left, the real plugin window running off the right edge. twitter-image.tsx reuses it.

export const alt = "SnapTune: free pitch correction plugin for Mac, Windows and Linux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const green = "#133621";
const gold = "#f4d96c";

export default async function Image() {
  const [rokkitt, literata, literataBold, screenshot] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Rokkitt-ExtraBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Literata-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Literata-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/screenshot.png")),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: green, fontFamily: "Literata", overflow: "hidden" }}>
        <img
          alt=""
          src={`data:image/png;base64,${screenshot.toString("base64")}`}
          width={820}
          height={525}
          style={{ position: "absolute", left: 560, top: 70, borderRadius: 8 }}
        />

        <div
          style={{
            position: "absolute",
            left: 56,
            top: 48,
            width: 440,
            height: 534,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "44px 36px 36px",
            background: gold,
            color: green,
          }}
        >
          <svg width="52" height="52" viewBox="0 0 48 48">
            <path d="M33.54 15.17A13 13 0 1 0 33.54 32.83" fill="none" stroke={green} strokeWidth="5.5" />
            <rect x="21.25" y="6" width="5.5" height="36" fill={green} />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "Rokkitt", fontSize: 108, lineHeight: 0.88, letterSpacing: "-0.01em" }}>
            <span style={{ transform: "translateX(-34px)" }}>SNAP</span>
            <span style={{ transform: "translateX(34px)" }}>TUNE</span>
          </div>
          <div style={{ display: "flex", textAlign: "center", fontSize: 27, lineHeight: 1.3 }}>Free pitch correction for Mac, Windows and Linux, with 2.7&nbsp;ms of delay while you record.</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600 }}>getsnaptune.com</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Rokkitt", data: rokkitt, style: "normal", weight: 800 },
        { name: "Literata", data: literata, style: "normal", weight: 400 },
        { name: "Literata", data: literataBold, style: "normal", weight: 600 },
      ],
    },
  );
}
