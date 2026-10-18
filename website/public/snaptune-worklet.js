// SnapTune's pitch correction engine for the browser: a line-by-line port of Source/dsp (Scales.h,
// PitchDetector, AutoTuneEngine), so the web demo runs the same algorithm as the plugin. Keep the two
// in step: names, structure and comments follow the C++. Values the C++ keeps in `float` go through
// Math.fround (or Float32Array storage) so decisions land the same way.
//
// Plain ES module with no imports: it is loaded with audioWorklet.addModule() and can also be
// imported from Node for testing. The engine never touches worklet globals.

const fround = Math.fround;

/** std::lround: nearest integer, halves away from zero. */
const lround = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

/** juce::jlimit (lowerLimit, upperLimit, value). */
const jlimit = (lo, hi, v) => (v < lo ? lo : hi < v ? hi : v);

//==============================================================================
// Scales.h

export const SCALE_NAMES = [
  "Chromatic", "Major", "Minor", "Harmonic Minor", "Melodic Minor", "Major Pentatonic", "Minor Pentatonic",
  "Blues", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Locrian", "Custom",
];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Index of the Custom scale: its mask comes from the per-note switches instead. */
export const CUSTOM_SCALE = 13;

function degreesToMask(degrees) {
  let mask = 0;

  for (const degree of degrees) mask |= 1 << degree;

  return mask;
}

// Intervals above the root for each scale (bit n set = n semitones above the root is in the scale).
export const SCALE_INTERVALS = [
  0x0fff,
  degreesToMask([0, 2, 4, 5, 7, 9, 11]),
  degreesToMask([0, 2, 3, 5, 7, 8, 10]),
  degreesToMask([0, 2, 3, 5, 7, 8, 11]),
  degreesToMask([0, 2, 3, 5, 7, 9, 11]),
  degreesToMask([0, 2, 4, 7, 9]),
  degreesToMask([0, 3, 5, 7, 10]),
  degreesToMask([0, 3, 5, 6, 7, 10]),
  degreesToMask([0, 2, 3, 5, 7, 9, 10]),
  degreesToMask([0, 1, 3, 5, 7, 8, 10]),
  degreesToMask([0, 2, 4, 6, 7, 9, 11]),
  degreesToMask([0, 2, 4, 5, 7, 9, 10]),
  degreesToMask([0, 1, 3, 5, 6, 8, 10]),
  0, // Custom: the mask comes from the per-note parameters instead.
];

export function pitchClass(midiNote) {
  return ((midiNote % 12) + 12) % 12;
}

export function maskContains(mask, midiNote) {
  return ((mask >> pitchClass(midiNote)) & 1) !== 0;
}

/** 12-bit pitch-class mask (bit 0 = C, bit 11 = B) of the notes a voice may be tuned to. */
export function pitchClassMask(key, scale, customMask) {
  if (scale === CUSTOM_SCALE) return customMask & 0x0fff;

  const intervals = SCALE_INTERVALS[scale];
  let mask = 0;

  for (let degree = 0; degree < 12; ++degree) if ((intervals >> degree) & 1) mask |= 1 << pitchClass(key + degree);

  return mask;
}

/** Closest MIDI note to a fractional pitch whose pitch class is in the mask, or -1 if the mask is empty. */
export function nearestAllowedNote(note, mask) {
  if ((mask & 0x0fff) === 0) return -1;

  note = fround(note);
  const base = lround(note);
  let best = -1;
  let bestDistance = 1.0e9;

  for (let candidate = base - 6; candidate <= base + 6; ++candidate) {
    if (!maskContains(mask, candidate)) continue;

    const distance = Math.abs(fround(note - candidate));

    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

/** Picks the note to tune to. The current target is kept until another allowed note is closer
    by more than `hysteresis` semitones, so a voice hovering between two notes does not flicker. */
export function chooseTargetNote(note, mask, currentTarget, hysteresis) {
  const nearest = nearestAllowedNote(note, mask);

  if (nearest < 0 || currentTarget < 0 || nearest === currentTarget || !maskContains(mask, currentTarget)) return nearest;

  note = fround(note);
  const currentDistance = Math.abs(fround(note - currentTarget));
  const nearestDistance = Math.abs(fround(note - nearest));
  return currentDistance <= fround(nearestDistance + fround(hysteresis)) ? currentTarget : nearest;
}

export function noteName(midiNote) {
  return NOTE_NAMES[pitchClass(midiNote)];
}

export function noteOctave(midiNote) {
  return Math.trunc(midiNote < 0 ? (midiNote - 11) / 12 : midiNote / 12) - 1;
}

//==============================================================================
// PitchDetector

/** In-place iterative radix-2 complex FFT. inverse = true flips the sign of the exponent and does not scale. */
class FFT {
  constructor(order) {
    const n = 1 << order;
    this.size = n;
    this.bitReversed = new Uint32Array(n);
    this.cosTable = new Float64Array(n >> 1);
    this.sinTable = new Float64Array(n >> 1);

    for (let i = 0; i < n; ++i) {
      let r = 0;

      for (let b = 0; b < order; ++b) r |= ((i >> b) & 1) << (order - 1 - b);

      this.bitReversed[i] = r;
    }

    for (let i = 0; i < n >> 1; ++i) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / n);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / n);
    }
  }

  perform(re, im, inverse) {
    const n = this.size;
    const rev = this.bitReversed;

    for (let i = 0; i < n; ++i) {
      const j = rev[i];

      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }

    const sign = inverse ? 1 : -1;

    for (let half = 1; half < n; half <<= 1) {
      const tableStep = n / (half << 1);

      for (let start = 0; start < n; start += half << 1) {
        for (let k = 0; k < half; ++k) {
          const wr = this.cosTable[k * tableStep];
          const wi = sign * this.sinTable[k * tableStep];
          const a = start + k;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}

/** YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).

    The squared-difference function d(tau) = sum (x[j] - x[j + tau])^2 is expanded into
    energy terms (prefix sums) and a cross-correlation that is computed with FFTs: both real
    inputs share one complex transform, so one analysis costs two FFTs instead of W * maxLag
    multiply-adds. Results land in `period`, `aperiodicity` and `rms`. */
export class PitchDetector {
  constructor() {
    this.windowSize = 0;
    this.maxLag = 0;
    this.fftSize = 0;
    this.inverseScale = 1.0;

    this.period = 0.0; //       samples, sub-sample accurate; 0 when nothing was measured
    this.aperiodicity = 1.0; // cumulative-mean-normalised difference at that lag (0 = perfectly periodic)
    this.rms = 0.0; //          level of the integration window
  }

  /** windowSize is YIN's integration window W; maxLag is the longest measurable period. */
  prepare(newWindowSize, newMaxLag) {
    this.windowSize = newWindowSize;
    this.maxLag = newMaxLag;

    const frameSize = this.getFrameSize();
    let order = 1;

    while (1 << order < frameSize) ++order;

    this.fftSize = 1 << order;
    this.fft = new FFT(order);

    this.newestFirst = new Float32Array(frameSize);
    this.re = new Float64Array(this.fftSize);
    this.im = new Float64Array(this.fftSize);
    this.cmnd = new Float32Array(newMaxLag + 1).fill(1);
    this.difference = new Float64Array(newMaxLag + 1);
    this.energyPrefix = new Float64Array(frameSize + 1);

    // Measure the inverse transform's scale once: the autocorrelation of a unit impulse at lag 0
    // must come out as exactly 1.
    this.inverseScale = 1.0;
    this.newestFirst[0] = 1;
    this.correlate(1, 1);
    this.newestFirst[0] = 0;
    this.inverseScale = Math.abs(this.re[0]) > 1.0e-9 ? 1.0 / this.re[0] : 1.0;
  }

  /** Number of samples analyse() reads: W + maxLag. */
  getFrameSize() {
    return this.windowSize + this.maxLag;
  }

  /** re[tau] = sum_{j < w} z[j] z[j + tau] (unscaled), z = newestFirst over `length` samples.
      conj(FFT(window)) * FFT(frame), with window in the real part and frame in the imaginary part. */
  correlate(w, length) {
    const n = this.fftSize;
    const re = this.re;
    const im = this.im;
    const z = this.newestFirst;

    re.fill(0);
    im.fill(0);

    for (let i = 0; i < w; ++i) re[i] = z[i];

    for (let i = 0; i < length; ++i) im[i] = z[i];

    this.fft.perform(re, im, false);

    // Split the packed spectrum: A = (Z[k] + conj Z[n-k]) / 2, B = (Z[k] - conj Z[n-k]) / 2i,
    // then conj(A) * B. The product is the spectrum of a real signal, so fill both halves together.
    for (let k = 0; k <= n >> 1; ++k) {
      const m = (n - k) & (n - 1);
      const zr = re[k], zi = im[k], cr = re[m], ci = -im[m];
      const ar = 0.5 * (zr + cr), ai = 0.5 * (zi + ci);
      const br = 0.5 * (zi - ci), bi = -0.5 * (zr - cr);
      const pr = ar * br + ai * bi;
      const pi = ar * bi - ai * br;
      re[k] = pr;
      im[k] = pi;
      re[m] = pr;
      im[m] = -pi;
    }

    this.fft.perform(re, im, true);
  }

  /** `frame` holds getFrameSize() samples, oldest first. The integration window is anchored at
      the newest end of the frame so the estimate describes the most recent audio. A shorter
      `window` (0 = the prepared size) reacts faster at the cost of some robustness. */
  analyse(frame, minPeriod, maxPeriod, threshold, window = 0) {
    this.period = 0.0;
    this.aperiodicity = 1.0;
    this.rms = 0.0;

    const frameSize = this.getFrameSize();
    const w = window > 0 ? Math.min(window, this.windowSize) : this.windowSize;
    const newestFirst = this.newestFirst;
    const energyPrefix = this.energyPrefix;
    const difference = this.difference;
    const cmnd = this.cmnd;

    // Reversing puts the newest sample at index 0, so the textbook formulation (compare the first
    // W samples with the signal `tau` samples further on) measures the most recent audio.
    for (let i = 0; i < frameSize; ++i) newestFirst[i] = frame[frameSize - 1 - i];

    energyPrefix[0] = 0.0;

    for (let i = 0; i < frameSize; ++i) energyPrefix[i + 1] = energyPrefix[i] + newestFirst[i] * newestFirst[i];

    const windowEnergy = energyPrefix[w];
    this.rms = fround(Math.sqrt(windowEnergy / w));

    if (windowEnergy < 1.0e-10) return;

    // r(tau) = sum_{j < W} z[j] z[j + tau], via conj(FFT(window)) * FFT(frame).
    this.correlate(w, frameSize);
    const correlation = this.re;
    const inverseScale = this.inverseScale;

    const lastLag = Math.min(this.maxLag, Math.ceil(maxPeriod) + 1);
    let runningSum = 0.0;
    difference[0] = 0.0;
    cmnd[0] = 1.0;

    for (let tau = 1; tau <= lastLag; ++tau) {
      const lagEnergy = energyPrefix[tau + w] - energyPrefix[tau];
      const d = Math.max(0.0, windowEnergy + lagEnergy - 2.0 * correlation[tau] * inverseScale);
      difference[tau] = d;
      runningSum += d;
      cmnd[tau] = runningSum > 0.0 ? (d * tau) / runningSum : 1.0;
    }

    const tauMin = Math.max(2, Math.floor(minPeriod));
    const tauMax = Math.min(lastLag - 1, Math.ceil(maxPeriod));

    if (tauMax <= tauMin) return;

    // Absolute threshold: the first dip below the threshold wins (this is what keeps YIN from
    // choosing a sub-harmonic), then walk down to the bottom of that dip.
    let best = -1;

    for (let tau = tauMin; tau <= tauMax; ++tau) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) ++tau;

        best = tau;
        break;
      }
    }

    if (best < 0) {
      best = tauMin;

      for (let tau = tauMin + 1; tau <= tauMax; ++tau) if (cmnd[tau] < cmnd[best]) best = tau;
    }

    // Parabolic interpolation on the raw difference function for sub-sample accuracy.
    let period = best;
    const a = difference[best - 1], b = difference[best], c = difference[best + 1];
    const curvature = a - 2.0 * b + c;

    if (curvature > 0.0) period = fround(period + fround(jlimit(-0.5, 0.5, (0.5 * (a - c)) / curvature)));

    this.period = period;
    this.aperiodicity = cmnd[best];
  }
}

