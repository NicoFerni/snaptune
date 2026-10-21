// One timeline for the sound and the picture: the beat grid, the melody the test voice sings, and
// what the plugin is set to at each moment. scripts/render-audio.ts renders the soundtrack from it
// and the video animates the plugin window from the same functions, so the two can't drift apart.

import { DEFAULT_PARAMS, KNOBS, PRESETS, fromProportion, toProportion, type Params } from "../../website/components/demo/model.ts";

export const FPS = 60;
export const SAMPLE_RATE = 48000;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const BPM = 150;
export const BEAT = 60 / BPM; // 0.4 s
export const BAR = 4 * BEAT; // 1.6 s
export const BARS = 18;
export const DURATION = BARS * BAR + 0.8; // the last bar rings out
export const DURATION_FRAMES = Math.round(DURATION * FPS);

/** Seconds at a bar (and beat within it). */
export const at = (bar: number, beat = 0) => bar * BAR + beat * BEAT;

//==============================================================================
// Harmony: A minor, one chord a bar. Phrase A sits on Am F, phrase B on C G.

export const CHORDS = [
  { root: 33, pad: [45, 52, 57, 60], bell: [69, 72, 76] }, // Am
  { root: 29, pad: [41, 53, 57, 60], bell: [65, 69, 72] }, // F
  { root: 36, pad: [48, 52, 55, 60], bell: [67, 72, 76] }, // C
  { root: 31, pad: [43, 50, 55, 59], bell: [67, 71, 74] }, // G
];

const PROGRESSION = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 0];

export const chordAt = (bar: number) => CHORDS[PROGRESSION[Math.min(Math.max(bar, 0), PROGRESSION.length - 1)]];

//==============================================================================
// The beat: half-time, drums from the drop (bar 4) to bar 15, one last hit on bar 16. The four bars
// before the drop are the problem: the take as sung, with no plugin on it.

export const DROP_BAR = 4;
export const END_BAR = 16;
export const DRUM_BARS = [DROP_BAR, END_BAR - 1];

/** 808 hits (with the kick on top): chord root, on 1 and the and-of-3, plus the and-of-2 every other bar. */
export function bassHits() {
  const hits: { t: number; note: number; v: number }[] = [];

  for (let bar = DRUM_BARS[0]; bar <= DRUM_BARS[1]; ++bar) {
    const pattern = bar % 2 === 0 ? [0, 10] : [0, 6, 10];
    for (const s of pattern) hits.push({ t: at(bar, s / 4), note: chordAt(bar).root, v: s === 0 ? 1 : 0.85 });
  }

  hits.push({ t: at(END_BAR), note: chordAt(END_BAR).root, v: 1 });
  return hits;
}

//==============================================================================
// The melody: the website's test voice (a synthesized singer), off-key on purpose. Cents are how far
// each note is sung from the true pitch; a scoop starts that many cents below and slides up.

type Vowel = "a" | "o" | "u" | "e";
type SungNote = { beat: number; beats: number; note: number; cents: number; vibrato?: number; onset?: number; scoop?: number; vowel: Vowel };

// Over Am | F.
const phraseA: SungNote[] = [
  { beat: 0, beats: 0.9, note: 57, cents: 35, vowel: "a" },
  { beat: 1, beats: 0.9, note: 60, cents: -30, vowel: "o" },
  { beat: 2, beats: 1.8, note: 64, cents: 22, scoop: -200, vibrato: 25, onset: 0.3, vowel: "a" },
  { beat: 4, beats: 0.45, note: 62, cents: 25, vowel: "e" },
  { beat: 4.5, beats: 0.45, note: 60, cents: -25, vowel: "o" },
  { beat: 5, beats: 2.5, note: 57, cents: -40, vibrato: 30, onset: 0.45, vowel: "a" },
];

// The same line with more vibrato, for the natural setting. The E stays close enough to its pitch
// that the vibrato never reaches the F above (the tuner would switch notes).
const phraseA2: SungNote[] = phraseA.map((n) => (n.vibrato ? { ...n, vibrato: 38, onset: 0.2, cents: n.note === 64 ? 10 : n.cents } : n));

