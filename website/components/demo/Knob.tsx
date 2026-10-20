"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { KNOBS, fromProportion, toProportion, type KnobId } from "./model";
import { arcPath, fontSize, palette, pointOn } from "./palette";

// Port of SnapLookAndFeel::drawRotarySlider: the large Retune Speed knob ("hero") and the small ones.
// Flat: no gradients, glows or shadows, as in the plugin.

const startAngle = Math.PI * 1.25;
const endAngle = Math.PI * 2.75;
const pixelsForFullDrag = 240;

function ValueArc(props: { cx: number; cy: number; radius: number; thickness: number; angle: number; bipolar: boolean; colour: string; emphasised: boolean }) {
  const { cx, cy, radius, thickness, angle, bipolar, colour, emphasised } = props;
  const origin = bipolar ? (startAngle + endAngle) * 0.5 : startAngle;

  return (
    <g fill="none" strokeLinecap="butt">
      <path d={arcPath(cx, cy, radius, startAngle, endAngle)} stroke={emphasised ? "#3a6e4c" : palette.lineBright} strokeWidth={thickness} />
      {Math.abs(angle - origin) >= 0.01 && <path d={arcPath(cx, cy, radius, Math.min(origin, angle), Math.max(origin, angle))} stroke={colour} strokeWidth={thickness} />}
    </g>
  );
}

function KnobBody({ cx, cy, radius, emphasised }: { cx: number; cy: number; radius: number; emphasised: boolean }) {
  return <circle cx={cx} cy={cy} r={radius - 0.5} fill={palette.raised} stroke={emphasised ? "rgb(180 190 164 / 0.6)" : palette.lineBright} strokeWidth={1} />;
}

type Props = {
  param: KnobId;
  value: number;
  onChange: (value: number) => void;
  hero?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Knob({ param, value, onChange, hero = false, disabled = false, className = "", style }: Props) {
  const def = KNOBS[param];
  const drag = useRef<{ x: number; y: number; proportion: number } | null>(null);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focusRing, setFocusRing] = useState(false);

  const proportion = toProportion(def, value);
  const angle = startAngle + proportion * (endAngle - startAngle);
  const emphasised = (hover || dragging) && !disabled;
  const text = def.format(value);

  const set = (p: number) => {
    const next = fromProportion(def, p);
    if (next !== value) onChange(next);
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, proportion };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // RotaryHorizontalVerticalDrag: right or up turns it up.
    set(d.proportion + (e.clientX - d.x + (d.y - e.clientY)) / pixelsForFullDrag);
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = e.shiftKey ? 0.001 : 0.01;
    const moves: Record<string, number> = {
      ArrowUp: proportion + step,
      ArrowRight: proportion + step,
      ArrowDown: proportion - step,
      ArrowLeft: proportion - step,
      PageUp: proportion + 0.1,
      PageDown: proportion - 0.1,
      Home: 0,
      End: 1,
    };

    if (e.key in moves) {
      e.preventDefault();
      set(moves[e.key]);
    }
  }

  let drawing;

  if (hero) {
    // 180 x 128: a tick ring to read against, the value arc in gold, the value inside, Fast / Slow at the ends.
    const cx = 90;
    const cy = 64;
    const radius = 58;
    const arcRadius = radius - 11;
    const bodyRadius = radius - 20;
    const handle = pointOn(cx, cy, arcRadius, angle);
    const startPoint = pointOn(cx, cy, radius + 2, startAngle);
    const endPoint = pointOn(cx, cy, radius + 2, endAngle);

    drawing = (
      <svg viewBox="0 0 180 128" className="block h-full w-full overflow-visible" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => {
          const a = startAngle + ((endAngle - startAngle) * i) / 20;
          const major = i % 5 === 0;
          const p = pointOn(cx, cy, radius - (major ? 1 : 3), a);
          const q = pointOn(cx, cy, radius + 3, a);
          return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={major ? palette.textDim : palette.lineBright} strokeOpacity={major ? 0.7 : 1} strokeWidth={major ? 1.4 : 1} />;
        })}
        <ValueArc cx={cx} cy={cy} radius={arcRadius} thickness={5} angle={angle} bipolar={false} colour={palette.accent} emphasised={emphasised} />
        {focusRing && <circle cx={cx} cy={cy} r={radius + 4} fill="none" stroke={palette.accent} strokeWidth={2} />}
        <KnobBody cx={cx} cy={cy} radius={bodyRadius} emphasised={emphasised} />
        <circle cx={handle.x} cy={handle.y} r={4.5} fill={palette.text} />
        <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={fontSize(18)} fontWeight={600} fill={palette.text}>
          {text}
        </text>
        <g fontSize={fontSize(12)} fill={palette.textDim} textAnchor="middle">
          <text x={startPoint.x - 4} y={startPoint.y + 12} dy="0.35em">
            Fast
          </text>
          <text x={endPoint.x + 4} y={endPoint.y + 12} dy="0.35em">
            Slow
          </text>
        </g>
      </svg>
    );
  } else {
    // 84 x 92: neutral arc (gold is kept for the output pitch and Retune Speed), value underneath.
    const cx = 42;
    const cy = 35;
    const radius = 33;
    const bodyRadius = radius - 11;
    const arcColour = disabled ? palette.lineBright : emphasised ? palette.text : palette.textDim;
    const p = pointOn(cx, cy, bodyRadius * 0.35, angle);
    const q = pointOn(cx, cy, bodyRadius * 0.82, angle);

    drawing = (
      <svg viewBox="0 0 84 92" className="block h-full w-full overflow-visible" aria-hidden="true">
        <ValueArc cx={cx} cy={cy} radius={radius - 3} thickness={4} angle={angle} bipolar={!!def.bipolar} colour={arcColour} emphasised={emphasised} />
        {focusRing && <circle cx={cx} cy={cy} r={radius + 1} fill="none" stroke={palette.accent} strokeWidth={2} />}
        <KnobBody cx={cx} cy={cy} radius={bodyRadius} emphasised={emphasised} />
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={disabled ? palette.textFaint : palette.text} strokeWidth={2.4} strokeLinecap="butt" />
        <text x={42} y={83} dy="0.35em" textAnchor="middle" fontSize={fontSize(13)} fontWeight={600} fill={emphasised ? palette.text : palette.textDim}>
          {text}
        </text>
      </svg>
    );
  }

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={def.title}
      aria-valuemin={def.min}
      aria-valuemax={def.max}
      aria-valuenow={value}
      aria-valuetext={text}
      aria-disabled={disabled || undefined}
      data-tip={def.tip}
      className={`st-knob ${className}`}
      style={{ ...style, opacity: disabled ? 0.35 : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onDoubleClick={() => !disabled && onChange(def.reset)}
      onKeyDown={onKeyDown}
      onFocus={(e) => setFocusRing(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocusRing(false)}
    >
      {drawing}
    </div>
  );
}
