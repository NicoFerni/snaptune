// Renders the promo's soundtrack, and the pitch frames the plugin window in the video draws.
//
// The website's test voice (a synthesized singer) sings the melody in src/timeline.ts, SnapTune's
// engine tunes it with the settings the timeline gives for each moment, and a small trap beat plays
// under it. The engine is website/public/snaptune-worklet.js, the line-by-line port of Source/dsp
// that the website's demo runs.
//
//   npm run audio
//
// Writes public/soundtrack.wav (loudness-normalized with ffmpeg) and src/frames.json.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineSettings } from "../../website/components/demo/model.ts";
import { AutoTuneEngine, TestVoice } from "../../website/public/snaptune-worklet.js";
import { BAR, BARS, BEAT, DROP_BAR, DRUM_BARS, DURATION, END_BAR, SAMPLE_RATE, SNAP, at, bassHits, bypassAt, chordAt, paramsAt, sungAt } from "../src/timeline.ts";

const sr = SAMPLE_RATE;
const length = Math.round(DURATION * sr);
const root = join(import.meta.dirname, "..");

type Stereo = [Float32Array, Float32Array];

const samples = (seconds: number) => Math.round(seconds * sr);
const midiToHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
const dbToGain = (db: number) => Math.pow(10, db / 20);
const mono = () => new Float32Array(length);
const stereo = (): Stereo => [mono(), mono()];

/** Deterministic white noise in [-1, 1), so every render is the same. */
function noise(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** RBJ cookbook biquad, transposed direct form II. */
class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  z1 = 0;
  z2 = 0;
  readonly type: "lowpass" | "highpass" | "bandpass" | "peaking";
  readonly gainDb: number;

  constructor(type: "lowpass" | "highpass" | "bandpass" | "peaking", frequency: number, q = Math.SQRT1_2, gainDb = 0) {
    this.type = type;
    this.gainDb = gainDb;
    this.set(frequency, q);
  }

  set(frequency: number, q = Math.SQRT1_2) {
    const w = (2 * Math.PI * Math.min(frequency, 0.45 * sr)) / sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const A = Math.pow(10, this.gainDb / 40);
    const a0 = this.type === "peaking" ? 1 + alpha / A : 1 + alpha;
    let b: [number, number, number];

    if (this.type === "lowpass") b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (this.type === "highpass") b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else if (this.type === "bandpass") b = [alpha, 0, -alpha];
    else b = [1 + alpha * A, -2 * cos, 1 - alpha * A];

    [this.b0, this.b1, this.b2] = b.map((v) => v / a0);
    this.a1 = (-2 * cos) / a0;
    this.a2 = (this.type === "peaking" ? 1 - alpha / A : 1 - alpha) / a0;
  }

  process(x: number) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  run(buffer: Float32Array) {
    for (let i = 0; i < buffer.length; ++i) buffer[i] = this.process(buffer[i]);
    return buffer;
  }
}

