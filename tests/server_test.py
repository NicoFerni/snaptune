"""Server-side checks for the SnapTune VST3: loaded from Python with pedalboard, with no display,
the way a hosted service renders vocal stems (docs/server-rendering.md).

    pip install pedalboard numpy
    python tests/server_test.py build/SnapTune_artefacts/Release/VST3/SnapTune.vst3

Checks that the plugin loads without a display, that a warmed-up instance renders time-aligned
with the input at common sample rates, that it actually corrects pitch, and that parallel worker
processes give identical output. Exits non-zero on any failure.
"""

import multiprocessing as mp
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from pedalboard import load_plugin

PLUGIN = sys.argv[1] if len(sys.argv) > 1 else "build/SnapTune_artefacts/Release/VST3/SnapTune.vst3"
failures = 0


def check(ok, name, detail):
    global failures
    failures += not ok
    print(f"[{'PASS' if ok else 'FAIL'}] {name:<46} {detail}", flush=True)


def load(sample_rate, **settings):
    """A ready-to-use instance: settings applied, then warmed up at the job's sample rate so the
    host's latency compensation uses the latency for that rate from the first job on."""
    plugin = load_plugin(PLUGIN)
    for name, value in settings.items():
        setattr(plugin, name, value)
    plugin(np.zeros((1, sample_rate // 10), np.float32), sample_rate)
    return plugin


def voice(sample_rate, seconds, hz):
    """A sung-like tone: harmonics, slow vibrato, a swell in and out, and a little breath noise."""
    t = np.arange(int(sample_rate * seconds)) / sample_rate
    f = hz * (1 + 0.003 * np.sin(2 * np.pi * 5 * t))
    phase = 2 * np.pi * np.cumsum(f) / sample_rate
    tone = sum(np.sin(k * phase) / k for k in range(1, 8))
    envelope = np.minimum(1, np.minimum(t, seconds - t) / 0.3)
    noise = np.random.default_rng(1).normal(0, 0.01, t.size)
    return (0.25 * tone * envelope + noise).astype(np.float32)[np.newaxis, :]


def fundamental(signal, sample_rate):
    """Median pitch, by autocorrelation over 40 ms frames, of the steady middle of the signal."""
    x = signal[0, signal.shape[1] // 4 : 3 * signal.shape[1] // 4]
    frame, pitches = int(0.04 * sample_rate), []
    lo, hi = int(sample_rate / 1000), int(sample_rate / 70)
    for start in range(0, x.size - frame, frame):
        w = x[start : start + frame] - x[start : start + frame].mean()
        ac = np.correlate(w, w, "full")[frame - 1 :]
        lag = lo + int(np.argmax(ac[lo:hi]))
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
        lag += 0.5 * (a - c) / (a - 2 * b + c)
        pitches.append(sample_rate / lag)
    return float(np.median(pitches))


def render_job(seed):
    sample_rate = 48000
    plugin = load(sample_rate, scale="Chromatic", retune_speed_ms="Hard")
    out = plugin(voice(sample_rate, 3.0, 452.0 + seed % 2), sample_rate)
    return np.round(out, 6).tobytes()


if __name__ == "__main__":
    print("DISPLAY:", os.environ.get("DISPLAY") or "none")

    plugin = load_plugin(PLUGIN)
    check(len(plugin.parameters) > 20, "Server: load without a display", f"{len(plugin.parameters)} parameters")
    del plugin

    # With Mix at 0 the plugin passes the dry signal through its latency: a compensated render must
    # come back sample for sample.
    for sample_rate in (44100, 48000, 96000):
        dry = voice(sample_rate, 2.0, 220.0)
        out = load(sample_rate, mix=0.0)(dry, sample_rate)
        error = float(np.max(np.abs(out - dry)))
        check(out.shape == dry.shape and error < 1e-4, f"Server: aligned with the input at {sample_rate} Hz", f"max difference {error:.1e}")

    # A4 sung 47 cents sharp, chromatic scale, hard tuning: it must come out on A4.
    sample_rate = 48000
    sharp = voice(sample_rate, 3.0, 452.0)
    out = load(sample_rate, scale="Chromatic", retune_speed_ms="Hard")(sharp, sample_rate)
    cents = 1200 * np.log2(fundamental(out, sample_rate) / 440.0)
    check(abs(cents) < 5, "Server: corrects pitch", f"in {1200 * np.log2(452 / 440):+.0f} ct, out {cents:+.1f} ct from A4")

    # Several worker processes, started with spawn (a fork of a process that already loaded a JUCE
    # plugin waits forever for a message thread that isn't there).
    with ProcessPoolExecutor(max_workers=4, mp_context=mp.get_context("spawn")) as pool:
        outputs = list(pool.map(render_job, [0, 2, 4, 6]))
    check(len(set(outputs)) == 1, "Server: parallel workers give identical output", f"{len(outputs)} processes")

    print("ALL PASSED" if failures == 0 else f"{failures} FAILURE(S)")
    sys.exit(1 if failures else 0)