//==============================================================================
// AutoTuneEngine

export const VOICE_TYPE_NAMES = ["Soprano", "Alto / Tenor", "Low Male", "Instrument"];

/** Studio: TD-PSOLA, formant-preserving, ~46 ms latency (compensated by the host).
    Live: pitch-synchronous delay-line resampling (the original Auto-Tune method), a few ms of
    latency for monitoring while recording; formants move with the (usually small) correction. */
export const LatencyMode = { studio: 0, live: 1 };

export const DEFAULT_ENGINE_SETTINGS = Object.freeze({
  key: 0,
  scale: 0, //            Chromatic
  customMask: 0x0fff,
  retuneMs: 20.0, //      time to reach the target note; 0 = instant ("hard tune")
  humanize: 0.0, //       0..1, relaxes correction on sustained notes
  amount: 1.0, //         0..1, fraction of the pitch error that is corrected
  formantSemitones: 0.0,
  mix: 1.0, //            0..1 dry/wet
  tracking: 0.5, //       0..1, higher accepts breathier / noisier input as pitched
  voice: 1, //            Alto / Tenor
  midiTargets: false, //  held MIDI notes replace the scale
  referenceHz: 440.0,
  mode: LatencyMode.studio,
});

const lowestDetectableHz = 65.0;
const trackCapacity = 512; // power of two
const markCapacity = 4096; // power of two
const windowTableSize = 2048;
const maxFormantSemitones = 5.0;

// { lowHz, highHz }: soprano, alto / tenor, low male, instrument.
const voiceRanges = [
  [110.0, 1400.0],
  [75.0, 1000.0],
  [65.0, 600.0],
  [65.0, 1600.0],
];

/** Pitch frames buffered for the editor (one per hop); the oldest are dropped when it's full. */
const frameFifoSize = 2048;

function nextPowerOfTwo(x) {
  let p = 1;

  while (p < x) p <<= 1;

  return p;
}

// 4-point, 3rd-order Hermite interpolation.
function readInterpolated(ring, mask, position) {
  const index = Math.floor(position);
  const frac = position - index;
  const xm1 = ring[(index - 1) & mask];
  const x0 = ring[index & mask];
  const x1 = ring[(index + 1) & mask];
  const x2 = ring[(index + 2) & mask];
  const c = (x1 - xm1) * 0.5;
  const v = x0 - x1;
  const w = c + v;
  const a = w + v + (x2 - x0) * 0.5;
  const b = w + a;
  return ((a * frac - b) * frac + c) * frac + x0;
}

/** juce::SmoothedValue<float, Linear>. */
class LinearSmoothedValue {
  constructor() {
    this.current = 0;
    this.target = 0;
    this.countdown = 0;
    this.step = 0;
    this.stepsToTarget = 0;
  }

  reset(sampleRate, rampLengthInSeconds) {
    this.stepsToTarget = Math.floor(rampLengthInSeconds * sampleRate);
    this.setCurrentAndTargetValue(this.target);
  }

  setCurrentAndTargetValue(value) {
    this.target = this.current = fround(value);
    this.countdown = 0;
  }

  setTargetValue(value) {
    value = fround(value);

    if (value === this.target) return;

    if (this.stepsToTarget <= 0) {
      this.setCurrentAndTargetValue(value);
      return;
    }

    this.target = value;
    this.countdown = this.stepsToTarget;
    this.step = fround((this.target - this.current) / this.countdown);
  }

  getNextValue() {
    if (this.countdown <= 0) return this.target;

    --this.countdown;
    this.current = this.countdown > 0 ? fround(this.current + this.step) : this.target;
    return this.current;
  }
}

/** Real-time pitch corrector.

    Pipeline per sample:
      1. A YIN detector runs every hop on a high-passed mono sum and yields period + voicing.
      2. The detected note is snapped to the nearest allowed note; the correction (in semitones)
         is smoothed by a one-pole whose time constant is the retune speed.
      3. Pitch marks are placed one period apart on the input, locked to the waveform peaks.
      4. TD-PSOLA: two-period Hann grains centred on the marks are overlap-added at the corrected
         spacing. Because the grains are not resampled, the formants stay where they were.
         A formant control optionally resamples the grains to move the formants on purpose.

    In Studio mode the engine runs a fixed 3 periods of the lowest detectable pitch behind the input.
    Live mode skips steps 3-4: the input is read through a delay line at the corrected speed, and
    whenever the read point drifts a whole cycle it jumps back or forward one cycle (located by
    cross-correlation, crossfaded), so the delay stays within about one period of the voice.
    Either latency is reported to the host for delay compensation. */