// Over C | G.
const phraseB: SungNote[] = [
  { beat: 0, beats: 0.45, note: 64, cents: -30, vowel: "e" },
  { beat: 0.5, beats: 0.45, note: 67, cents: 20, vowel: "a" },
  { beat: 1, beats: 1.4, note: 64, cents: 22, scoop: -200, vibrato: 20, onset: 0.3, vowel: "a" },
  { beat: 2.5, beats: 0.45, note: 62, cents: -20, vowel: "o" },
  { beat: 3, beats: 0.9, note: 60, cents: 25, vowel: "a" },
  { beat: 4, beats: 0.9, note: 59, cents: -35, vowel: "e" },
  { beat: 5, beats: 0.45, note: 62, cents: 30, vowel: "o" },
  { beat: 5.5, beats: 2, note: 55, cents: -40, vibrato: 35, onset: 0.25, vowel: "u" },
];

// Ends on the fifth, to resolve onto the last A.
const phraseB2: SungNote[] = [...phraseB.slice(0, -1), { beat: 5.5, beats: 2, note: 59, cents: 25, vibrato: 30, onset: 0.3, vowel: "a" }];

const finalNote: SungNote[] = [{ beat: 0, beats: 3.4, note: 57, cents: -30, vibrato: 35, onset: 0.35, vowel: "a" }];

const phrases: [number, SungNote[]][] = [
  [0, phraseA], // as sung
  [2, phraseB],
  [4, phraseA], // hard tune, then live mode
  [6, phraseB],
  [8, phraseA],
  [10, phraseB], // turned to natural over its last note
  [12, phraseA2], // natural
  [14, phraseB2],
  [16, finalNote],
];

export const MELODY = phrases.flatMap(([bar, notes]) =>
  notes.map((n) => ({ ...n, start: at(bar, n.beat), end: at(bar, n.beat + n.beats) })),
);

const midiToHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

/** Pitch (Hz) and vowel the voice sings at time t, or null between notes. Same shape as the
    worklet's TestVoice.noteAt, so the voice model can sing this melody. */
export function sungAt(t: number) {
  for (const n of MELODY) {
    if (t >= n.start && t < n.end) {
      const age = t - n.start;
      const onset = n.onset ?? 0;
      let cents = n.cents + (n.vibrato ?? 0) * Math.min(1, Math.max(0, (age - onset) / 0.4)) * Math.sin(2 * Math.PI * 5.5 * Math.max(0, age - onset));
      if (n.scoop) cents += n.scoop * Math.max(0, 1 - age / 0.15);
      return { hz: midiToHz(n.note + cents / 100), vowel: n.vowel };
    }
  }

  return null;
}

//==============================================================================
// The plugin's settings over time. Changes happen in the rests between phrases, or over a held note
// when the point is to hear the change.

/** You hear the voice as sung until here, then through SnapTune. */
export const SNAP = at(DROP_BAR);
const BYPASS_OFF = at(DROP_BAR - 1, 3.75); // in the rest before the drop

export const bypassAt = (t: number) => t < BYPASS_OFF;

/** Studio to Live, in the rest before bar 6. */
export const LIVE_SWITCH = at(5, 3.7);

const HARD = PRESETS[0].values;
const NATURAL = PRESETS[2].values;

type KnobValues = typeof HARD;

/** Knob moves: from one set of values to the next over [start, end]. */
const MOVES: { start: number; end: number; to: KnobValues }[] = [
  { start: at(11, 1.9), end: at(11, 3.4), to: NATURAL }, // over the held G3, so you hear the vibrato come back
];

/** Turned like a hand turns it: eased, in the knob's own (skewed) range. */
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function turn(id: keyof KnobValues, from: number, to: number, x: number) {
  const def = KNOBS[id];
  return fromProportion(def, toProportion(def, from) + (toProportion(def, to) - toProportion(def, from)) * ease(x));
}

export const BASE: Params = { ...DEFAULT_PARAMS, ...HARD, key: 9, scale: 2, voice: 1, mode: 0 }; // A minor, Alto / Tenor

export function paramsAt(t: number): Params {
  let knobs: KnobValues = HARD;

  for (const m of MOVES) {
    if (t < m.start) break;
    const x = (t - m.start) / (m.end - m.start);
    const from = knobs;
    knobs = x >= 1 ? m.to : (Object.fromEntries(Object.keys(from).map((k) => [k, turn(k as keyof KnobValues, from[k as keyof KnobValues], m.to[k as keyof KnobValues], x)])) as KnobValues);
  }

  return { ...BASE, ...knobs, mode: t < LIVE_SWITCH ? 0 : 1 };
}
