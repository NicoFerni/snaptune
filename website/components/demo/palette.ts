// The plugin's palette (Source/ui/SnapLookAndFeel.h).
export const palette = {
  background: "#0a0c10",
  backgroundLift: "#11151c",
  panel: "#12161d",
  panelRaised: "#1a1f28",
  outline: "#242b36",
  outlineBright: "#343d4c",
  grid: "#181d25",
  text: "#eef2f7",
  textDim: "#9aa4b5",
  textFaint: "#7d879a",
  accent: "#3cf0bf", // corrected pitch, active state
  accentDeep: "#10a07c",
  input: "#ff8a5b", // detected pitch
  midi: "#a996ff", // held MIDI notes
};

/** CSS font size for a JUCE font height (ascent + descent; SF Pro's em is 1/1.19 of that). */
export const fontSize = (juceHeight: number) => juceHeight / 1.19;

// Rounded, so the server's HTML and the browser agree (their Math.sin can differ in the last digit).
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Point on a circle at `angle` radians clockwise from 12 o'clock, as JUCE measures it. */
export function pointOn(cx: number, cy: number, r: number, angle: number) {
  return { x: round(cx + r * Math.sin(angle)), y: round(cy - r * Math.cos(angle)) };
}

/** SVG path for a clockwise arc between two JUCE angles. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  const p = pointOn(cx, cy, r, a);
  const q = pointOn(cx, cy, r, b);
  return `M${p.x} ${p.y}A${r} ${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${q.x} ${q.y}`;
}