export class AutoTuneEngine {
  constructor() {
    this.settings = { ...DEFAULT_ENGINE_SETTINGS };

    this.sampleRate = 48000.0;
    this.maxChannels = 2;
    this.activeChannels = 2;
    this.maxPeriod = 0;
    this.hopSize = 128;
    this.latency = 0;
    this.unvoicedPeriod = 240;
    this.scheduleAhead = 0;
    this.studioLatency = 0;
    this.liveLatency = 0;
    this.activeMode = LatencyMode.studio;
    this.switchFadePosition = 0;
    this.switchFadeLength = 1;

    this.ringSize = 0;
    this.ringMask = 0;
    this.inputRing = [new Float32Array(0), new Float32Array(0)];
    this.outputRing = [new Float32Array(0), new Float32Array(0)];
    this.detectionRing = new Float32Array(0);
    this.peakRing = new Float32Array(0);
    this.writePos = 0;

    // Analysis-signal filters: high-pass for the detector, extra low-pass for peak picking.
    this.hpCoeff = 0;
    this.hpLastIn = 0;
    this.hpLastOut = 0;
    this.lpCoeff = 0;
    this.lpState = 0;

    this.detector = new PitchDetector();
    this.frame = new Float32Array(0);
    this.recentPeriods = new Float32Array(3);
    this.recentCount = 0;
    this.jumpPending = false;
    this.estimateDelay = 0.0; // how far behind the newest sample the latest estimate is centred, minus half a period

    // Correction state (one value per hop).
    this.wasVoiced = false;
    this.currentTarget = -1;
    this.correction = 0;
    this.noteAge = 0;
    this.trackTime = new Float64Array(trackCapacity);
    this.trackPeriod = new Float32Array(trackCapacity);
    this.trackCorrection = new Float32Array(trackCapacity);
    this.trackVoiced = new Uint8Array(trackCapacity);
    this.trackCount = 0;
    this.lastTrackTime = 0.0;
    this.stampPeriod = 0;

    // trackAt() result.
    this.samplePeriod = 0;
    this.sampleCorrection = 0;
    this.sampleVoiced = false;

    // Pitch marks on the input timeline.
    this.markPosition = new Float64Array(markCapacity);
    this.markPeriod = new Float32Array(markCapacity);
    this.markVoiced = new Uint8Array(markCapacity);
    this.markCount = 0;
    this.markMask = markCapacity - 1;
    this.markPolarity = 1;

    // Synthesis.
    this.synthesisTime = 0.0;
    this.lastCentre = 0.0;
    this.lastStep = 0.0;
    this.lastSourceMark = -1;
    this.lastGrainVoiced = false;
    this.formantStretch = 1.0;
    this.mixSmoothed = new LinearSmoothedValue();
    this.wet = new Float32Array(2);

    this.windowTable = new Float32Array(windowTableSize + 2);

    for (let i = 0; i < this.windowTable.length; ++i) {
      const x = Math.min(1.0, i / windowTableSize);
      this.windowTable[i] = 0.5 * (1.0 + Math.cos(Math.PI * x));
    }

    // Live mode: delay-line read tap with pitch-synchronous splices.
    this.liveMinDelay = 8.0;
    this.liveTap = 0.0;
    this.spliceTap = 0.0;
    this.fadeLength = 0;
    this.fadePosition = 0;
    this.fadeEqualPower = false;
    this.liveCorrectionFrom = 0.0;
    this.liveCorrectionTo = 0.0;
    this.liveRamp = 0;

    // MIDI target notes.
    this.heldNotes = new Int32Array(128);
    this.heldMask = 0;

    // Audio -> editor pitch frames: [inputNote, outputNote, targetNote, voiced] per hop.
    this.frameBuffer = new Float32Array(frameFifoSize * 4);
    this.frameRead = 0;
    this.frameWrite = 0;
  }

  prepare(newSampleRate, newMaxChannels) {
    const sampleRate = (this.sampleRate = newSampleRate);
    this.maxChannels = jlimit(1, 2, newMaxChannels);
    this.activeChannels = this.maxChannels;

    this.maxPeriod = Math.ceil(sampleRate / lowestDetectableHz);
    this.hopSize = Math.max(32, lround(sampleRate / 375.0));
    this.unvoicedPeriod = lround(sampleRate / 200.0);
    this.studioLatency = 3 * this.maxPeriod;
    this.scheduleAhead = Math.ceil(1.4 * this.maxPeriod);

    // Live mode reads between a few samples and about one period behind the input; report the
    // middle of that range for a typical (200 Hz) voice.
    this.liveMinDelay = Math.max(8.0, lround(sampleRate * 0.0002));
    this.liveLatency = Math.trunc(this.liveMinDelay) + lround(sampleRate / 400.0);
    this.switchFadeLength = Math.max(1, lround(sampleRate * 0.01));

    this.activeMode = this.settings.mode;
    this.latency = this.activeMode === LatencyMode.live ? this.liveLatency : this.studioLatency;

    this.detector.prepare(this.maxPeriod, this.maxPeriod + 2);
    this.frame = new Float32Array(this.detector.getFrameSize());

    this.ringSize = nextPowerOfTwo(this.studioLatency + 4 * this.maxPeriod + this.detector.getFrameSize() + 1024);
    this.ringMask = this.ringSize - 1;

    this.inputRing = [new Float32Array(this.ringSize), new Float32Array(this.ringSize)];
    this.outputRing = [new Float32Array(this.ringSize), new Float32Array(this.ringSize)];
    this.detectionRing = new Float32Array(this.ringSize);
    this.peakRing = new Float32Array(this.ringSize);

    this.hpCoeff = fround(Math.exp((-2 * Math.PI * 50.0) / sampleRate));
    this.lpCoeff = fround(Math.exp((-2 * Math.PI * 1500.0) / sampleRate));

    this.mixSmoothed.reset(sampleRate, 0.03);
    this.mixSmoothed.setCurrentAndTargetValue(this.settings.mix);

    this.reset();
  }

  reset() {
    for (const ring of this.inputRing) ring.fill(0);

    for (const ring of this.outputRing) ring.fill(0);

    this.detectionRing.fill(0);
    this.peakRing.fill(0);
    this.writePos = 0;

    this.hpLastIn = this.hpLastOut = this.lpState = 0;
    this.recentCount = 0;
    this.jumpPending = false;

    this.wasVoiced = false;
    this.currentTarget = -1;
    this.correction = 0;
    this.noteAge = 0;
    this.trackCount = 0;
    this.lastTrackTime = -1.0e12;
    this.stampPeriod = fround(0.5 * this.maxPeriod);

    this.markCount = 0;
    this.markPolarity = 1;

    this.synthesisTime = 0.0;
    this.lastCentre = -this.unvoicedPeriod;
    this.lastStep = this.unvoicedPeriod;
    this.lastSourceMark = -1;
    this.lastGrainVoiced = false;

    // The next sample written lands at index writePos; read `latency` samples behind it.
    this.liveTap = this.writePos - this.liveLatency;
    this.fadeLength = this.fadePosition = 0;
    this.liveCorrectionFrom = this.liveCorrectionTo = 0.0;
    this.liveRamp = this.hopSize;
    this.switchFadePosition = this.switchFadeLength;
  }

  /** Latency of the active mode. Changes when settings switch between Studio and Live. */
  getLatencySamples() {
    return this.latency;
  }

  getActiveMode() {
    return this.activeMode;
  }

  getFramesPerSecond() {
    return this.sampleRate / this.hopSize;
  }

  /** Copies the fields of a settings object (see DEFAULT_ENGINE_SETTINGS); missing fields keep their value. */
  setSettings(s) {
    const t = this.settings;

    if (s.key !== undefined) t.key = s.key | 0;
    if (s.scale !== undefined) t.scale = s.scale | 0;
    if (s.customMask !== undefined) t.customMask = s.customMask & 0xffff;
    if (s.retuneMs !== undefined) t.retuneMs = fround(s.retuneMs);
    if (s.humanize !== undefined) t.humanize = fround(s.humanize);
    if (s.amount !== undefined) t.amount = fround(s.amount);
    if (s.formantSemitones !== undefined) t.formantSemitones = fround(s.formantSemitones);
    if (s.mix !== undefined) t.mix = fround(s.mix);
    if (s.tracking !== undefined) t.tracking = fround(s.tracking);
    if (s.voice !== undefined) t.voice = s.voice | 0;
    if (s.midiTargets !== undefined) t.midiTargets = !!s.midiTargets;
    if (s.referenceHz !== undefined) t.referenceHz = fround(s.referenceHz);
    if (s.mode !== undefined) t.mode = s.mode === LatencyMode.live ? LatencyMode.live : LatencyMode.studio;
  }

  switchMode(mode) {
    this.activeMode = mode;
    this.latency = mode === LatencyMode.live ? this.liveLatency : this.studioLatency;

    // Restart whichever renderer is taking over from the current position.
    for (const ring of this.outputRing) ring.fill(0);

    // Called before the next sample (index writePos) is written.
    const now = this.writePos - this.latency;
    this.markCount = 0;
    this.synthesisTime = now;
    this.lastCentre = now - this.unvoicedPeriod;
    this.lastStep = this.unvoicedPeriod;
    this.lastSourceMark = -1;
    this.lastGrainVoiced = false;

    this.liveTap = now;
    this.fadeLength = this.fadePosition = 0;

    // Fade the output back in so the jump in delay doesn't click.
    this.switchFadePosition = 0;
  }

  //==============================================================================
  noteOn(note) {
    if (note >= 0 && note < 128) {
      ++this.heldNotes[note];
      this.updateHeldMask();
    }
  }

  noteOff(note) {
    if (note >= 0 && note < 128 && this.heldNotes[note] > 0) {
      --this.heldNotes[note];
      this.updateHeldMask();
    }
  }

