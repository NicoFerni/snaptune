// The plugin's palette (Source/ui/SnapLookAndFeel.h): bottle green and gold. Panels sit darker than
// the ground, text is ivory in two strengths, gold is the pitch that comes out (and the one selected
// thing in a group), sage is the pitch as sung.
export const palette = {
  background: "#133621",
  panel: "#0e2a19",
  raised: "#1b462b",
  line: "#234d34",
  lineBright: "#2f5f40",
  grid: "#173a24",
  laneBlack: "#0b2314",
  text: "#efe8cf",
  textDim: "#b4bea4",
  textFaint: "#8e9c87",
  accent: "#f4d96c", // corrected pitch, the selection
  input: "#9cc0a4", // detected pitch
  held: "#efe8cf", // held MIDI notes
};

/** CSS font size for a JUCE font height in the text face, Literata (ascent + descent is 1.485 em). */
export const fontSize = (juceHeight: number) => juceHeight / 1.485;

/** CSS font size for a JUCE font height in the display face, Rokkitt (ascent + descent is 1.137 em). */
export const displaySize = (juceHeight: number) => juceHeight / 1.137;

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