function rms(buffer: Float32Array, from = 0, to = buffer.length) {
  let sum = 0;
  for (let i = from; i < to; ++i) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

function peak(buffer: Float32Array) {
  let p = 0;
  for (const v of buffer) p = Math.max(p, Math.abs(v));
  return p;
}

/** Scales a stem so its level (RMS over a region, or peak) lands on `db` dBFS. */
function level(stem: Float32Array | Stereo, db: number, measure: "rms" | "peak", from = 0, to = length) {
  const channels = Array.isArray(stem) ? stem : [stem];
  const current = Math.max(...channels.map((c) => (measure === "rms" ? rms(c, from, to) : peak(c))));
  const gain = dbToGain(db) / Math.max(current, 1e-9);
  for (const c of channels) for (let i = 0; i < c.length; ++i) c[i] *= gain;
}

//==============================================================================
// The voice, through SnapTune: what it measured and put out drives the lead and the window.

function renderVoice() {
  // The worklet's voice model, singing the promo's melody instead of its own 11-second loop.
  TestVoice.noteAt = sungAt;
  const voice = new TestVoice(sr);
  voice.loopLength = Infinity;

  const engine = new AutoTuneEngine();
  engine.setSettings(engineSettings(paramsAt(0)));
  engine.prepare(sr, 1);

  const block = 128;
  const buffer = new Float32Array(block);
  const scratch = new Float32Array(2048 * 4);
  const out = mono();
  const frames: ([number, number, number] | 0)[] = [];
  const round = (v: number) => Math.round(v * 1000) / 1000;
  let applied = "";

  // Past the end by the Studio latency, so the last output reaches the file.
  for (let start = 0; start < length + 4096; start += block) {
    const t = start / sr;
    const settings = engineSettings(paramsAt(t));
    const key = JSON.stringify(settings);

    if (key !== applied) {
      engine.setSettings(settings);
      applied = key;
    }

    if (start < length) voice.render(buffer, block);
    else buffer.fill(0);

    engine.process([buffer], 1, 0, block, bypassAt(t));

    // Undo the engine's delay, as a DAW's delay compensation does, so the voice sits on the beat.
    // Studio and Live switch in a rest, where the jump in delay has nothing to cut.
    const latency = engine.getLatencySamples();

    for (let i = 0; i < block; ++i) {
      const input = start + i - latency;
      if (input >= 0 && input < length) out[input] = buffer[i];
    }

    const count = engine.popFrames(scratch, 2048);

    for (let i = 0; i < count; ++i) {
      const [input, output, target, voiced] = scratch.subarray(i * 4, i * 4 + 4);
      frames.push(voiced > 0.5 ? [round(input), round(output), target] : 0);
    }
  }

  const fps = engine.getFramesPerSecond();
  return { voice: out, frames: frames.slice(0, Math.ceil(DURATION * fps)), fps };
}

//==============================================================================
// The beat: 150 BPM, half-time. Bars 0-1 are the intro (pad, filtered hats, the voice as sung),
// bar 2 drops, bar 14 is the last hit, bar 15 rings out.

const step = (bar: number, sixteenth: number) => at(bar, sixteenth / 4);

/** 808: a sine that drops from two octaves up into the note, driven so its harmonics carry it on
    small speakers. Monophonic: each hit cuts the one before. */
function render808(hits: ReturnType<typeof bassHits>) {
  const out = mono();

  hits.forEach((h, k) => {
    const start = samples(h.t);
    const end = Math.min(length, k + 1 < hits.length ? samples(hits[k + 1].t) : length, start + samples(1.6));
    const f0 = midiToHz(h.note + 12);
    let phase = 0;

    for (let i = start; i < end; ++i) {
      const t = (i - start) / sr;
      phase += (f0 * (1 + 3 * Math.exp(-t / 0.018))) / sr;
      const env = Math.min(1, t / 0.0015) * Math.exp(-t / 0.6) * Math.min(1, (end - i) / (0.006 * sr));
      out[i] = h.v * env * Math.sin(2 * Math.PI * phase);
    }
  });

  for (let i = 0; i < length; ++i) out[i] = Math.tanh(2.2 * out[i]) / Math.tanh(2.2);
  return new Biquad("highpass", 30).run(out);
}

function renderClaps(times: number[]) {
  const out = stereo();
  const rnd = [noise(11), noise(12)];

  for (const time of times) {
    const start = samples(time);
    const end = Math.min(length, start + samples(0.5));

    for (let i = start; i < end; ++i) {
      const t = (i - start) / sr;
      let env = 0.75 * Math.exp(-Math.max(0, t - 0.026) / 0.12) * (t >= 0.026 ? 1 : 0);
      for (let k = 0; k < 3; ++k) if (t >= k * 0.0095) env += Math.exp(-(t - k * 0.0095) / 0.0032);
      out[0][i] += env * rnd[0]();
      out[1][i] += env * rnd[1]();
    }
  }

  for (const c of out) {
    new Biquad("bandpass", 1250, 0.9).run(c);
    new Biquad("highpass", 450).run(c);
  }

  return out;
}

function hatTimes() {
  const hats: { t: number; v: number; open?: boolean }[] = [];

  // Hats come in halfway through the intro, quietly, and build to the drop.
  for (let bar = DROP_BAR - 2; bar <= DRUM_BARS[1]; ++bar) {
    const intro = bar < DRUM_BARS[0];

    for (let s = 0; s < 16; s += 2) {
      // A gap before the drop.
      if (bar === DRUM_BARS[0] - 1 && s >= 12) continue;
      const rollAhead = !intro && bar % 2 === 1 && s >= 12;
      if (rollAhead) continue;
      const open = !intro && bar % 4 === 2 && s === 14;
      hats.push({ t: step(bar, s), v: (s % 4 === 0 ? 1 : 0.7) * (intro ? 0.55 : 1), open });
    }

    // Rolls at the end of each two-bar phrase: sixteenths, or sixteenth triplets every other time.
    if (!intro && bar % 2 === 1) {
      if (bar % 4 === 1) for (let k = 0; k < 6; ++k) hats.push({ t: at(bar, 3 + k / 6), v: 0.55 + 0.07 * k });
      else for (let s = 12; s < 16; ++s) hats.push({ t: step(bar, s), v: 0.6 + 0.1 * (s - 12) });
    }
  }

  return hats;
}

/** 808-style hats: six detuned square waves plus noise, high-passed. */
function renderHats(hits: ReturnType<typeof hatTimes>) {
  const out = mono();
  const rnd = noise(21);
  const ratios = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 2.4);

  for (const h of hits) {
    const start = samples(h.t);
    const decay = h.open ? 0.2 : 0.03;
    const end = Math.min(length, start + samples(decay * 6));

    for (let i = start; i < end; ++i) {
      const t = (i - start) / sr;
      let metal = 0;
      for (const f of ratios) metal += (t * f) % 1 < 0.5 ? 1 : -1;
      out[i] += h.v * Math.exp(-t / decay) * (0.55 * rnd() + 0.08 * metal);
    }
  }

  new Biquad("highpass", 7200, 0.9).run(out);
  return new Biquad("highpass", 7200, 0.9).run(out);
}

