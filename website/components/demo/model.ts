// The plugin's parameters, scales and presets for the browser demo. Mirrors Source/Parameters.h,
// Source/Presets.h and Source/dsp/Scales.h; the engine in public/snaptune-worklet.js has its own copy
// of the scale tables because a worklet can't import from the app bundle.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALE_NAMES = [
  "Chromatic",
  "Major",
  "Minor",
  "Harmonic Minor",
  "Melodic Minor",
  "Major Pentatonic",
  "Minor Pentatonic",
  "Blues",
  "Dorian",
  "Phrygian",
  "Lydian",
  "Mixolydian",
  "Locrian",
  "Custom",
];

export const CUSTOM_SCALE = SCALE_NAMES.length - 1;

const scaleDegrees = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 8, 11],
  [0, 2, 3, 5, 7, 9, 11],
  [0, 2, 4, 7, 9],
  [0, 3, 5, 7, 10],
  [0, 3, 5, 6, 7, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 1, 3, 5, 7, 8, 10],
  [0, 2, 4, 6, 7, 9, 11],
  [0, 2, 4, 5, 7, 9, 10],
  [0, 1, 3, 5, 6, 8, 10],
  [], // Custom: the mask comes from the per-note toggles instead.
];

const scaleIntervals = scaleDegrees.map((degrees) => degrees.reduce((mask, d) => mask | (1 << d), 0));

export const VOICE_NAMES = ["Soprano", "Alto / Tenor", "Low Male", "Instrument"];
export const MODE_NAMES = ["Studio", "Live"];

// Where the graph sits before anything is sung: the middle of the selected voice range.
export const HOME_NOTES = [69, 57, 48, 60];

export function pitchClass(note: number) {
  return ((note % 12) + 12) % 12;
}

export function maskContains(mask: number, note: number) {
  return ((mask >> pitchClass(note)) & 1) !== 0;
}