  allNotesOff() {
    this.heldNotes.fill(0);
    this.updateHeldMask();
  }

  /** Pitch classes of the MIDI notes currently held (bit 0 = C). */
  getHeldNoteMask() {
    return this.heldMask;
  }

  updateHeldMask() {
    let mask = 0;

    for (let note = 0; note < 128; ++note) if (this.heldNotes[note] > 0) mask |= 1 << pitchClass(note);

    this.heldMask = mask;
  }

  //==============================================================================
  /** Processes channels[c][startSample .. startSample + numSamples) in place. */
  process(channels, numChannels, startSample, numSamples, bypassed = false) {
    if (this.ringSize === 0) return; // not prepared yet: leave the audio untouched

    const settings = this.settings;

    if (settings.mode !== this.activeMode) this.switchMode(settings.mode);

    this.activeChannels = jlimit(1, this.maxChannels, numChannels);
    this.formantStretch =
      this.activeMode === LatencyMode.live ? 1.0 : Math.pow(2, jlimit(-maxFormantSemitones, maxFormantSemitones, settings.formantSemitones) / 12.0);
    this.mixSmoothed.setTargetValue(bypassed ? 0.0 : jlimit(0.0, 1.0, settings.mix));

    const activeChannels = this.activeChannels;
    const monoScale = fround(1.0 / activeChannels);
    const ringMask = this.ringMask;
    const frameSize = this.detector.getFrameSize();
    const wet = this.wet;

    for (let i = startSample; i < startSample + numSamples; ++i) {
      const slot = this.writePos & ringMask;
      let mono = 0;

      for (let c = 0; c < activeChannels; ++c) {
        const x = channels[c][i];
        this.inputRing[c][slot] = x;
        mono = fround(mono + x);
      }

      mono = fround(mono * monoScale);

      const highPassed = fround(this.hpCoeff * fround(fround(this.hpLastOut + mono) - this.hpLastIn));
      this.hpLastIn = mono;
      this.hpLastOut = highPassed;
      this.lpState = fround(highPassed + fround(this.lpCoeff * fround(this.lpState - highPassed)));

      this.detectionRing[slot] = highPassed;
      this.peakRing[slot] = this.lpState;
      ++this.writePos;

      if (this.writePos % this.hopSize === 0 && this.writePos >= frameSize) this.analyseHop();

      wet[0] = wet[1] = 0;

      if (this.activeMode === LatencyMode.live) this.liveSample(wet);
      else this.studioSample(wet);

      // The dry signal is delayed by the reported latency so Mix stays aligned with the host.
      const dryIndex = this.writePos - 1 - this.latency;
      const mix = this.mixSmoothed.getNextValue();
      let gain = 1;

      if (this.switchFadePosition < this.switchFadeLength) gain = fround(++this.switchFadePosition / this.switchFadeLength);

      for (let c = 0; c < activeChannels; ++c) {
        const dry = dryIndex >= 0 ? this.inputRing[c][dryIndex & ringMask] : 0;
        channels[c][i] = gain * (dry + mix * (wet[c] - dry));
      }
    }
  }

  studioSample(wet) {
    // The output sample corresponds to the input `latency` samples ago.
    const now = this.writePos - 1 - this.latency;

    // Place marks only as far ahead as synthesis needs them: the further a mark is from the
    // newest pitch estimate, the more its voicing decision is a guess.
    const lastMark = (this.markCount - 1) & this.markMask;
    const recentPeriod = this.markCount > 0 && this.markVoiced[lastMark] ? this.markPeriod[lastMark] : 0.0;
    const markHorizon = Math.min(
      this.writePos - 2,
      now + this.scheduleAhead + this.hopSize + Math.trunc(3.0 * Math.max(recentPeriod, this.unvoicedPeriod)),
    );
    this.generateMarks(markHorizon);

    if (now < 0) return;

    while (this.synthesisTime - now <= this.scheduleAhead) this.emitGrain(now);

    const outSlot = now & this.ringMask;

    for (let c = 0; c < this.activeChannels; ++c) {
      wet[c] = this.outputRing[c][outSlot];
      this.outputRing[c][outSlot] = 0;
    }
  }

  //==============================================================================
  readInput(channel, position) {
    return readInterpolated(this.inputRing[channel], this.ringMask, position);
  }

  liveSample(wet) {
    // The correction ramps across each hop so the ratio changes smoothly, not in steps.
    this.liveRamp = Math.min(this.liveRamp + 1, this.hopSize);
    const correctionNow = this.liveCorrectionFrom + ((this.liveCorrectionTo - this.liveCorrectionFrom) * this.liveRamp) / this.hopSize;
    const ratio = jlimit(0.5, 2.0, Math.pow(2, correctionNow / 12.0));

    if (this.fadeLength === 0) this.maybeSplice(ratio);

    if (this.fadeLength > 0) {
      const t = (this.fadePosition + 0.5) / this.fadeLength;
      const fadeIn = this.fadeEqualPower ? Math.sin(0.5 * Math.PI * t) : 0.5 - 0.5 * Math.cos(Math.PI * t);
      const fadeOut = this.fadeEqualPower ? Math.cos(0.5 * Math.PI * t) : 1.0 - fadeIn;

      for (let c = 0; c < this.activeChannels; ++c)
        wet[c] = fadeOut * this.readInput(c, this.liveTap) + fadeIn * this.readInput(c, this.spliceTap);

      this.spliceTap += ratio;

      if (++this.fadePosition >= this.fadeLength) {
        this.liveTap = this.spliceTap;
        this.fadeLength = this.fadePosition = 0;
      } else {
        this.liveTap += ratio;
      }

      return;
    }

    for (let c = 0; c < this.activeChannels; ++c) wet[c] = this.readInput(c, this.liveTap);

    this.liveTap += ratio;
  }

  maybeSplice(ratio) {
    const newest = this.writePos - 1;
    const delay = newest - this.liveTap;
    const latest = (this.trackCount - 1) & (trackCapacity - 1);
    const voiced = this.trackCount > 0 && this.trackVoiced[latest] !== 0 && this.trackPeriod[latest] > 1.0;
    const liveMinDelay = this.liveMinDelay;

    if (voiced && delay < liveMinDelay + 1.5 * this.maxPeriod) {
      // Reading faster than the input arrives (pitch up) eventually catches up with the newest
      // sample: jump back one cycle and repeat it. Reading slower (pitch down) falls behind: jump
      // forward one cycle and skip it. Jumping by exactly one period of a periodic signal is
      // seamless; the cross-correlation search finds that period at the read point.
      const period = this.trackPeriod[latest];
      let fade = jlimit(16.0, 0.006 * this.sampleRate, 0.5 * period);

      if (Math.abs(ratio - 1.0) > 1.0e-9) fade = Math.min(fade, (0.9 * period) / Math.abs(ratio - 1.0));

      if (ratio > 1.0 && delay < liveMinDelay + (ratio - 1.0) * fade + 2.0)
        this.startSplice(-this.findSpliceLength(this.liveTap, -1, 0.8 * period, 1.25 * period, period), fade, false);
      else if (ratio < 1.0 && delay > liveMinDelay + 1.25 * period + 2.0)
        this.startSplice(this.findSpliceLength(this.liveTap, 1, 0.8 * period, Math.min(1.25 * period, delay - liveMinDelay - 2.0), period), fade, false);

      return;
    }

    // No pitch to stay in phase with: drift back to the reported latency so Mix and the host's
    // delay compensation stay aligned. Unpitched audio is uncorrelated, hence equal-power.
    if (Math.abs(delay - this.liveLatency) > 0.25 * this.unvoicedPeriod) this.startSplice(delay - this.liveLatency, 0.005 * this.sampleRate, true);
  }

  similarity(base, other, window, reference) {
    const ring = this.detectionRing;
    const mask = this.ringMask;
    let cross = 0.0, energy = 0.0;

    for (let i = 0; i < window; ++i) {
      const a = ring[(base - i) & mask];
      const b = ring[(other - i) & mask];
      cross += a * b;
      energy += b * b;
    }

    return cross / Math.sqrt(reference * energy + 1.0e-20);
  }

  findSpliceLength(tap, direction, minLength, maxLength, period) {
    // Compare the cycle just behind the read point with the one `length` samples further back
    // (direction -1) or ahead (+1), and keep the length where they line up best.
    const window = jlimit(32, 512, lround(period));
    const base = Math.floor(tap);
    const lo = Math.ceil(minLength);
    const hi = Math.floor(maxLength);

    if (hi <= lo) return 0.5 * (minLength + maxLength);

    let reference = 0.0;

    for (let i = 0; i < window; ++i) {
      const a = this.detectionRing[(base - i) & this.ringMask];
      reference += a * a;
    }

    let best = lo;
    let bestScore = -2.0;

    for (let length = lo; length <= hi; ++length) {
      const score = this.similarity(base, base + direction * length, window, reference);

      if (score > bestScore) {
        bestScore = score;
        best = length;
      }
    }

    // Sub-sample refinement.
    if (best > lo && best < hi) {
      const a = this.similarity(base, base + direction * (best - 1), window, reference);
      const b = bestScore;
      const c = this.similarity(base, base + direction * (best + 1), window, reference);
      const curvature = a - 2.0 * b + c;

      if (curvature < 0.0) return best + jlimit(-0.5, 0.5, (0.5 * (a - c)) / curvature);
    }

    return best;
  }

