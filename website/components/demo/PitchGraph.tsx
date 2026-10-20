"use client";

import { memo, useId, useRef, type CSSProperties, type PointerEvent } from "react";
import { isSharp, maskContains, noteLabel, pitchClass } from "./model";
import { fontSize, palette } from "./palette";

// Port of Source/ui/PitchGraph: piano-roll pitch history, one lane per semitone (in-scale lanes lit),
// the detected pitch dashed sage and the corrected pitch gold, scrolling right to left.
//
// The note range stays put while you sing. It only slides when the voice has been out of view for a
// moment; dragging moves it by hand and locks it, double-click follows again.

const capacity = 4096;
const keyboardWidth = 46;
const cornerRadius = 5;

export class GraphModel {
  readonly input = new Float32Array(capacity);
  readonly output = new Float32Array(capacity);
  readonly target = new Int16Array(capacity);
  readonly voiced = new Uint8Array(capacity);
  head = 0;
  totalFrames = 0;
  framesPerSecond = 375;
  readonly visibleSeconds = 5;
  readonly span = 16;
  viewLow: number;
  targetLow: number;
  homeNote = 57;
  followSinger = true;
  hasFollowed = false;
  outOfViewFrames = 0;

  constructor() {
    this.viewLow = this.targetLow = this.homeNote - Math.floor(this.span * 0.5) - 0.5;
  }

  setFramesPerSecond(fps: number) {
    this.framesPerSecond = Math.max(1, fps);
  }

  /** Ring index of the frame `age` hops before the newest. */
  at(age: number) {
    return (((this.head - 1 - age) % capacity) + capacity) % capacity;
  }

  visibleFrames() {
    return Math.min(capacity - 1, Math.max(16, Math.trunc(this.framesPerSecond * this.visibleSeconds)));
  }

  setHomeNote(note: number) {
    if (note === this.homeNote) return false;

    this.homeNote = note;

    // Before anything has been sung, show the range the selected voice sits in.
    if (this.followSinger && !this.hasFollowed) {
      this.moveViewTo(this.homeNote - Math.floor(this.span * 0.5) - 0.5);
      this.viewLow = this.targetLow;
      return true;
    }

    return false;
  }

  moveViewTo(lowestNote: number) {
    this.targetLow = Math.min(108 - this.span + 0.5, Math.max(12 - 0.5, lowestNote));
  }

  /** Age of the newest voiced frame within the last `withinSeconds`, or -1. */
  latestVoiced(withinSeconds: number) {
    for (let age = 0; age < Math.trunc(this.framesPerSecond * withinSeconds) && age < this.totalFrames; ++age)
      if (this.voiced[this.at(age)]) return age;

    return -1;
  }

  /** `frames` holds 4 floats per frame: input note, output note, target note, voiced. */
  pushFrames(frames: Float32Array, count: number) {
    for (let i = 0; i < count; ++i) {
      const voiced = frames[i * 4 + 3] > 0.5;
      const output = frames[i * 4 + 1];
      this.input[this.head] = frames[i * 4];
      this.output[this.head] = output;
      this.target[this.head] = frames[i * 4 + 2];
      this.voiced[this.head] = voiced ? 1 : 0;
      this.head = (this.head + 1) % capacity;
      ++this.totalFrames;

      // Count how long the voice has been outside the visible rows.
      if (voiced)
        this.outOfViewFrames = output < this.targetLow + 0.5 || output > this.targetLow + this.span - 0.5 ? this.outOfViewFrames + 1 : 0;
    }

    // The rows only move once the singer has been out of view for a quarter of a second, and then
    // jump to put that note in the middle: a still grid you can read, never a constant drift.
    if (this.followSinger && this.outOfViewFrames > Math.trunc(this.framesPerSecond * 0.25)) {
      const latest = this.latestVoiced(0.1);

      if (latest >= 0) {
        this.moveViewTo(Math.round(this.output[this.at(latest)]) - Math.floor(this.span * 0.5) - 0.5);
        this.hasFollowed = true;
      }

      this.outOfViewFrames = 0;
    }

    this.viewLow += 0.35 * (this.targetLow - this.viewLow);

    if (Math.abs(this.targetLow - this.viewLow) < 0.01) this.viewLow = this.targetLow;
  }

