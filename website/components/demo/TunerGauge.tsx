import type { CSSProperties } from "react";
import { noteName, noteOctave, spokenNote } from "./model";
import { arcPath, fontSize, palette, pointOn } from "./palette";

// Port of Source/ui/TunerGauge: an arc of +/-50 cents around the note being tuned to, with the sung
// pitch as a coral dot and the output as a teal needle.

const rangeCents = 50;
const sweep = Math.PI * 0.42; // each side of 12 o'clock
const width = 290;
const height = 164;

const angleFor = (cents: number) => Math.min(1, Math.max(-1, cents / rangeCents)) * sweep;

function signedCents(cents: number) {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? "+" : ""}${rounded}¢`;
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

export class GaugeModel {
  active = false;
  note = -1;
  targetInput = 0;
  targetOutput = 0;
  shownInput = 0;
  shownOutput = 0;
  presence = 0;

  setState(isActive: boolean, targetNote: number, inputCents: number, outputCents: number) {
    this.active = isActive;

    if (isActive) {
      this.note = targetNote;
      this.targetInput = inputCents;
      this.targetOutput = outputCents;
    }
  }

  /** One 60 Hz animation step; true when something visible moved. */
  animate() {
    const before = this.shownInput + this.shownOutput + this.presence;
    this.shownInput += 0.35 * (this.targetInput - this.shownInput);
    this.shownOutput += 0.35 * (this.targetOutput - this.shownOutput);
    this.presence += (this.active ? 0.3 : 0.08) * ((this.active ? 1 : 0) - this.presence);
    return Math.abs(this.shownInput + this.shownOutput + this.presence - before) > 0.002;
  }

  /** Jumps straight to the target, for a picture that starts settled. */
  settle() {
    this.shownInput = this.targetInput;
    this.shownOutput = this.targetOutput;
    this.presence = this.active ? 1 : 0;
  }

  statusText() {
    if (!this.active) return "LISTENING";
    return Math.abs(this.targetOutput) < 3 ? "OUTPUT IN TUNE" : "CORRECTING";
  }

  describe() {
    if (!this.active || this.note < 0) return "Tuner: listening";
    return `Tuner: ${spokenNote(noteName(this.note))}${noteOctave(this.note)}, ${this.statusText().toLowerCase()}, sung ${Math.round(this.targetInput)} cents, output ${Math.round(this.targetOutput)} cents`;
  }
}

export function TunerGauge({ model: g, className, style }: { model: GaugeModel; version: number; className?: string; style?: CSSProperties }) {
  const radius = Math.min(width * 0.39, height * 0.72);
  const cx = width / 2;
  const cy = radius + 24;
  const arcEndY = cy - radius * Math.cos(sweep);
  const arc = (from: number, to: number) => arcPath(cx, cy, radius, angleFor(from), angleFor(to));
  const presence = g.presence;

  const ticks = [];
  for (let cents = -50; cents <= 50; cents += 10) {
    const a = angleFor(cents);
    const major = cents % 50 === 0;
    const p = pointOn(cx, cy, radius + 9, a);
    const q = pointOn(cx, cy, radius + (major ? 17 : 13), a);
    ticks.push(<line key={cents} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={major ? palette.textDim : palette.outlineBright} strokeWidth={major ? 1.6 : 1} />);
  }

  let marks = null;

  if (presence > 0.01) {
    const sung = pointOn(cx, cy, radius, angleFor(g.shownInput));
    const outAngle = angleFor(g.shownOutput);
    const n0 = pointOn(cx, cy, radius * 0.8, outAngle);
    const n1 = pointOn(cx, cy, radius + 6, outAngle);
    const needle = `M${n0.x} ${n0.y}L${n1.x} ${n1.y}`;

    marks = (
      <g>
        {/* Correction span: from where it was sung to where it lands. */}
        <path d={arc(Math.min(g.shownInput, g.shownOutput), Math.max(g.shownInput, g.shownOutput))} stroke={palette.accent} strokeOpacity={0.4 * presence} strokeWidth={3} fill="none" />
        {/* Sung pitch. */}
        <circle cx={sung.x} cy={sung.y} r={11} fill={palette.input} fillOpacity={0.25 * presence} />
        <circle cx={sung.x} cy={sung.y} r={5.5} fill={palette.input} fillOpacity={presence} />
        {/* Corrected pitch needle. */}
        <path d={needle} stroke={palette.accent} strokeOpacity={0.2 * presence} strokeWidth={10} strokeLinecap="round" />
        <path d={needle} stroke={palette.accent} strokeOpacity={presence} strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  }

  // Note name in the middle, octave as a smaller suffix.
  const hasNote = g.note >= 0 && presence > 0.05;
  const noteColour = hasNote ? mix(palette.text, palette.textFaint, 1 - presence) : palette.textFaint;
  const locked = Math.abs(g.targetOutput) < 3;
  const readoutY = arcEndY + 14;
  const inputColour = g.active ? palette.input : palette.textFaint;
  const outputColour = g.active ? palette.accent : palette.textFaint;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} style={style} role="img" aria-label={g.describe()} data-tip="Coral: what you sang. Teal: what comes out. Centre: the note it is tuning to.">
      {/* Track and the "in tune" window. */}
      <path d={arc(-rangeCents, rangeCents)} stroke={palette.outline} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d={arc(-5, 5)} stroke={palette.accent} strokeOpacity={0.22} strokeWidth={9} strokeLinecap="round" fill="none" />
      {ticks}

      <g className="st-caption-svg" fill={palette.textFaint} textAnchor="middle">
        {[-50, 50].map((cents) => {
          const p = pointOn(cx, cy, radius - 24, angleFor(cents));
          return (
            <text key={cents} x={p.x} y={p.y} dy="0.35em">
              {cents < 0 ? "-50" : "+50"}
            </text>
          );
        })}
      </g>

      {marks}

      <text x={cx} y={cy - radius * 0.5} dy="0.35em" textAnchor="middle" fill={noteColour} fontWeight={700} fontSize={fontSize(52)}>
        {hasNote ? noteName(g.note) : "--"}
        {hasNote && (
          <tspan fontSize={fontSize(22)} fillOpacity={0.55}>
            {noteOctave(g.note)}
          </tspan>
        )}
      </text>

      {/* Status line and the two readouts. */}
      <text className="st-caption-svg" x={cx} y={cy - radius * 0.5 + 38} dy="0.35em" textAnchor="middle" fill={!g.active ? palette.textFaint : locked ? palette.accent : palette.textDim}>
        {g.statusText()}
      </text>

      <text className="st-caption-svg" x={14} y={readoutY + 7} dy="0.35em" fill={palette.textFaint}>
        SUNG
      </text>
      <text x={14} y={readoutY + 25} dy="0.35em" fontSize={fontSize(16)} fontWeight={700} fill={inputColour}>
        {g.active ? signedCents(g.targetInput) : "--"}
      </text>
      <text className="st-caption-svg" x={width - 14} y={readoutY + 7} dy="0.35em" textAnchor="end" fill={palette.textFaint}>
        OUTPUT
      </text>
      <text x={width - 14} y={readoutY + 25} dy="0.35em" textAnchor="end" fontSize={fontSize(16)} fontWeight={700} fill={outputColour}>
        {g.active ? signedCents(g.targetOutput) : "--"}
      </text>
    </svg>
  );
}