  startSplice(offset, fadeSamples, uncorrelated) {
    this.spliceTap = this.liveTap + offset;
    this.fadeLength = Math.max(1, lround(fadeSamples));
    this.fadePosition = 0;
    this.fadeEqualPower = uncorrelated;
  }

  //==============================================================================
  analyseHop() {
    const settings = this.settings;
    const sampleRate = this.sampleRate;
    const maxPeriod = this.maxPeriod;
    const frameSize = this.detector.getFrameSize();
    const first = this.writePos - frameSize;

    for (let i = 0; i < frameSize; ++i) this.frame[i] = this.detectionRing[(first + i) & this.ringMask];

    const range = voiceRanges[jlimit(0, voiceRanges.length - 1, settings.voice)];
    const minPeriod = fround(sampleRate / range[1]);
    const maxPeriodForVoice = Math.min(maxPeriod, fround(sampleRate / range[0]));

    const tracking = jlimit(0, 1, settings.tracking);
    const voicedThreshold = fround(fround(0.14) + fround(fround(0.36) * tracking));
    const pickThreshold = Math.min(fround(0.15), voicedThreshold);

    // Live mode has no look-ahead to hide the detector's delay behind, so it integrates over
    // ~1.5 periods of the current voice instead of the full window: the estimate then describes
    // audio about 5 ms old instead of ~10 ms.
    const live = this.activeMode === LatencyMode.live;
    let window = maxPeriod;

    if (live) {
      const reference = this.wasVoiced ? this.stampPeriod : 0.5 * maxPeriodForVoice;
      window = Math.trunc(jlimit(0.35 * maxPeriod, maxPeriod, 1.5 * reference));
    }

    const result = this.detector;
    result.analyse(this.frame, minPeriod, maxPeriodForVoice, pickThreshold, window);

    // Hysteresis on both the level gate and the periodicity threshold keeps the voicing
    // decision from chattering at the ends of notes.
    // The level gate only has to ignore near-silence (-76 dBFS); the periodicity test is what
    // rejects noise. A higher gate cuts quiet mic signals into fragments.
    const gate = this.wasVoiced ? fround(0.0001) : fround(0.00016);
    const aperiodicityLimit = this.wasVoiced ? fround(voicedThreshold + fround(0.1)) : voicedThreshold;
    let voiced = result.period > 0 && result.rms > gate && result.aperiodicity < aperiodicityLimit;
    const recentPeriods = this.recentPeriods;

    // Pitch continuity: during a note, a frame whose period matches the one being tracked is still
    // the voice even if breath, room sound or jitter push it a little over the limit. Without this,
    // real (and especially low, roomy) voices drop out for 15-35 ms at a time.
    if (
      !voiced &&
      this.wasVoiced &&
      this.recentCount > 0 &&
      result.period > 0 &&
      result.rms > gate &&
      result.aperiodicity < fround(aperiodicityLimit + fround(0.2)) &&
      Math.abs(Math.log2(fround(result.period / recentPeriods[2]))) < fround(0.03)
    )
      voiced = true;

    let period = result.period;
    this.estimateDelay = 0.5 * window;

    if (voiced && live) {
      // A median would cost a hop of delay. Instead hold any sudden jump of more than ~4
      // semitones for one hop, and accept it only if the next estimate confirms it.
      const jump = this.recentCount > 0 && Math.abs(Math.log2(fround(period / recentPeriods[2]))) > fround(0.33);

      if (jump && !this.jumpPending) {
        this.jumpPending = true;
        period = recentPeriods[2];
      } else {
        this.jumpPending = false;
      }

      recentPeriods.fill(period);
      this.recentCount = 1;
    } else if (voiced) {
      // A 3-point median removes isolated octave errors; it delays the estimate by one hop.
      this.estimateDelay += this.hopSize;
      recentPeriods[0] = recentPeriods[1];
      recentPeriods[1] = recentPeriods[2];
      recentPeriods[2] = period;
      this.recentCount = Math.min(this.recentCount + 1, 3);

      if (this.recentCount === 3) {
        const a = recentPeriods[0], b = recentPeriods[1], c = recentPeriods[2];
        period = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
      }
    } else {
      this.recentCount = 0;
      this.jumpPending = false;
      this.estimateDelay += live ? 0 : this.hopSize;
    }

    this.updateCorrection(voiced, period);
  }

  updateCorrection(voiced, period) {
    const settings = this.settings;
    const hopSeconds = fround(this.hopSize / this.sampleRate);
    const previousTarget = this.currentTarget;
    const continuingNote = voiced && this.wasVoiced;
    let uiInput = 0, uiOutput = 0, uiTarget = -1;

    if (voiced) {
      const inputNote = fround(69.0 + 12.0 * Math.log2(this.sampleRate / period / settings.referenceHz));

      let mask = pitchClassMask(settings.key, settings.scale, settings.customMask);

      if (settings.midiTargets && this.heldMask !== 0) mask = this.heldMask;

      const target = chooseTargetNote(inputNote, mask, this.currentTarget, 0.12);

      if (!this.wasVoiced || target !== this.currentTarget) this.noteAge = 0;
      else this.noteAge = fround(this.noteAge + hopSeconds);

      // Notes start uncorrected and glide onto the target at the retune speed.
      if (!this.wasVoiced) this.correction = 0;

      this.currentTarget = target;

      const wanted = target >= 0 ? fround(fround(target - inputNote) * jlimit(0, 1, settings.amount)) : 0;

      // Humanize: once a note has been held for a moment, slow the retune down so the
      // singer's own drift and vibrato on long notes come through.
      let retuneMs = Math.max(0, settings.retuneMs);
      const sustain = jlimit(0, 1, fround(fround(this.noteAge - fround(0.12)) / fround(0.3)));
      retuneMs = fround(retuneMs + fround(fround(jlimit(0, 1, settings.humanize) * 300.0) * sustain));

      // One-pole smoothing; the time constant is a third of the retune time so the
      // correction is ~95% complete after `retuneMs`.
      const alpha = retuneMs < 0.5 ? 1 : fround(1.0 - fround(Math.exp(fround(fround(-hopSeconds * 3000.0) / retuneMs))));
      this.correction = fround(this.correction + fround(alpha * fround(wanted - this.correction)));

      uiInput = inputNote;
      uiOutput = fround(inputNote + this.correction);
      uiTarget = target;
    } else {
      this.correction = 0;
      this.currentTarget = -1;
      this.noteAge = 0;
    }

    this.wasVoiced = voiced;

    // YIN compares the newest W samples with audio one period older, so its estimate describes the
    // point (W + period) / 2 back from the newest sample (plus a hop when the median filter is on).
    if (voiced) this.stampPeriod = period;

    const entry = this.trackCount & (trackCapacity - 1);
    const time = Math.max(this.lastTrackTime + 1.0, this.writePos - this.estimateDelay - 0.5 * this.stampPeriod);
    this.trackTime[entry] = time;
    this.lastTrackTime = time;
    this.trackPeriod[entry] = voiced ? period : 0;
    this.trackCorrection[entry] = this.correction;
    this.trackVoiced[entry] = voiced ? 1 : 0;
    ++this.trackCount;

    // Live mode reads just a few ms behind the input, but this estimate describes audio ~10 ms
    // older. Within a note, extrapolate the correction along its current slope to the read point
    // (as it will be at the end of the next hop), so fast vibrato is corrected on time. Clamped,
    // and skipped across note changes where the correction jumps.
    let liveTarget = this.correction;

    if (continuingNote && this.currentTarget === previousTarget && this.trackCount >= 2) {
      const previous = (this.trackCount - 2) & (trackCapacity - 1);
      const span = time - this.trackTime[previous];

      if (this.trackVoiced[previous] && span > 0.0) {
        const ahead = this.liveTap + this.hopSize - time;
        liveTarget += jlimit(-0.3, 0.3, (fround(this.trackCorrection[entry] - this.trackCorrection[previous]) / span) * ahead);
      }
    }

    // Glide from the correction in use now to the new one over the next hop.
    this.liveCorrectionFrom += ((this.liveCorrectionTo - this.liveCorrectionFrom) * this.liveRamp) / this.hopSize;
    this.liveCorrectionTo = liveTarget;
    this.liveRamp = 0;

    this.pushFrame(uiInput, uiOutput, uiTarget, voiced);
  }

