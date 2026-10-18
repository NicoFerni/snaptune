"use client";

import type { CSSProperties, ReactNode } from "react";
import { MODE_NAMES, NOTE_NAMES, isSharp, spokenNote } from "./model";
import { palette } from "./palette";

// The plugin's smaller controls (SnapLookAndFeel, ModeSwitch, NotePills), as HTML. Colours and sizes
// are in demo.css.

type Positioned = { className?: string; style?: CSSProperties };

/** The SnapTune mark: a wave that snaps onto steps (drawLogo). */
export function PluginLogo({ className, style }: Positioned) {
  // box = bounds.reduced (20%), 18 x 18 inside a 30 x 30 tile.
  const at = (x: number, y: number) => `${6 + 18 * x} ${6 + 18 * y}`;

  return (
    <svg viewBox="0 0 30 30" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="st-logo" x1={0} y1={0} x2={1} y2={1}>
          <stop offset={0} stopColor={palette.accent} />
          <stop offset={1} stopColor={palette.accentDeep} />
        </linearGradient>
      </defs>
      <rect width={30} height={30} rx={8.1} fill="url(#st-logo)" />
      <path
        d={`M${at(0, 0.62)}C${at(0.1, 0.05)} ${at(0.24, 1.05)} ${at(0.38, 0.62)}L${at(0.6, 0.62)}L${at(0.6, 0.3)}L${at(1, 0.3)}`}
        fill="none"
        stroke={palette.background}
        strokeWidth={2.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A native select drawn like the plugin's combo boxes. */
export function Combo({
  label,
  value,
  onChange,
  tip,
  children,
  className = "",
  style,
}: Positioned & { label: string; value: number; onChange: (value: number) => void; tip: string; children: ReactNode }) {
  return (
    <div className={`st-combo ${className}`} style={style} data-tip={tip}>
      <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {children}
      </select>
      <svg viewBox="0 0 12 8" aria-hidden="true">
        <path d="M2 2l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function ModeSwitch({ mode, onChange, tip, className = "", style }: Positioned & { mode: number; onChange: (mode: number) => void; tip: string }) {
  return (
    <div className={`st-mode ${className}`} style={style} role="group" aria-label="Latency mode" data-tip={tip}>
      {MODE_NAMES.map((name, i) => (
        <button key={name} type="button" aria-pressed={mode === i} onClick={() => onChange(i)}>
          {name}
        </button>
      ))}
    </div>
  );
}

export function MidiToggle({ on, onChange, tip, className = "", style }: Positioned & { on: boolean; onChange: (on: boolean) => void; tip: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`st-toggle ${className}`} style={style} onClick={() => onChange(!on)} data-tip={tip}>
      <span className="st-toggle-pill" aria-hidden="true" />
      MIDI notes
    </button>
  );
}

/** Twelve note buttons: lit = in the scale, solid = being tuned to, violet dot = held MIDI note. */
export function NotePills({
  allowed,
  held,
  target,
  onToggle,
  tip,
  className = "",
  style,
}: Positioned & { allowed: number; held: number; target: number; onToggle: (pc: number) => void; tip: string }) {
  return (
    <div className={`st-pills ${className}`} style={style} role="group" aria-label="Scale notes">
      {NOTE_NAMES.map((name, pc) => {
        const inScale = ((allowed >> pc) & 1) !== 0;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={inScale}
            aria-label={spokenNote(name)}
            data-sharp={isSharp(pc) || undefined}
            data-target={pc === target || undefined}
            data-tip={tip}
            onClick={() => onToggle(pc)}
          >
            {name}
            {((held >> pc) & 1) !== 0 && <span className="st-held" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