export function isSharp(pc: number) {
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

/** 12-bit pitch-class mask (bit 0 = C) of the notes a voice may be tuned to. */
export function pitchClassMask(key: number, scale: number, customMask: number) {
  if (scale === CUSTOM_SCALE) return customMask & 0x0fff;

  let mask = 0;
  for (let degree = 0; degree < 12; ++degree) if ((scaleIntervals[scale] >> degree) & 1) mask |= 1 << pitchClass(key + degree);

  return mask;
}

export function noteName(note: number) {
  return NOTE_NAMES[pitchClass(note)];
}

export function noteOctave(note: number) {
  return Math.floor(note / 12) - 1;
}

export function noteLabel(note: number) {
  return noteName(note) + noteOctave(note);
}

// "C#" would be read as "C number sign".
export function spokenNote(name: string) {
  return name.replace("#", " sharp");
}

//==============================================================================
export type KnobId = "retune" | "humanize" | "amount" | "formant" | "tracking" | "mix";

export type Params = {
  key: number;
  scale: number;
  notes: number; // custom scale mask, bit 0 = C
  retune: number;
  humanize: number;
  amount: number;
  formant: number;
  tracking: number;
  mix: number;
  voice: number;
  midi: boolean;
  mode: number; // 0 Studio, 1 Live
};

type KnobDef = {
  title: string;
  min: number;
  max: number;
  interval: number;
  skew: number;
  reset: number;
  bipolar?: boolean;
  format: (v: number) => string;
  tip: string;
};

const percent = (v: number) => `${Math.round(v)} %`;

export const KNOBS: Record<KnobId, KnobDef> = {
  retune: {
    title: "Retune Speed",
    min: 0,
    max: 400,
    interval: 0.1,
    skew: 0.4,
    reset: 20,
    format: (v) => (v < 0.5 ? "Hard" : `${Math.round(v)} ms`),
    tip: "How fast the voice is pulled onto the note. 0 ms is the hard, robotic snap; slower keeps slides and vibrato.",
  },
  humanize: {
    title: "Humanize",
    min: 0,
    max: 100,
    interval: 0.1,
    skew: 1,
    reset: 0,
    format: percent,
    tip: "Relaxes the correction on long notes so they keep their natural movement.",
  },
  amount: { title: "Amount", min: 0, max: 100, interval: 0.1, skew: 1, reset: 100, format: percent, tip: "How much of the pitch error is corrected." },
  formant: {
    title: "Formant",
    min: -5,
    max: 5,
    interval: 0.01,
    skew: 1,
    reset: 0,
    bipolar: true,
    format: (v) => {
      const rounded = Math.round(v * 10) / 10;
      return `${rounded > 0 ? "+" : ""}${(rounded === 0 ? 0 : rounded).toFixed(1)} st`;
    },
    tip: "Moves the character of the voice up (smaller) or down (bigger) without changing pitch. Studio mode only.",
  },
  tracking: {
    title: "Tracking",
    min: 0,
    max: 100,
    interval: 0.1,
    skew: 1,
    reset: 50,
    format: percent,
    tip: "Higher treats breathy or noisy singing as pitched; lower is stricter.",
  },
  mix: { title: "Mix", min: 0, max: 100, interval: 0.1, skew: 1, reset: 100, format: percent, tip: "Blend of the original and the tuned voice." },
};

export const SMALL_KNOBS: KnobId[] = ["humanize", "amount", "formant", "tracking", "mix"];

// juce::NormalisableRange with a skew factor and an interval.
export function toProportion(def: KnobDef, value: number) {
  const p = (Math.min(def.max, Math.max(def.min, value)) - def.min) / (def.max - def.min);
  return def.skew === 1 ? p : Math.pow(p, def.skew);
}

export function fromProportion(def: KnobDef, proportion: number) {
  const p = Math.min(1, Math.max(0, proportion));
  const raw = def.min + (def.max - def.min) * (def.skew === 1 ? p : Math.pow(p, 1 / def.skew));
  const snapped = def.min + def.interval * Math.round((raw - def.min) / def.interval);
  return Math.min(def.max, Math.max(def.min, Number(snapped.toFixed(4))));
}

//==============================================================================
/** Factory starting points. Key, scale and voice are left alone: those depend on the song. */
export const PRESETS: { name: string; values: Pick<Params, KnobId> }[] = [
  { name: "Hard Tune", values: { retune: 0, humanize: 0, amount: 100, formant: 0, tracking: 50, mix: 100 } },
  { name: "Melodic Trap", values: { retune: 8, humanize: 10, amount: 100, formant: 0, tracking: 50, mix: 100 } },
  { name: "Natural", values: { retune: 40, humanize: 35, amount: 100, formant: 0, tracking: 50, mix: 100 } },
  { name: "Subtle Polish", values: { retune: 90, humanize: 50, amount: 75, formant: 0, tracking: 50, mix: 100 } },
  { name: "Deep Robot", values: { retune: 0, humanize: 0, amount: 100, formant: -4, tracking: 50, mix: 100 } },
  { name: "Bright Pop", values: { retune: 15, humanize: 15, amount: 100, formant: 1.5, tracking: 50, mix: 100 } },
];

export function matchingPreset(p: Params) {
  return PRESETS.findIndex(
    ({ values: v }) =>
      Math.abs(p.retune - v.retune) < 0.05 &&
      Math.abs(p.humanize - v.humanize) < 0.05 &&
      Math.abs(p.amount - v.amount) < 0.05 &&
      Math.abs(p.formant - v.formant) < 0.005 &&
      Math.abs(p.tracking - v.tracking) < 0.05 &&
      Math.abs(p.mix - v.mix) < 0.05,
  );
}

// The demo opens on Hard Tune in C major: the effect the page is named after.
export const DEFAULT_PARAMS: Params = {
  key: 0,
  scale: 1,
  notes: 0x0fff,
  ...PRESETS[0].values,
  voice: 1,
  midi: false,
  mode: 0,
};

/** What the engine reads (EngineSettings), from the parameter values the UI shows. */
export function engineSettings(p: Params) {
  return {
    key: p.key,
    scale: p.scale,
    customMask: p.notes,
    retuneMs: p.retune,
    humanize: p.humanize * 0.01,
    amount: p.amount * 0.01,
    formantSemitones: p.formant,
    tracking: p.tracking * 0.01,
    mix: p.mix * 0.01,
    voice: p.voice,
    midiTargets: p.midi,
    referenceHz: 440,
    mode: p.mode,
  };
}

export type EngineSettings = ReturnType<typeof engineSettings>;

export const TIPS = {
  presets: "Starting points for the correction knobs. Key, scale and voice are not changed.",
  mode: "Studio: best quality, formants preserved, 46 ms (your DAW compensates it). Live: about 3 ms, for hearing yourself tuned while you record.",
  key: "The key of the song.",
  scale: "Which notes the voice may land on. Pick Chromatic if you don't know the key.",
  pills: "Lit notes are in the scale; the solid one is being tuned to right now. Click to add or remove a note (switches to Custom).",
  midi: "Tune to the notes held on the MIDI input instead of the scale. Here, hold keys on the keyboard below the window.",
  gauge: "Sage: what you sang. Gold: what comes out. Centre: the note it is tuning to.",
  graph: "Drag to move the note range (it then stays put). Double-click to follow the singer again.",
  voice: "The range the pitch detector listens in. Pick Low Male for deep voices.",
};