  /** Interpolated track entry at `time`, into samplePeriod / sampleCorrection / sampleVoiced. */
  trackAt(time) {
    const trackCount = this.trackCount;

    if (trackCount === 0) {
      this.samplePeriod = 0;
      this.sampleCorrection = 0;
      this.sampleVoiced = false;
      return;
    }

    const indexMask = trackCapacity - 1;
    let lo = Math.max(0, trackCount - trackCapacity + 1);
    let hi = trackCount - 1;

    if (time >= this.trackTime[hi & indexMask]) {
      this.copyTrackEntry(hi & indexMask);
      return;
    }

    if (time <= this.trackTime[lo & indexMask]) {
      this.copyTrackEntry(lo & indexMask);
      return;
    }

    // Entry times increase but are not evenly spaced (they depend on the detected period).
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);

      if (this.trackTime[mid & indexMask] <= time) lo = mid;
      else hi = mid;
    }

    const a = lo & indexMask;
    const b = hi & indexMask;
    const frac = fround((time - this.trackTime[a]) / (this.trackTime[b] - this.trackTime[a]));
    const aVoiced = this.trackVoiced[a] !== 0;
    const bVoiced = this.trackVoiced[b] !== 0;

    this.sampleVoiced = frac < 0.5 ? aVoiced : bVoiced;
    this.sampleCorrection = fround(this.trackCorrection[a] + fround(frac * fround(this.trackCorrection[b] - this.trackCorrection[a])));

    if (aVoiced && bVoiced) this.samplePeriod = fround(this.trackPeriod[a] + fround(frac * fround(this.trackPeriod[b] - this.trackPeriod[a])));
    else this.samplePeriod = aVoiced ? this.trackPeriod[a] : this.trackPeriod[b];
  }

  copyTrackEntry(index) {
    this.samplePeriod = this.trackPeriod[index];
    this.sampleCorrection = this.trackCorrection[index];
    this.sampleVoiced = this.trackVoiced[index] !== 0;
  }

  //==============================================================================
  pushMark(position, period, voiced) {
    const slot = this.markCount & this.markMask;
    this.markPosition[slot] = position;
    this.markPeriod[slot] = period;
    this.markVoiced[slot] = voiced ? 1 : 0;
    ++this.markCount;
  }

  oldestMark() {
    return Math.max(0, this.markCount - markCapacity + 16);
  }

  refinePeak(index) {
    const ring = this.peakRing;
    const mask = this.ringMask;
    const polarity = this.markPolarity;
    const ym1 = fround(polarity * ring[(index - 1) & mask]);
    const y0 = fround(polarity * ring[index & mask]);
    const yp1 = fround(polarity * ring[(index + 1) & mask]);
    const curvature = fround(fround(ym1 - fround(2.0 * y0)) + yp1);

    if (curvature >= 0) return index;

    return index + jlimit(-0.5, 0.5, (0.5 * fround(ym1 - yp1)) / curvature);
  }

  /** Extends the pitch marks up to newestReadable (peak refinement reads one sample past it). */
  generateMarks(newestReadable) {
    const ring = this.peakRing;
    const ringMask = this.ringMask;
    const unvoicedPeriod = this.unvoicedPeriod;

    for (let guard = 0; guard < 64; ++guard) {
      if (this.markCount === 0) {
        this.pushMark(Math.max(0, this.writePos - 1 - this.latency - 2 * this.maxPeriod), unvoicedPeriod, false);
        continue;
      }

      const lastSlot = (this.markCount - 1) & this.markMask;
      const lastPosition = this.markPosition[lastSlot];
      const lastPeriod = this.markPeriod[lastSlot];
      const lastVoiced = this.markVoiced[lastSlot] !== 0;
      const predicted = lastPosition + (lastVoiced ? lastPeriod : unvoicedPeriod);
      this.trackAt(predicted);

      if (!this.sampleVoiced || this.samplePeriod <= 1) {
        if (predicted > newestReadable) return;

        this.pushMark(predicted, unvoicedPeriod, false);
        continue;
      }

      const period = this.samplePeriod;

      if (!lastVoiced) {
        // Voicing onset: anchor on the strongest excursion within one period and remember
        // its polarity, so later marks land on the same feature of every cycle.
        const from = Math.ceil(predicted);
        const to = from + Math.trunc(period);

        if (to + 1 > newestReadable) return;

        let best = from;
        let bestMagnitude = -1;

        for (let n = from; n <= to; ++n) {
          const magnitude = Math.abs(ring[n & ringMask]);

          if (magnitude > bestMagnitude) {
            bestMagnitude = magnitude;
            best = n;
          }
        }

        this.markPolarity = ring[best & ringMask] >= 0 ? 1 : -1;
        this.pushMark(this.refinePeak(best), period, true);
        continue;
      }

      // Continuing voiced segment: search around one period ahead for the matching peak, with
      // a gentle pull toward the predicted position so neighbouring peaks don't cause jitter.
      const centre = lastPosition + period;
      const radius = 0.3 * period;
      const from = Math.ceil(centre - radius);
      const to = Math.floor(centre + radius);

      if (to + 1 > newestReadable) return;

      let peakMagnitude = fround(1.0e-9);

      for (let n = from; n <= to; ++n) peakMagnitude = Math.max(peakMagnitude, Math.abs(ring[n & ringMask]));

      const pull = fround(0.5 * peakMagnitude);
      const polarity = this.markPolarity;
      let best = from;
      let bestScore = -1.0e30;

      for (let n = from; n <= to; ++n) {
        const distance = fround((n - centre) / radius);
        const score = fround(fround(polarity * ring[n & ringMask]) - fround(fround(pull * distance) * distance));

        if (score > bestScore) {
          bestScore = score;
          best = n;
        }
      }

      this.pushMark(this.refinePeak(best), period, true);
    }
  }

  markDistance(i, time) {
    return Math.abs(this.markPosition[i & this.markMask] - time);
  }

  markMargin(i) {
    const slot = i & this.markMask;
    return this.markVoiced[slot] ? 0.1 * this.markPeriod[slot] : 0.0;
  }

  findSourceMark(time) {
    if (this.markCount === 0) return -1;

    const oldest = this.oldestMark();
    let k = jlimit(oldest, this.markCount - 1, this.lastSourceMark + 1);

    // Starting from the successor of the last grain's mark, move to whichever mark is nearest.
    // The margin adds hysteresis so a grain halfway between two marks doesn't flip-flop.
    while (k + 1 < this.markCount && this.markDistance(k + 1, time) + this.markMargin(k) < this.markDistance(k, time)) ++k;

    while (k - 1 >= oldest && this.markDistance(k - 1, time) + this.markMargin(k) < this.markDistance(k, time)) --k;

    return k;
  }

  //==============================================================================
  emitGrain(now) {
    const unvoicedPeriod = this.unvoicedPeriod;
    const markMask = this.markMask;
    const formantStretch = this.formantStretch;
    let centre = this.synthesisTime;
    let step = unvoicedPeriod;
    let source = centre;
    let halfLeft = 0.0, halfRight = 0.0;
    let ratio = 1.0;
    let voiced = false;

    const k = this.findSourceMark(centre);

    if (k >= 0) {
      this.lastSourceMark = k;
      const slot = k & markMask;
      const position = this.markPosition[slot];
      const period = this.markPeriod[slot];

      let useVoiced = this.markVoiced[slot] !== 0 && Math.abs(position - centre) < 1.5 * period;

      if (useVoiced && !this.lastGrainVoiced) {
        // Entering a voiced segment: line the synthesis grid up with the analysis marks so an
        // uncorrected voice is reproduced exactly. If the segment starts further ahead, keep
        // passing audio through; the unvoiced branch below steps onto the first mark.
        const ahead = position - centre;

        if (Math.abs(ahead) <= 0.5 * this.lastStep) centre = position;
        else if (ahead > 0.0) useVoiced = false;
      }

      if (useVoiced) {
        const previousVoiced = k - 1 >= this.oldestMark() && this.markVoiced[(k - 1) & markMask] !== 0;
        const nextVoiced = k + 1 < this.markCount && this.markVoiced[(k + 1) & markMask] !== 0;

        // Window halves reach the neighbouring grains, so consecutive halves are complementary
        // (they sum to exactly 1) whenever the spacing is left unchanged.
        let left = this.lastGrainVoiced ? (previousVoiced ? position - this.markPosition[(k - 1) & markMask] : period) : centre - this.lastCentre;
        let right = nextVoiced ? this.markPosition[(k + 1) & markMask] - position : period;
        left = jlimit(0.25 * period, 2.0 * period, left);
        right = jlimit(0.5 * period, 1.5 * period, right);

        // The output period is this mark's period scaled by the correction, so read the
        // correction at the centre of that same period: on fast glides, sampling it anywhere
        // else leaves the note off by the pitch change in between.
        this.trackAt(position + 0.5 * right);
        ratio = jlimit(0.5, 2.0, Math.pow(2, this.sampleCorrection / 12.0));
        step = right / ratio;
        source = position;

        // The floor keeps grains overlapping when the pitch is lowered a lot.
        halfLeft = Math.max(left / formantStretch, 0.6 * step);
        halfRight = Math.max(right / formantStretch, 0.6 * step);
        voiced = true;
      }
    }

    if (!voiced) {
      // Unvoiced audio is passed through grain by grain (source == centre). Look ahead for the
      // first mark of an upcoming voiced segment and divide the distance into even steps so a
      // grain lands exactly on it.
      for (let j = Math.max(k - 1, this.oldestMark()); k >= 0 && j < this.markCount; ++j) {
        const upcoming = this.markPosition[j & markMask];

        if (upcoming <= centre) continue;

        if (upcoming > centre + 3.0 * unvoicedPeriod) break;

        if (this.markVoiced[j & markMask]) {
          const distance = upcoming - centre;
          const steps = Math.max(1.0, Math.ceil(distance / (1.25 * unvoicedPeriod)));
          step = Math.max(distance / steps, 0.25 * unvoicedPeriod);
          break;
        }
      }

      const left = jlimit(0.25 * unvoicedPeriod, 2.0 * unvoicedPeriod, centre - this.lastCentre);
      halfLeft = Math.max(left / formantStretch, 0.6 * left);
      halfRight = Math.max(step / formantStretch, 0.6 * step);
    }

    // Packing grains closer raises the level (more overlap); compensate to keep loudness steady.
    const gain = fround(jlimit(0.25, 2.0, Math.sqrt(formantStretch / ratio)));

    this.writeGrain(now, centre, source, halfLeft, halfRight, gain);

    this.synthesisTime = centre + step;
    this.lastCentre = centre;
    this.lastStep = step;
    this.lastGrainVoiced = voiced;
  }

  window(x) {
    if (x >= 1.0) return 0;

    const position = x * windowTableSize;
    const index = Math.trunc(position);
    const frac = fround(position - index);
    const table = this.windowTable;
    return fround(table[index] + fround(frac * fround(table[index + 1] - table[index])));
  }

  writeGrain(now, centre, source, halfLeft, halfRight, gain) {
    const first = Math.max(now, Math.ceil(centre - halfLeft));
    const last = Math.floor(centre + halfRight);
    const newestReadable = this.writePos - 3.0;
    const oldestReadable = this.writePos - this.ringSize + 2;
    const formantStretch = this.formantStretch;
    const ringMask = this.ringMask;
    const activeChannels = this.activeChannels;

    for (let u = first; u <= last; ++u) {
      const offset = u - centre;
      const readPosition = source + offset * formantStretch;

      if (readPosition > newestReadable) break;

      if (readPosition < oldestReadable) continue;

      const w = offset < 0.0 ? this.window(-offset / halfLeft) : this.window(offset / halfRight);

      if (w <= 0) continue;

      const g = fround(gain * w);
      const slot = u & ringMask;

      for (let c = 0; c < activeChannels; ++c) this.outputRing[c][slot] += g * readInterpolated(this.inputRing[c], ringMask, readPosition);
    }
  }

  //==============================================================================
  pushFrame(inputNote, outputNote, targetNote, voiced) {
    const next = (this.frameWrite + 1) % frameFifoSize;

    // Full (one slot stays empty, like juce::AbstractFifo): drop the frame.
    if (next === this.frameRead) return;

    const base = this.frameWrite * 4;
    this.frameBuffer[base] = inputNote;
    this.frameBuffer[base + 1] = outputNote;
    this.frameBuffer[base + 2] = targetNote;
    this.frameBuffer[base + 3] = voiced ? 1 : 0;
    this.frameWrite = next;
  }

  /** Pops up to maxFrames pending pitch frames into `destination`, 4 floats each:
      [inputNote, outputNote, targetNote, voiced ? 1 : 0]. Returns the number of frames. */
  popFrames(destination, maxFrames) {
    let count = 0;

    while (count < maxFrames && this.frameRead !== this.frameWrite) {
      const from = this.frameRead * 4;
      const to = count * 4;
      destination[to] = this.frameBuffer[from];
      destination[to + 1] = this.frameBuffer[from + 1];
      destination[to + 2] = this.frameBuffer[from + 2];
      destination[to + 3] = this.frameBuffer[from + 3];
      this.frameRead = (this.frameRead + 1) % frameFifoSize;
      ++count;
    }

    return count;
  }
}

