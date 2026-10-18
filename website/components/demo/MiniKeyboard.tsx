"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { NOTE_NAMES, isSharp, spokenNote } from "./model";

// Stands in for the MIDI track a DAW would send: one octave to hold notes on, plus the usual
// typing-keyboard layout (A = C, W = C#, ... J = B).

const LETTERS = "awsedftgyhuj";
const BASE_NOTE = 60;
const WHITE = [0, 2, 4, 5, 7, 9, 11];

export function MiniKeyboard({ held, onNoteOn, onNoteOff }: { held: number; onNoteOn: (note: number) => void; onNoteOff: (note: number) => void }) {
  const pointers = useRef(new Map<number, number>());

  useEffect(() => {
    const typing = (e: KeyboardEvent) =>
      e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof HTMLElement && e.target.closest("input, select, textarea, [contenteditable]"));

    const down = (e: KeyboardEvent) => {
      const pc = LETTERS.indexOf(e.key.toLowerCase());
      if (pc < 0 || typing(e)) return;
      e.preventDefault();
      if (!e.repeat) onNoteOn(BASE_NOTE + pc);
    };

    const up = (e: KeyboardEvent) => {
      const pc = LETTERS.indexOf(e.key.toLowerCase());
      if (pc >= 0) onNoteOff(BASE_NOTE + pc);
    };

    const releaseAll = () => {
      for (let pc = 0; pc < 12; ++pc) onNoteOff(BASE_NOTE + pc);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [onNoteOn, onNoteOff]);

  function press(e: PointerEvent<HTMLButtonElement>, pc: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    pointers.current.set(e.pointerId, BASE_NOTE + pc);
    onNoteOn(BASE_NOTE + pc);
  }

  function release(e: PointerEvent<HTMLButtonElement>) {
    const note = pointers.current.get(e.pointerId);
    if (note === undefined) return;
    pointers.current.delete(e.pointerId);
    if (![...pointers.current.values()].includes(note)) onNoteOff(note);
  }

  const key = (pc: number) => {
    const down = ((held >> pc) & 1) !== 0;
    return (
      <button
        key={pc}
        type="button"
        aria-label={`Hold ${spokenNote(NOTE_NAMES[pc])}`}
        aria-pressed={down}
        className="st-pkey"
        data-black={isSharp(pc) || undefined}
        style={isSharp(pc) ? { left: `calc(${(WHITE.indexOf(pc - 1) + 1) * (100 / 7)}% - 13px)` } : undefined}
        onPointerDown={(e) => press(e, pc)}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && onNoteOn(BASE_NOTE + pc)}
        onKeyUp={(e) => (e.key === " " || e.key === "Enter") && onNoteOff(BASE_NOTE + pc)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span aria-hidden="true">{LETTERS[pc].toUpperCase()}</span>
      </button>
    );
  };

  return (
    <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-4 text-center sm:mt-8">
      <p className="text-[15px] text-muted">
        <span className="font-semibold text-violet">MIDI notes is on.</span> Hold a key: the voice goes to that note, in whatever octave
        it&apos;s in, instead of the nearest one in the scale. Your computer keyboard plays it too.
      </p>
      <div className="st-piano" role="group" aria-label="Notes to tune to">
        {WHITE.map(key)}
        {[1, 3, 6, 8, 10].map(key)}
      </div>
    </div>
  );
}
