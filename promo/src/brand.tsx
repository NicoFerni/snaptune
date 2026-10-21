import type { CSSProperties, ReactNode } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// SnapTune's look for the video, the same as the website and the plugin: bottle green and gold, with
// ivory for paper. The page is set like the manual of a precision instrument, so the video lays its
// cards down like printed sheets on a table, and the mark is a cent sign drawn as a tuner: SnapTune
// measures in cents and costs none. Type: Rokkitt capitals for display, Literata for everything else.

export const brand = {
  green: "#133621",
  surface: "#1a4429",
  deep: "#0e2a19",
  gold: "#f4d96c",
  muted: "#b3a55e",
  paper: "#efe8cf",
  sage: "#9cc0a4",
};

export const display: CSSProperties = { fontFamily: "Rokkitt", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.88 };
export const text: CSSProperties = { fontFamily: "Literata", fontWeight: 400, lineHeight: 1.35 };

const waitForFonts = delayRender("Loading the brand fonts");

Promise.all(
  [
    new FontFace("Rokkitt", `url(${staticFile("fonts/Rokkitt.ttf")})`, { weight: "100 900" }),
    new FontFace("Literata", `url(${staticFile("fonts/Literata.ttf")})`, { weight: "200 900" }),
    new FontFace("Literata", `url(${staticFile("fonts/Literata-Italic.ttf")})`, { weight: "200 900", style: "italic" }),
  ].map(async (face) => document.fonts.add(await face.load())),
)
  .then(() => continueRender(waitForFonts))
  .catch((error) => cancelRender(error));

//==============================================================================
// The mark: an arc open to the right with the needle through it (website/components/Logo.tsx).

const ARC = "M33.54 15.17A13 13 0 1 0 33.54 32.83";

/** The cent sign. As `progress` goes 0 to 1 the arc draws itself, then the needle drops through it
    and settles, the way a tuner's needle lands on the note. */
export function Cent({ size, color, progress = 1, style }: { size: number; color: string; progress?: number; style?: CSSProperties }) {
  const arc = Math.min(1, Math.max(0, progress / 0.6));
  const drop = Math.max(0, (progress - 0.55) / 0.45);
  const needle = drop <= 0 ? 0 : Math.min(1, drop) + 0.12 * Math.exp(-drop * 6) * Math.sin(drop * 14);

  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ overflow: "visible", ...style }} aria-hidden="true">
      <path d={ARC} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - arc} fill="none" stroke={color} strokeWidth={5.5} />
      {drop > 0 && <rect x={21.25} y={6} width={5.5} height={36 * Math.min(1.12, needle)} fill={color} />}
    </svg>
  );
}

/** The app icon: the mark in green on a gold tile, or the other way round on a gold page. */
export function Tile({ size, progress = 1, inverted = false, style }: { size: number; progress?: number; inverted?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 8, background: inverted ? brand.green : brand.gold, display: "grid", placeItems: "center", ...style }}>
      <Cent size={size} color={inverted ? brand.gold : brand.green} progress={progress} />
    </div>
  );
}

export function Wordmark({ size, color = brand.gold, style }: { size: number; color?: string; style?: CSSProperties }) {
  return <span style={{ ...display, fontSize: size, lineHeight: 1, color, whiteSpace: "nowrap", ...style }}>SnapTune</span>;
}

/** A number set large in Rokkitt with its unit set small after it ("40" "ms", "−38" "¢"). */
export function Readout({ value, unit, size, color, style }: { value: string; unit: string; size: number; color: string; style?: CSSProperties }) {
  return (
    <span style={{ fontFamily: "Rokkitt", fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: "-0.02em", color, whiteSpace: "nowrap", ...style }}>
      {value}
      <span style={{ fontSize: "0.45em", marginLeft: "0.06em" }}>{unit}</span>
    </span>
  );
}

//==============================================================================
// Motion.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Offset (px) of something settling into place `seconds` after it appeared: it lands low, swings
    past and locks, the way a scooped note settles under hard tune. */
export const settle = (seconds: number, amount = 26) => (seconds < 0 ? amount : amount * Math.exp(-seconds / 0.055) * Math.cos(2 * Math.PI * 7 * seconds));

/** Appears at `at` and settles. Gone outside [at, until). */
export function Settle({ t, at, until = Infinity, amount, style, children }: { t: number; at: number; until?: number; amount?: number; style?: CSSProperties; children: ReactNode }) {
  if (t < at || t >= until) return null;
  return <div style={{ position: "absolute", ...style, transform: `translateY(${settle(t - at, amount)}px)` }}>{children}</div>;
}

/** A printed sheet laid down on the table: it slides in from `from`, turned a few degrees, and comes to
    rest square. Children show once it has landed. */
export function Sheet({ t, at, from = "bottom", color, style, children }: { t: number; at: number; from?: "bottom" | "left" | "right"; color: string; style: CSSProperties; children?: ReactNode }) {
  if (t < at) return null;

  const p = clamp01((t - at) / 0.42);
  const ease = 1 - Math.pow(1 - p, 4);
  const distance = (1 - ease) * (from === "bottom" ? 900 : 1100);
  const turn = (1 - ease) * (from === "left" ? -6 : 6) + (p >= 1 ? 0 : 0.8 * Math.sin(p * Math.PI * 3) * (1 - p));
  const move = from === "bottom" ? `translateY(${distance}px)` : `translateX(${from === "left" ? -distance : distance}px)`;

  return (
    <div style={{ position: "absolute", background: color, ...style, transform: `${move} rotate(${turn}deg)` }}>
      {p >= 0.85 && children}
    </div>
  );
}