//==============================================================================
// Test voice for the demo: a synthetic singer, deliberately off-key, over a pad that plays the
// chords in tune so the difference is audible. Same model as the C++ test suite's voice
// (tests/TestMain.cpp): a band-limited harmonic source with a 1/k roll-off through four formant
// resonators, plus breath, jitter and shimmer. The first phrase is the suite's off-key melody.

const LOOP_SECONDS = 11.2;

// start, end (s), note, cents off, vibrato depth (cents), vibrato onset (s), scoop (cents), vowel
const MELODY = [
  [0.1, 1.0, 57, +35, 0, 0, 0, "a"], // A3, 35 cents sharp
  [1.15, 2.05, 60, -28, 0, 0, 0, "o"], // C4, flat
  [2.2, 3.4, 64, +22, 25, 0, 0, "a"], // E4, sharp, with vibrato
  [3.55, 4.4, 55, -40, 0, 0, 0, "u"], // G3, very flat
  [4.55, 5.5, 62, +15, 0, 0, -100, "e"], // D4, scooping up from a semitone below
  [5.75, 6.45, 64, -30, 0, 0, -60, "a"], // E4, flat, scooped
  [6.55, 7.25, 62, +25, 0, 0, 0, "o"], // D4, sharp
  [7.35, 8.05, 60, -20, 0, 0, 0, "a"], // C4, flat
  [8.15, 10.4, 57, +20, 30, 0.45, 0, "a"], // A3, held, vibrato coming in late
];

const VOWELS = {
  a: [730, 1090, 2440, 3400],
  o: [570, 840, 2410, 3400],
  u: [300, 870, 2240, 3400],
  e: [530, 1840, 2480, 3500],
};

const FORMANT_BANDWIDTHS = [80, 90, 120, 150];

// start, end (s), notes (bass first). Am F C G Dm | C G Am F
const CHORDS = [
  [0.0, 1.1, [45, 52, 57, 60]],
  [1.1, 2.15, [41, 53, 57, 60]],
  [2.15, 3.5, [48, 52, 55, 60]],
  [3.5, 4.5, [43, 50, 55, 59]],
  [4.5, 5.7, [38, 53, 57, 62]],
  [5.7, 6.5, [48, 52, 55, 60]],
  [6.5, 7.3, [43, 50, 55, 59]],
  [7.3, 8.1, [45, 52, 57, 60]],
  [8.1, LOOP_SECONDS, [41, 53, 57, 60]],
];

const PAD_HARMONICS = [1, 0.32, 0.14, 0.05];
const VOICE_GAIN = 0.042; // peaks at about -6 dBFS (measured)
const PAD_GAIN = 0.055;

const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);

/** Deterministic noise so every loop (and every visitor) hears the same take. */
function makeGaussian(seed) {
  let state = seed >>> 0;
  let spare = null;

  const uniform = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }

    const u = Math.max(1e-12, uniform());
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