/** Short clicks on the downbeats, so the kick cuts through. */
function renderClicks(hits: ReturnType<typeof bassHits>) {
  const out = mono();
  const rnd = noise(31);

  for (const h of hits) {
    const start = samples(h.t);
    for (let i = start; i < Math.min(length, start + samples(0.02)); ++i) out[i] += h.v * Math.exp(-(i - start) / (0.0025 * sr)) * rnd();
  }

  return new Biquad("highpass", 1800).run(out);
}

//==============================================================================
// Harmony.

/** Band-limited saw (PolyBLEP). */
function polyBlep(phase: number, dt: number) {
  if (phase < dt) {
    const t = phase / dt;
    return t + t - t * t - 1;
  }
  if (phase > 1 - dt) {
    const t = (phase - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** A soft pad: three detuned saws per note, spread left to right, through a low-pass that opens over
    the intro and closes over the last bars. */
function renderPad() {
  const out = stereo();
  const chords: { start: number; end: number; notes: number[] }[] = [];

  for (let bar = 0; bar < BARS; ++bar) {
    const notes = chordAt(bar).pad;
    const last = chords[chords.length - 1];
    if (last && last.notes.join() === notes.join()) last.end = at(bar + 1);
    else chords.push({ start: at(bar), end: at(bar + 1), notes });
  }

  const detune = [-9, 0, 9];
  const pan = [0.2, 0.5, 0.8];

  for (const chord of chords) {
    const start = samples(chord.start);
    const end = Math.min(length, samples(chord.end + 0.45));

    for (const note of chord.notes) {
      for (let v = 0; v < 3; ++v) {
        const f = midiToHz(note + detune[v] / 100);
        const dt = f / sr;
        let phase = (note * 0.37 + v * 0.29) % 1;
        const gl = Math.cos((pan[v] * Math.PI) / 2);
        const gr = Math.sin((pan[v] * Math.PI) / 2);

        for (let i = start; i < end; ++i) {
          const t = (i - start) / sr;
          const release = Math.max(0, (i - samples(chord.end)) / sr);
          const env = (1 - Math.exp(-t / 0.06)) * Math.exp(-release / 0.12);
          phase += dt;
          if (phase >= 1) phase -= 1;
          const saw = (2 * phase - 1 - polyBlep(phase, dt)) * env;
          out[0][i] += gl * saw;
          out[1][i] += gr * saw;
        }
      }
    }
  }

  // Cutoff: 300 Hz rising to 1.6 kHz over the intro, then down to 500 Hz over the outro.
  const cutoffAt = (t: number) => {
    if (t < SNAP) return 300 * Math.pow(1600 / 300, Math.pow(t / SNAP, 1.6));
    if (t < at(END_BAR)) return 1600;
    return 1600 * Math.pow(500 / 1600, Math.min(1, (t - at(END_BAR)) / (2 * BAR)));
  };

  for (const c of out) {
    const lp = new Biquad("lowpass", 300, 0.9);
    const hp = new Biquad("highpass", 140);
    for (let i = 0; i < length; ++i) {
      if (i % 32 === 0) lp.set(cutoffAt(i / sr), 0.9);
      c[i] = hp.process(lp.process(c[i]));
    }
  }

  return out;
}

/** A plucked FM keyboard playing the chords in eighths, an octave above the voice. */
function renderPluck() {
  const out = stereo();
  const pattern = [0, 2, 1, 2, 0, 2, 1, 2];

  for (let bar = DRUM_BARS[0]; bar <= DRUM_BARS[1]; ++bar) {
    const notes = chordAt(bar).bell;

    for (let k = 0; k < 8; ++k) {
      const note = notes[pattern[k]] + (k === 4 ? 12 : 0);
      const start = samples(at(bar, k / 2));
      const end = Math.min(length, start + samples(1.4));
      const f = midiToHz(note);
      const velocity = k % 2 === 0 ? 1 : 0.7;
      const right = k % 2 === 0 ? 0.35 : 0.65;

      for (let i = start; i < end; ++i) {
        const t = (i - start) / sr;
        const index = 2.2 * Math.exp(-t / 0.07) + 0.25;
        const env = Math.min(1, t / 0.002) * Math.exp(-t / 0.32) * velocity;
        const y = env * Math.sin(2 * Math.PI * f * t + index * Math.sin(2 * Math.PI * f * t));
        out[0][i] += (1 - right) * y;
        out[1][i] += right * y;
      }
    }
  }

  return out;
}

//==============================================================================
// Transitions.

/** Noise rising into the drop, through a band-pass that sweeps up. */
function renderRiser(from: number, to: number) {
  const out = stereo();
  const rnd = [noise(41), noise(42)];
  const bp = [new Biquad("bandpass", 400, 2.2), new Biquad("bandpass", 400, 2.2)];
  const start = samples(from);
  const end = samples(to) - samples(0.012);

  for (let i = start; i < end; ++i) {
    const x = (i - start) / (end - start);
    if (i % 32 === 0) for (const f of bp) f.set(400 * Math.pow(7000 / 400, x), 2.2);
    const env = x * x * Math.min(1, (end - i) / (0.004 * sr));
    out[0][i] = env * bp[0].process(rnd[0]());
    out[1][i] = env * bp[1].process(rnd[1]());
  }

  return out;
}

/** A low boom and a burst of noise, for the drop and the end card. */
function renderImpact(time: number, gain: number, into: Stereo) {
  const rnd = [noise(51), noise(52)];
  const lp = [new Biquad("lowpass", 2600), new Biquad("lowpass", 2600)];
  const start = samples(time);
  let phase = 0;

  for (let i = start; i < Math.min(length, start + samples(2)); ++i) {
    const t = (i - start) / sr;
    phase += (38 + 52 * Math.exp(-t / 0.09)) / sr;
    const boom = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.55) * Math.min(1, t / 0.002);
    for (let c = 0; c < 2; ++c) into[c][i] += gain * (boom + 0.35 * Math.exp(-t / 0.25) * lp[c].process(rnd[c]()));
  }
}

//==============================================================================
// Effects.

/** Freeverb (Jezar's tunings, scaled to the sample rate). Returns the wet signal only. */
function reverb(input: Stereo, roomSize = 0.82, damping = 0.35) {
  const scale = sr / 44100;
  const combTunings = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const allpassTunings = [556, 441, 341, 225];
  const feedback = 0.28 * roomSize + 0.7;
  const damp = 0.4 * damping;
  const out = stereo();

  for (let c = 0; c < 2; ++c) {
    const spread = c === 0 ? 0 : 23;
    const combs = combTunings.map((n) => ({ buffer: new Float32Array(Math.round((n + spread) * scale)), index: 0, store: 0 }));
    const allpasses = allpassTunings.map((n) => ({ buffer: new Float32Array(Math.round((n + spread) * scale)), index: 0 }));

    for (let i = 0; i < length; ++i) {
      const x = (input[0][i] + input[1][i]) * 0.015;
      let y = 0;

      for (const comb of combs) {
        const v = comb.buffer[comb.index];
        comb.store = v * (1 - damp) + comb.store * damp;
        comb.buffer[comb.index] = x + comb.store * feedback;
        if (++comb.index >= comb.buffer.length) comb.index = 0;
        y += v;
      }

      for (const ap of allpasses) {
        const v = ap.buffer[ap.index];
        ap.buffer[ap.index] = y + v * 0.5;
        if (++ap.index >= ap.buffer.length) ap.index = 0;
        y = v - y;
      }

      out[c][i] = y;
    }
  }

  return out;
}

/** Ping-pong delay with a darkening feedback path. Wet only. */
function pingPong(input: Float32Array, seconds: number, feedback: number) {
  const out = stereo();
  const n = samples(seconds);
  const lp = [new Biquad("lowpass", 3200), new Biquad("lowpass", 3200)];

  for (let i = n; i < length; ++i) {
    // Left repeats the input; right repeats the left; left repeats the right.
    out[0][i] = lp[0].process(input[i - n] + feedback * out[1][i - n]);
    out[1][i] = lp[1].process(feedback * out[0][i - n]);
  }

  return out;
}

/** Gain that dips after each 808 hit, so the pad and keys breathe with the kick. */
function duckCurve(hits: ReturnType<typeof bassHits>, depth: number) {
  const curve = new Float32Array(length).fill(1);

  for (const h of hits) {
    const start = samples(h.t);
    for (let i = start; i < Math.min(length, start + samples(0.6)); ++i) {
      const t = (i - start) / sr;
      curve[i] = Math.min(curve[i], 1 - depth * Math.min(1, t / 0.004) * Math.exp(-t / 0.14));
    }
  }

  return curve;
}

//==============================================================================

/** The lead: three detuned saws spread left to right, following the engine's output pitch frame by
    frame and gated by whether the voice was sung there. Before the drop the output is the input, so
    you hear the take off-key; after it, snapped to the note. A low-pass opens on each note's attack
    and settles, like a plucked string, and a quiet octave above gives it some air. */
function renderLead(frames: ([number, number, number] | 0)[], fps: number): Stereo {
  const out = stereo();
  const voices = [
    { cents: -11, pan: 0.15 },
    { cents: 0, pan: 0.5 },
    { cents: 11, pan: 0.85 },
  ].map((v, k) => ({ ...v, phase: k * 0.31, gl: Math.cos((v.pan * Math.PI) / 2), gr: Math.sin((v.pan * Math.PI) / 2) }));
  const lp = [new Biquad("lowpass", 2000, 0.9), new Biquad("lowpass", 2000, 0.9)];
  let air = 0;
  let pitch = 57;
  let gate = 0;
  let sinceOnset = 1;
  let wasOn = false;

  for (let i = 0; i < length; ++i) {
    const position = (i / sr) * fps;
    const k = Math.floor(position);
    const a = frames[k];
    const b = frames[k + 1];
    const on = Array.isArray(a);

    if (on) pitch = Array.isArray(b) ? a[1] + (b[1] - a[1]) * (position - k) : a[1];
    if (on && !wasOn && gate < 0.3) sinceOnset = 0;
    wasOn = on;
    sinceOnset += 1 / sr;
    gate += ((on ? 1 : 0) - gate) * (on ? 1 - Math.exp(-1 / (0.006 * sr)) : 1 - Math.exp(-1 / (0.09 * sr)));

    if (i % 32 === 0) {
      const cutoff = 1500 + 3800 * Math.exp(-sinceOnset / 0.18);
      for (const f of lp) f.set(cutoff, 0.9);
    }

    const f0 = midiToHz(pitch);
    let l = 0;
    let r = 0;

    for (const v of voices) {
      const dt = (f0 * Math.pow(2, v.cents / 1200)) / sr;
      v.phase += dt;
      if (v.phase >= 1) v.phase -= 1;
      const saw = 2 * v.phase - 1 - polyBlep(v.phase, dt);
      l += v.gl * saw;
      r += v.gr * saw;
    }

    air += (2 * f0) / sr;
    if (air >= 1) air -= 1;
    const sparkle = 0.12 * Math.sin(2 * Math.PI * air);

    out[0][i] = gate * (Math.tanh(1.4 * lp[0].process(l / 2)) + sparkle);
    out[1][i] = gate * (Math.tanh(1.4 * lp[1].process(r / 2)) + sparkle);
  }

  return out;
}

//==============================================================================

function writeWav(path: string, channels: Stereo) {
  const frames = channels[0].length;
  const data = Buffer.alloc(frames * 8);
  for (let i = 0; i < frames; ++i) {
    data.writeFloatLE(channels[0][i], i * 8);
    data.writeFloatLE(channels[1][i], i * 8 + 4);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sr, 24);
  header.writeUInt32LE(sr * 8, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

// The version the window's header shows, from project(SnapTune VERSION x.y.z), as the website does.
const version = readFileSync(join(root, "..", "CMakeLists.txt"), "utf8").match(/project\(SnapTune VERSION ([\d.]+)/)![1].replace(/\.0$/, "");

const { frames, fps } = renderVoice();
writeFileSync(join(root, "src", "frames.json"), JSON.stringify({ version, framesPerSecond: fps, frames }) + "\n");
console.log(`${frames.length} pitch frames (${frames.filter(Boolean).length} voiced) -> src/frames.json`);

const hits = bassHits();
const bass = render808(hits);
const claps = renderClaps(Array.from({ length: DRUM_BARS[1] - DRUM_BARS[0] + 1 }, (_, k) => step(DRUM_BARS[0] + k, 8)));
const hats = renderHats(hatTimes());
const clicks = renderClicks(hits);
const pad = renderPad();
const pluck = renderPluck();
const riser = renderRiser(at(DROP_BAR - 1, 1), SNAP);
const impacts = stereo();
renderImpact(SNAP, 1, impacts);
renderImpact(at(END_BAR), 0.7, impacts);

// What you hear is a synth lead playing the pitch the engine measured and put out, not the singer
// itself: off-key until the drop, then snapped to the note.
const lead = renderLead(frames, fps);
for (const c of lead) new Biquad("highpass", 160).run(c);

const sung = [samples(at(0)), samples(at(END_BAR + 1))] as const;
level(lead, -18, "rms", ...sung);
const leadMono = lead[0].map((l, i) => 0.5 * (l + lead[1][i]));
level(bass, -19, "rms", samples(at(DROP_BAR)), samples(at(END_BAR)));
level(claps, -9, "peak");
level(hats, -17, "peak");
level(clicks, -16, "peak");
level(pad, -28, "rms", samples(at(DROP_BAR)), samples(at(END_BAR)));
level(pluck, -31, "rms", samples(at(DROP_BAR)), samples(at(END_BAR)));
level(riser, -11, "peak");
level(impacts, -5, "peak");

const duck = duckCurve(hits, 0.5);
const mix = stereo();
const sendVerb = stereo();

for (let i = 0; i < length; ++i) {
  for (let c = 0; c < 2; ++c) {
    const hatPan = c === 0 ? 0.8 : 1;
    const music = duck[i] * (pad[c][i] + pluck[c][i]);
    mix[c][i] = lead[c][i] + bass[i] + clicks[i] + claps[c][i] + hatPan * hats[i] + music + riser[c][i] + impacts[c][i];
    sendVerb[c][i] = 0.4 * lead[c][i] + 0.25 * claps[c][i] + 0.45 * pluck[c][i] + 0.2 * pad[c][i] + 0.5 * impacts[c][i] + 0.3 * riser[c][i];
  }
}

const verb = reverb(sendVerb);
const echo = pingPong(leadMono, 0.75 * BEAT, 0.38);

// Fade out over the last bar's ring.
const fadeFrom = samples(DURATION - 1.2);

for (let i = 0; i < length; ++i) {
  const fade = i < fadeFrom ? 1 : Math.pow(1 - (i - fadeFrom) / (length - fadeFrom), 1.5);
  for (let c = 0; c < 2; ++c) {
    const v = mix[c][i] + 0.9 * verb[c][i] + 0.24 * echo[c][i];
    // Gentle saturation on the bus, instead of a hard ceiling.
    mix[c][i] = fade * (Math.tanh(1.15 * v) / 1.15);
  }
}

console.log(`mix peak ${(20 * Math.log10(Math.max(peak(mix[0]), peak(mix[1])))).toFixed(1)} dBFS`);

// Loudness for social video: -14 LUFS integrated. A plain gain change (loudnorm's dynamic mode would
// ride the level), checked against a -1 dBTP ceiling.
const tmp = join(mkdtempSync(join(tmpdir(), "snaptune-promo-")), "mix.wav");
writeWav(tmp, mix);
const analysis = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const json = analysis.stderr.slice(analysis.stderr.lastIndexOf("{"));
const measured = JSON.parse(json.slice(0, json.indexOf("}") + 1));
const gain = -14 - Number(measured.input_i);
const truePeak = Number(measured.input_tp) + gain;
if (truePeak > -1) throw new Error(`At -14 LUFS the mix would peak at ${truePeak.toFixed(1)} dBTP; lower the louder stems.`);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-af", `volume=${gain.toFixed(2)}dB`, "-c:a", "pcm_s16le", join(root, "public", "soundtrack.wav")]);
console.log(`mix ${measured.input_i} LUFS -> -14 LUFS, ${truePeak.toFixed(1)} dBTP -> public/soundtrack.wav`);
