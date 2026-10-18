"use client";

import { useEffect, useRef, useState } from "react";

type Side = "dry" | "tuned";

// Plays the dry and tuned files together and switches which one you hear, so the comparison is
// the same moment of the same take.
export function ABPlayer({ preset, note, dry, tuned }: { preset: string; note: string; dry: string; tuned: string }) {
  const dryRef = useRef<HTMLAudioElement>(null);
  const tunedRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [side, setSide] = useState<Side>("dry");

  useEffect(() => {
    const d = dryRef.current;
    const t = tunedRef.current;
    if (!d || !t) return;
    t.currentTime = d.currentTime;
    d.muted = side !== "dry";
    t.muted = side !== "tuned";
  }, [side]);

  async function toggle() {
    const d = dryRef.current;
    const t = tunedRef.current;
    if (!d || !t) return;
    if (playing) {
      d.pause();
      t.pause();
      setPlaying(false);
      return;
    }
    t.currentTime = d.currentTime;
    try {
      await Promise.all([d.play(), t.play()]);
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${preset}` : `Play ${preset}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-bright bg-panel-2 text-ink transition hover:border-teal"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13l10.5-6.5z" />}
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{preset}</p>
        <p className="text-sm text-muted">{note}</p>
      </div>
      <div className="flex rounded-lg border border-line bg-bg p-1 text-sm font-semibold" role="group" aria-label="Choose what you hear">
        <button
          type="button"
          onClick={() => setSide("dry")}
          aria-pressed={side === "dry"}
          className={`rounded-md px-3.5 py-2.5 transition sm:py-1.5 ${side === "dry" ? "bg-coral text-bg" : "text-muted hover:text-ink"}`}
        >
          As sung
        </button>
        <button
          type="button"
          onClick={() => setSide("tuned")}
          aria-pressed={side === "tuned"}
          className={`rounded-md px-3.5 py-2.5 transition sm:py-1.5 ${side === "tuned" ? "bg-teal text-bg" : "text-muted hover:text-ink"}`}
        >
          SnapTune
        </button>
      </div>
      <audio ref={dryRef} src={dry} preload="none" onEnded={() => setPlaying(false)} />
      <audio ref={tunedRef} src={tuned} preload="none" muted />
    </div>
  );
}