  followAgain() {
    this.followSinger = true;
    const latest = this.latestVoiced(2);
    this.moveViewTo((latest >= 0 ? Math.round(this.output[this.at(latest)]) : this.homeNote) - Math.floor(this.span * 0.5) - 0.5);
    this.viewLow = this.targetLow;
  }
}

//==============================================================================
// Lanes and keys, piano-roll style. They only change when the view moves or the scale changes.
const Rows = memo(function Rows({ low, span, width, height, mask, liveTarget }: { low: number; span: number; width: number; height: number; mask: number; liveTarget: number }) {
  const high = low + span;
  const rowHeight = height / span;
  const noteToY = (note: number) => height - ((note - low) / (high - low)) * height;
  const rows = [];

  for (let note = Math.floor(low) - 1; note <= Math.ceil(high) + 1; ++note) {
    const yTop = noteToY(note + 0.5);
    const black = isSharp(pitchClass(note));
    const inScale = maskContains(mask, note);
    const isC = pitchClass(note) === 0;
    // The keyboard: the notes in the scale are lit ivory keys, the one being tuned to is gold.
    const keyFill = note === liveTarget ? palette.accent : inScale ? palette.raised : black ? palette.laneBlack : palette.panel;

    rows.push(
      <g key={note}>
        <rect x={keyboardWidth} y={yTop} width={width - keyboardWidth} height={rowHeight} fill={black ? palette.laneBlack : palette.panel} />
        {inScale && <rect x={keyboardWidth} y={yTop} width={width - keyboardWidth} height={rowHeight} fill={palette.text} fillOpacity={0.025} />}
        <rect x={0} y={yTop} width={keyboardWidth - 1} height={rowHeight} fill={keyFill} />
        {/* Row separators, with a stronger line under every C. */}
        <rect x={0} y={yTop + rowHeight - 1} width={width} height={1} fill={isC ? palette.line : palette.grid} />
        {(inScale || isC) && rowHeight > 11 && (
          <text
            x={keyboardWidth - 7}
            y={yTop + rowHeight / 2}
            dy="0.35em"
            textAnchor="end"
            fontSize={fontSize(Math.min(11.5, rowHeight * 0.58))}
            fontWeight={600}
            fill={note === liveTarget ? palette.background : inScale ? palette.text : palette.textDim}
          >
            {noteLabel(note)}
          </text>
        )}
      </g>,
    );
  }

  return <>{rows}</>;
});

function buildPath(m: GraphModel, corrected: boolean, count: number, stride: number, plotRight: number, dx: number, noteToY: (n: number) => number, outputFrom: number) {
  let d = "";
  let penDown = false;
  let previous = 0;

  for (let age = count - 1; age >= 0; --age) {
    const i = m.at(age);

    if (!m.voiced[i] || (corrected && m.totalFrames - 1 - age < outputFrom)) {
      penDown = false;
      continue;
    }

    if (age % stride !== 0 && penDown) continue;

    const note = corrected ? m.output[i] : m.input[i];
    const x = (plotRight - age * dx).toFixed(1);
    const y = noteToY(note).toFixed(1);
    d += (!penDown || Math.abs(note - previous) > 3 ? "M" : "L") + x + " " + y;
    penDown = true;
    previous = note;
  }

  return d;
}

type Props = {
  model: GraphModel;
  /** Notes in the scale (or the held MIDI notes): their lanes are lit. */
  mask: number;
  width: number;
  height: number;
  /** Bumped by the owner whenever the model changed; the graph has no state of its own. */
  version: number;
  /** The output line is only drawn from this frame on (the promo video bypasses SnapTune before it). */
  outputFrom?: number;
  onChange: () => void;
  className?: string;
  style?: CSSProperties;
};

