"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { KNOBS, fromProportion, toProportion, type KnobId } from "./model";
import { arcPath, fontSize, palette, pointOn } from "./palette";

// Port of SnapLookAndFeel::drawRotarySlider: the large Retune Speed knob ("hero") and the small ones.

const startAngle = Math.PI * 1.25;
const endAngle = Math.PI * 2.75;
const pixelsForFullDrag = 240;

// Colour::withMultipliedBrightness (0.75f) of the arc colours, for the start of the value gradient.
const dimmed: Record<string, string> = {
  [palette.accent]: "#2db48f",
  [palette.textDim]: "#737b88",
  [palette.text]: "#b3b6b9",
  [palette.outlineBright]: "#272e39",
};

function ValueArc(props: {
  gradientId: string;
  cx: number;
  cy: number;
  radius: number;
  thickness: number;
  angle: number;
  bipolar: boolean;
  colour: string;
  glowAlpha: number;
  emphasised: boolean;
}) {
  const { gradientId, cx, cy, radius, thickness, angle, bipolar, colour, glowAlpha, emphasised } = props;
  const origin = bipolar ? (startAngle + endAngle) * 0.5 : startAngle;
  const value = arcPath(cx, cy, radius, Math.min(origin, angle), Math.max(origin, angle));

  return (
    <g fill="none" strokeLinecap="round">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={cx - radius} y1={cy + radius} x2={cx + radius} y2={cy - radius}>
          <stop offset={0} stopColor={dimmed[colour] ?? colour} />
          <stop offset={1} stopColor={colour} />
        </linearGradient>
      </defs>
      <path d={arcPath(cx, cy, radius, startAngle, endAngle)} stroke={emphasised ? palette.outlineBright : palette.outline} strokeWidth={thickness} />
      {Math.abs(angle - origin) >= 0.01 && (
        <>
          {glowAlpha > 0 && <path d={value} stroke={`url(#${gradientId})`} strokeOpacity={glowAlpha} strokeWidth={thickness * 2.6} />}
          <path d={value} stroke={`url(#${gradientId})`} strokeWidth={thickness} />
        </>
      )}
    </g>
  );
}

function KnobBody({ id, cx, cy, radius, emphasised }: { id: string; cx: number; cy: number; radius: number; emphasised: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-fill`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor="#272e3a" />
          <stop offset={1} stopColor="#13171e" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" x1={0} y1={cy - radius} x2={0} y2={cy}>
          <stop offset={0} stopColor="#fff" stopOpacity={emphasised ? 0.22 : 0.14} />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Soft shadow under the cap. */}
      <circle cx={cx} cy={cy + radius * 0.08} r={radius + 1} fill="#000" fillOpacity={0.35} />
      <circle cx={cx} cy={cy} r={radius} fill={`url(#${id}-fill)`} />
      <circle cx={cx} cy={cy} r={radius - 0.5} fill="none" stroke={`url(#${id}-rim)`} strokeWidth={1} />
    </g>
  );
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
  const id = useId();
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
    // 180 x 128: tick ring, glowing teal arc, the value inside, FAST / SLOW at the ends.
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
          const lit = a <= angle + 0.001;
          return (
            <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={lit ? palette.accent : palette.outlineBright} strokeOpacity={lit ? 0.7 : 1} strokeWidth={major ? 1.6 : 1} />
          );
        })}
        <ValueArc gradientId={`${id}-arc`} cx={cx} cy={cy} radius={arcRadius} thickness={7} angle={angle} bipolar={false} colour={palette.accent} glowAlpha={0.18} emphasised={emphasised} />
        {focusRing && <circle cx={cx} cy={cy} r={radius + 4} fill="none" stroke={palette.accent} strokeWidth={2} />}
        <KnobBody id={id} cx={cx} cy={cy} radius={bodyRadius} emphasised={emphasised} />
        {/* Handle riding the end of the value arc. */}
        <circle cx={handle.x} cy={handle.y} r={8.5} fill={palette.accent} fillOpacity={0.3} />
        <circle cx={handle.x} cy={handle.y} r={4.5} fill={palette.text} />
        <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={fontSize(18)} fontWeight={700} fill={palette.text}>
          {text}
        </text>
        <g className="st-caption-svg" fill={palette.textFaint} textAnchor="middle">
          <text x={startPoint.x - 4} y={startPoint.y + 12} dy="0.35em">
            FAST
          </text>
          <text x={endPoint.x + 4} y={endPoint.y + 12} dy="0.35em">
            SLOW
          </text>
        </g>
      </svg>
    );
  } else {
    // 84 x 92: neutral arc (teal is kept for the output pitch and Retune Speed), value underneath.
    const cx = 42;
    const cy = 35;
    const radius = 33;
    const bodyRadius = radius - 11;
    const arcColour = disabled ? palette.outlineBright : emphasised ? palette.text : palette.textDim;
    const p = pointOn(cx, cy, bodyRadius * 0.35, angle);
    const q = pointOn(cx, cy, bodyRadius * 0.78, angle);

    drawing = (
      <svg viewBox="0 0 84 92" className="block h-full w-full overflow-visible" aria-hidden="true">
        <ValueArc gradientId={`${id}-arc`} cx={cx} cy={cy} radius={radius - 3} thickness={4.5} angle={angle} bipolar={!!def.bipolar} colour={arcColour} glowAlpha={0} emphasised={emphasised} />
        {focusRing && <circle cx={cx} cy={cy} r={radius + 1} fill="none" stroke={palette.accent} strokeWidth={2} />}
        <KnobBody id={id} cx={cx} cy={cy} radius={bodyRadius} emphasised={emphasised} />
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={disabled ? palette.textFaint : palette.text} strokeWidth={2.6} strokeLinecap="round" />
        <text x={42} y={83} dy="0.35em" textAnchor="middle" fontSize={fontSize(12.5)} fontWeight={700} fill={emphasised ? palette.text : palette.textDim}>
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
