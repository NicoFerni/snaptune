# Rendering with SnapTune on a server

SnapTune runs as a headless worker on Linux: a service loads the VST3, applies fixed settings and
renders vocal files offline, with no display, no DAW and no audio device. This guide covers the
setup and the two things a server integration has to get right. CI checks all of it on every build
(`tests/server_test.py`, on x86_64 and arm64).

## Requirements

- Linux, x86_64 or arm64 (aarch64), glibc 2.35 or newer: Ubuntu 22.04, Debian 12, Fedora 36 or
  later, and the matching `python:3.x-slim` images.
- From a release, `SnapTune-<version>-Linux.tar.gz` (x86_64) or `-Linux-arm64.tar.gz` (arm64).
  Only `SnapTune.vst3` is needed on a server.
- On a minimal image, the libraries the plugin links: `libfreetype6` and `libfontconfig1`
  (`apt-get install libfreetype6 libfontconfig1`). X11 libraries are loaded only when an editor
  window opens, so no X server is needed.

## Rendering a file from Python

[pedalboard](https://github.com/spotify/pedalboard) (`pip install pedalboard numpy`) hosts VST3
plugins from Python:

```python
import numpy as np
from pedalboard import load_plugin
from pedalboard.io import AudioFile

SAMPLE_RATE = 48000

def snaptune(path, sample_rate=SAMPLE_RATE, **settings):
    plugin = load_plugin(path)
    for name, value in settings.items():
        setattr(plugin, name, value)
    # Warm-up: see "Latency compensation" below.
    plugin(np.zeros((1, sample_rate // 10), np.float32), sample_rate)
    return plugin

tuner = snaptune("/opt/snaptune/SnapTune.vst3", key="A", scale="Minor", retune_speed_ms="10 ms")

with AudioFile("vocal.wav").resampled_to(SAMPLE_RATE) as f:
    audio = f.read(f.frames)

tuned = tuner(audio, SAMPLE_RATE)   # same length as the input, already latency-compensated

with AudioFile("vocal_tuned.wav", "w", SAMPLE_RATE, tuned.shape[0]) as f:
    f.write(tuned)
```

The instance can be reused for any number of files at the same sample rate: pedalboard resets it
between calls, and the same input always gives the same output.

`print(tuner.parameters)` lists every parameter with its valid values. Most take numbers
(`amount=80.0`, `formant_st=-1.5`); `key`, `scale`, `voice` and `latency_mode` take their names, and
`retune_speed_ms` takes the text the plugin shows: `"Hard"` or `"0 ms"` to `"400 ms"`. pedalboard
builds that list by sampling the knob, which is logarithmic, so a few values near the top of the
range are missing (`"375 ms"`, for one); pick a neighbour.

Use the default **Studio** latency mode for offline work: it looks ahead about 46 ms and tracks
pitch better. **Live** is for real-time monitoring only.

## Latency compensation: warm up each new instance

SnapTune's latency depends on the sample rate (2037 samples at 44.1 kHz, 2217 at 48 kHz, 4431 at
96 kHz). pedalboard loads a plugin at 44.1 kHz and, on the first render at another rate, still
compensates with the 44.1 kHz figure: that first file comes out late by the difference, 180 samples
(3.75 ms) at 48 kHz, 2394 samples (50 ms) at 96 kHz, enough to put a vocal visibly out of time
with the rest of a mix. Every later render is right.

Render a tenth of a second of silence at the job's sample rate right after loading, as in the
example above, and every render is aligned sample for sample. If one worker handles several
sample rates, keep one instance per rate (or resample everything to one rate).

Other hosts: report the plugin's latency to your own pipeline only after preparing it at the final
sample rate.

## Parallel jobs: start workers with spawn, not fork

Each worker process can hold its own instance; renders run well above real time per core and use
no shared state. But a process forked from one that has already loaded the plugin hangs the first
time it creates an instance: JUCE's message thread exists only in the parent, and the child waits
for it forever. This applies to every JUCE-based plugin.

Start workers with spawn, or load the plugin only in the workers:

```python
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor

pool = ProcessPoolExecutor(max_workers=8, mp_context=mp.get_context("spawn"))
```

With Celery, RQ, gunicorn and other prefork servers, create the instance inside each worker after
it starts (Celery's `worker_process_init` signal, for example), never at import time in the
master process.

## Usage pings

On the first instance in each process, SnapTune sends one anonymous ping (version, OS, host name,
plugin format) to getsnaptune.com; no audio or file information is sent. Turn it off with the
`SNAPTUNE_NO_TELEMETRY=1` environment variable, or a file named `no-telemetry` in
`~/.config/SnapTune`. The update check is off with it.

## Checking a server

From a source build, two checks run on a machine with no display:

```sh
python tests/server_test.py /opt/snaptune/SnapTune.vst3
build/SnapTuneTests_artefacts/Release/SnapTuneTests --host /opt/snaptune/SnapTune.vst3
```

The first renders through pedalboard (alignment at 44.1, 48 and 96 kHz, pitch correction, parallel
workers); the second loads the plugin in a JUCE host, checks it corrects pitch and reports its
latency in both modes, and skips the editor check when there is no display.

## License

SnapTune is AGPL-3.0. To build it into a proprietary service without AGPL obligations, a commercial
license is available: write to support@getsnaptune.com.