export class TestVoice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.loopLength = Math.round(LOOP_SECONDS * sampleRate);
    this.attack = 1 - Math.exp(-1 / (0.012 * sampleRate));
    this.release = 1 - Math.exp(-1 / (0.02 * sampleRate));
    this.slow = 1 - Math.exp((-2 * Math.PI * 40) / sampleRate);
    this.formantGlide = 1 - Math.exp(-16 / (0.04 * sampleRate)); // per 16-sample coefficient update
    this.inverse = new Float64Array(64);
    for (let k = 1; k < 64; ++k) this.inverse[k] = 1 / k;

    this.formants = Float64Array.from(VOWELS.a);
    this.a1 = new Float64Array(4);
    this.a2 = new Float64Array(4);
    this.b0 = new Float64Array(4);
    this.y1 = new Float64Array(4);
    this.y2 = new Float64Array(4);
    this.restart();
  }

  restart() {
    this.position = 0;
    this.noise = makeGaussian(1234);
    this.phase = 0;
    this.envelope = 0;
    this.lastFrequency = 220;
    this.wobbleF = 0;
    this.wobbleA = 0;
    this.y1.fill(0);
    this.y2.fill(0);
    this.updateResonators(VOWELS.a, true);
  }

  updateResonators(target, jump) {
    for (let i = 0; i < 4; ++i) {
      this.formants[i] += (target[i] - this.formants[i]) * (jump ? 1 : this.formantGlide);
      const r = Math.exp((-Math.PI * FORMANT_BANDWIDTHS[i]) / this.sampleRate);
      this.a1[i] = 2 * r * Math.cos((2 * Math.PI * this.formants[i]) / this.sampleRate);
      this.a2[i] = -r * r;
      this.b0[i] = 1 - this.a1[i] - this.a2[i]; // unity gain at DC
    }
  }

  /** Pitch (Hz) and vowel at time t, or 0 between notes. */
  static noteAt(t) {
    for (const [start, end, note, cents, vibrato, onset, scoop, vowel] of MELODY) {
      if (t >= start && t < end) {
        const age = t - start;
        let c = cents + vibrato * Math.min(1, Math.max(0, (age - onset) / 0.4)) * Math.sin(2 * Math.PI * 5.5 * Math.max(0, age - onset));

        if (scoop !== 0) c += scoop * Math.max(0, 1 - age / 0.15);

        return { hz: midiToHz(note + c / 100), vowel };
      }
    }

    return null;
  }

  /** Writes the next n samples of the loop into out. */
  render(out, n) {
    const sr = this.sampleRate;

    for (let i = 0; i < n; ++i) {
      if (this.position >= this.loopLength) this.restart();

      const t = this.position / sr;
      const sung = TestVoice.noteAt(t);
      const target = sung ? 1 : 0;
      this.envelope += (target - this.envelope) * (target > this.envelope ? this.attack : this.release);

      if (sung) this.lastFrequency = sung.hz;

      if ((this.position & 15) === 0 && sung) this.updateResonators(VOWELS[sung.vowel], false);

      // Low-passed noise drives jitter and shimmer.
      this.wobbleF += this.slow * (this.noise() * 3 - this.wobbleF);
      this.wobbleA += this.slow * (this.noise() * 3 - this.wobbleA);

      let source = 0;

      if (this.envelope > 1e-5) {
        const frequency = this.lastFrequency * (1 + 0.004 * this.wobbleF);
        this.phase += frequency / sr;
        this.phase -= Math.floor(this.phase);
        const harmonics = Math.min(60, Math.floor((0.45 * sr) / frequency));

        // sin (k theta) by the Chebyshev recurrence: one multiply-add per harmonic.
        const theta = 2 * Math.PI * this.phase;
        const twoCos = 2 * Math.cos(theta);
        let previous = 0;
        let current = Math.sin(theta);
        let sum = current;

        for (let k = 2; k <= harmonics; ++k) {
          const next = twoCos * current - previous;
          previous = current;
          current = next;
          sum += current * this.inverse[k];
        }

        source = this.envelope * ((1 + 0.05 * this.wobbleA) * sum + 0.024 * this.noise());
      }

      let y = source;

      for (let f = 0; f < 4; ++f) {
        const v = this.b0[f] * y + this.a1[f] * this.y1[f] + this.a2[f] * this.y2[f];
        this.y2[f] = this.y1[f];
        this.y1[f] = v;
        y = v;
      }

      out[i] = y * VOICE_GAIN;
      ++this.position;
    }
  }
}

function chordEnvelope(local, length) {
  if (local < 0) return 0;

  const held = Math.min(local, length);
  const level = Math.min(1, held / 0.08) * (0.7 + 0.3 * Math.exp(-held / 1.5));

  if (local <= length) return level;

  const after = local - length;
  return after > 1 ? 0 : level * Math.exp(-after / 0.22);
}

/** The pad at a point of the loop (sample index, wraps). A pure function of time, so it can be read
    at any delay: it follows the engine's latency the way a DAW delays the other tracks. */
export function padSample(index, sampleRate) {
  const loopLength = Math.round(LOOP_SECONDS * sampleRate);
  const wrapped = ((index % loopLength) + loopLength) % loopLength;
  let sum = 0;

  // The last chord rings over the loop point into the first.
  for (const t of [wrapped / sampleRate, (wrapped + loopLength) / sampleRate]) {
    for (const [start, end, notes] of CHORDS) {
      const env = chordEnvelope(t - start, end - start);

      if (env <= 0) continue;

      for (let n = 0; n < notes.length; ++n) {
        // Harmonics by the Chebyshev recurrence, as in the voice.
        const theta = 2 * Math.PI * midiToHz(notes[n]) * t;
        const twoCos = 2 * Math.cos(theta);
        let previous = 0;
        let current = Math.sin(theta);
        let tone = current;

        for (let h = 1; h < PAD_HARMONICS.length; ++h) {
          const next = twoCos * current - previous;
          previous = current;
          current = next;
          tone += PAD_HARMONICS[h] * current;
        }

        sum += env * (n === 0 ? 0.8 : 0.55) * tone;
      }
    }
  }

  return sum * PAD_GAIN;
}

//==============================================================================
// The AudioWorkletProcessor: plays a source (the test voice, an uploaded or recorded take, or the
// mic) through the engine, and posts the pitch frames back for the graph and tuner.

if (typeof registerProcessor === "function") {
  class SnapTuneProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.engine = new AutoTuneEngine();
      this.engine.setSettings({ ...DEFAULT_ENGINE_SETTINGS });
      this.engine.prepare(sampleRate, 1);
      this.voice = new TestVoice(sampleRate);
      this.source = "voice"; // "voice" | "input" | "buffer"
      this.buffer = null;
      this.bufferPosition = 0;
      this.backing = true;
      this.bypassed = false;
      this.mono = new Float32Array(128);
      this.channels = [this.mono];
      this.frames = new Float32Array(2048 * 4);
      this.batch = 0;
      this.voiceStart = 0; // voice position of mono[0] in the current block
      this.padLatency = this.engine.getLatencySamples();
      this.padFrom = this.padLatency;
      this.padFade = 1;
      this.recording = null;
      this.recorded = 0;
      this.port.onmessage = (event) => this.onMessage(event.data);
    }

    onMessage(m) {
      switch (m.type) {
        case "settings":
          this.engine.setSettings(m.settings);
          break;
        case "bypass":
          this.bypassed = m.value;
          break;
        case "backing":
          this.backing = m.value;
          break;
        case "source":
          // A new source starts from the top, through a cleared engine.
          this.source = m.kind;
          this.buffer = m.kind === "buffer" ? m.buffer : null;
          this.bufferPosition = 0;
          this.voice.restart();
          this.engine.reset();
          break;
        case "noteOn":
          this.engine.noteOn(m.note);
          break;
        case "noteOff":
          this.engine.noteOff(m.note);
          break;
        case "allNotesOff":
          this.engine.allNotesOff();
          break;
        case "record":
          this.recording = new Float32Array(Math.ceil(m.seconds * sampleRate));
          this.recorded = 0;
          break;
        case "stopRecording":
          this.finishRecording();
          break;
      }
    }

    finishRecording() {
      if (!this.recording) return;

      const take = this.recording.slice(0, this.recorded);
      this.recording = null;
      this.port.postMessage({ type: "recorded", buffer: take }, [take.buffer]);
    }

    process(inputs, outputs) {
      const out = outputs[0];
      const n = out[0].length;

      if (this.mono.length !== n) {
        this.mono = new Float32Array(n);
        this.channels = [this.mono];
      }

      const mono = this.mono;
      const input = inputs[0] && inputs[0].length > 0 ? inputs[0][0] : null;

      if (this.recording && input) {
        const count = Math.min(n, this.recording.length - this.recorded);
        this.recording.set(input.subarray(0, count), this.recorded);
        this.recorded += count;

        if (this.recorded >= this.recording.length) this.finishRecording();
      }

      if (this.source === "voice") {
        this.voiceStart = this.voice.position;
        this.voice.render(mono, n);
      } else if (this.source === "buffer" && this.buffer && this.buffer.length > 0) {
        for (let i = 0; i < n; ++i) {
          mono[i] = this.buffer[this.bufferPosition];
          if (++this.bufferPosition >= this.buffer.length) this.bufferPosition = 0;
        }
      } else if (this.source === "input" && input) {
        mono.set(input);
      } else {
        mono.fill(0);
      }

      this.engine.process(this.channels, 1, 0, n, this.bypassed);

      const left = out[0];
      left.set(mono);

      // The pad is read as far behind the voice as the engine delays it, like a DAW's delay
      // compensation; a change of latency (Studio <-> Live) crossfades to the new position.
      if (this.source === "voice" && this.backing) {
        const latency = this.engine.getLatencySamples();

        if (latency !== this.padLatency) {
          this.padFrom = this.padLatency;
          this.padLatency = latency;
          this.padFade = 0;
        }

        const fadeStep = 1 / Math.max(1, Math.round(0.01 * sampleRate));

        for (let i = 0; i < n; ++i) {
          const index = this.voiceStart + i;
          let pad = padSample(index - this.padLatency, sampleRate);

          if (this.padFade < 1) {
            pad = pad * this.padFade + padSample(index - this.padFrom, sampleRate) * (1 - this.padFade);
            this.padFade = Math.min(1, this.padFade + fadeStep);
          }

          left[i] += pad;
        }
      }

      for (let c = 1; c < out.length; ++c) out[c].set(left);

      this.batch += this.engine.popFrames(this.frames.subarray(this.batch * 4), 2048 - this.batch);

      // About 60 posts a second.
      if (this.batch >= Math.ceil(this.engine.getFramesPerSecond() / 60)) {
        const data = this.frames.slice(0, this.batch * 4);
        this.port.postMessage({ type: "frames", data, count: this.batch }, [data.buffer]);
        this.batch = 0;
      }

      return true;
    }
  }

  registerProcessor("snaptune", SnapTuneProcessor);
}