export function PitchGraph({ model: m, mask, width, height, onChange, className, style, outputFrom = 0 }: Props) {
  const id = useId();
  const drag = useRef<{ startLow: number; startY: number; rowHeight: number } | null>(null);

  const plotX = keyboardWidth;
  const plotW = width - keyboardWidth;
  const low = m.viewLow;
  const high = low + m.span;
  const noteToY = (note: number) => height - ((note - low) / (high - low)) * height;

  const shown = (age: number) => m.totalFrames - 1 - age >= outputFrom;

  let liveTarget = -1;
  for (let age = 0; age < Math.trunc(m.framesPerSecond * 0.15) && age < m.totalFrames; ++age)
    if (m.voiced[m.at(age)]) {
      if (shown(age)) liveTarget = m.target[m.at(age)];
      break;
    }

  // One-second grid.
  const visible = m.visibleFrames();
  const dx = plotW / visible;
  const secondWidth = m.framesPerSecond * dx;
  const phase = (m.totalFrames % m.framesPerSecond) * dx;
  const gridLines = [];
  for (let x = width - phase, k = 0; x > plotX && k < 20; x -= secondWidth, ++k) gridLines.push(x);

  // Pitch curves: thin out to ~one point per pixel, and fade them toward the past.
  const count = Math.min(m.totalFrames, visible);
  const stride = Math.max(1, Math.floor(1 / Math.max(dx, 0.01)));
  const sung = buildPath(m, false, count, stride, width, dx, noteToY, outputFrom);
  const output = buildPath(m, true, count, stride, width, dx, noteToY, outputFrom);

  // "Now" marker on the newest voiced frame, with the note it is tuned to.
  let marker = null;
  const nowAge = m.latestVoiced(0.15);

  if (nowAge >= 0 && nowAge < count && shown(nowAge)) {
    const i = m.at(nowAge);
    const dot = { x: width - nowAge * dx - 4, y: noteToY(m.output[i]) };
    let tagY = dot.y - 22 - 10;
    if (tagY < 4) tagY = dot.y + 12;

    marker = (
      <g>
        <circle cx={dot.x} cy={dot.y} r={4} fill={palette.accent} />
        {m.target[i] >= 0 && (
          <g>
            <rect x={dot.x - 24 - 20} y={tagY} width={40} height={20} rx={3} fill={palette.panel} stroke={palette.accent} strokeOpacity={0.7} />
            <text x={dot.x - 24} y={tagY + 10} dy="0.35em" textAnchor="middle" fontSize={fontSize(12)} fontWeight={600} fill={palette.accent}>
              {noteLabel(m.target[i])}
            </text>
          </g>
        )}
      </g>
    );
  }

  // Arrow at the edge when the voice is above or below the rows on screen.
  let arrow = null;
  const latest = m.latestVoiced(0.15);

  if (latest >= 0) {
    const out = m.output[m.at(latest)];
    const above = out > high - 0.3;
    const below = out < low + 0.3;

    if (above || below) {
      const cx = width - 40;
      const cy = above ? 16 : height - 16;
      const ax = cx - 29 + 12;
      const note = m.target[m.at(latest)] >= 0 ? m.target[m.at(latest)] : Math.round(out);

      arrow = (
        <g>
          <rect x={cx - 29} y={cy - 11} width={58} height={22} rx={3} fill={palette.panel} stroke={palette.accent} />
          <path
            d={above ? `M${ax - 4} ${cy + 2.5}L${ax + 4} ${cy + 2.5}L${ax} ${cy - 3.5}Z` : `M${ax - 4} ${cy - 2.5}L${ax + 4} ${cy - 2.5}L${ax} ${cy + 3.5}Z`}
            fill={palette.accent}
          />
          <text x={cx - 29 + 20} y={cy} dy="0.35em" fontSize={fontSize(12)} fontWeight={600} fill={palette.accent}>
            {noteLabel(note)}
          </text>
        </g>
      );
    }
  }

  const fade = (name: string) => `url(#${id}-${name})`;
  const legendX = plotX + 10;

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    // Touch drags scroll the page instead.
    if (e.pointerType === "touch" || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startLow: m.targetLow, startY: e.clientY, rowHeight: e.currentTarget.getBoundingClientRect().height / m.span };
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || e.clientY === d.startY) return;
    m.followSinger = false;
    m.moveViewTo(Math.round(d.startLow + (e.clientY - d.startY) / d.rowHeight));
    m.viewLow = m.targetLow;
    onChange();
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={style}
      role="img"
      aria-label="Pitch graph. Dashed sage: what you sang. Solid gold: what comes out."
      data-tip="Drag to move the note range (it then stays put). Double-click to follow the singer again."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => {
        m.followAgain();
        onChange();
      }}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect width={width} height={height} rx={cornerRadius} />
        </clipPath>
        <clipPath id={`${id}-plot`}>
          <rect x={plotX} width={plotW} height={height} />
        </clipPath>
        {/* Both curves fade toward the past. */}
        {(["sage", "gold"] as const).map((name) => (
          <linearGradient key={name} id={`${id}-${name}`} gradientUnits="userSpaceOnUse" x1={plotX} x2={plotX + plotW * 0.4} y1={0} y2={0}>
            <stop offset={0} stopColor={name === "sage" ? palette.input : palette.accent} stopOpacity={0} />
            <stop offset={1} stopColor={name === "sage" ? palette.input : palette.accent} stopOpacity={name === "sage" ? 0.85 : 1} />
          </linearGradient>
        ))}
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <Rows low={low} span={m.span} width={width} height={height} mask={mask} liveTarget={liveTarget} />
        <rect x={plotX - 1} width={1} height={height} fill={palette.line} />

        {gridLines.map((x, k) => (
          <rect key={k} x={x} width={1} height={height} fill={palette.text} fillOpacity={0.035} />
        ))}

        <g clipPath={`url(#${id}-plot)`} fill="none" strokeLinejoin="round">
          {/* The sung line is dashed so the two curves differ by more than colour. */}
          <path d={sung} stroke={fade("sage")} strokeWidth={1.6} strokeDasharray="5 4" />
          <path d={output} stroke={fade("gold")} strokeWidth={2.4} strokeLinecap="round" />
        </g>

        {marker}
        {arrow}

        {!sung && (
          <g textAnchor="middle">
            <text x={plotX + plotW / 2} y={height / 2 - 10} dy="0.35em" fontSize={fontSize(14)} fontWeight={600} fill={palette.text}>
              Press play, or sing
            </text>
            <text x={plotX + plotW / 2} y={height / 2 + 12} dy="0.35em" fontSize={fontSize(12.5)} fill={palette.textDim}>
              Its pitch and the tuned pitch will draw here.
            </text>
          </g>
        )}

        {/* Legend at the top left, clear of the out-of-range arrow on the right, on a backing so curves
            near the top row pass behind it rather than through the text. */}
        <g>
          <rect x={legendX} y={8} width={146} height={22} rx={3} fill={palette.panel} stroke={palette.line} />
          <rect x={legendX + 10} y={18} width={5} height={2} fill={palette.input} />
          <rect x={legendX + 19} y={18} width={5} height={2} fill={palette.input} />
          <text x={legendX + 30} y={19} dy="0.35em" fontSize={fontSize(12)} fill={palette.textDim}>
            Sung
          </text>
          <rect x={legendX + 68} y={17.5} width={14} height={3} rx={1.5} fill={palette.accent} />
          <text x={legendX + 88} y={19} dy="0.35em" fontSize={fontSize(12)} fill={palette.textDim}>
            Output
          </text>
        </g>
      </g>
    </svg>
  );
}
