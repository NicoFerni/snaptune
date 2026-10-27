# SnapTune

[![Build](https://github.com/NicoFerni/snaptune/actions/workflows/build.yml/badge.svg)](https://github.com/NicoFerni/snaptune/actions/workflows/build.yml)
[![Latest release](https://img.shields.io/github/v/release/NicoFerni/snaptune)](https://github.com/NicoFerni/snaptune/releases/latest)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/nicofernandev)

**Open-source real-time pitch correction for your DAW.** From the robotic hard-tune snap to
transparent correction, with a formant-preserving Studio mode and a 2.7 ms Live mode for tracking.
VST3 + Audio Unit for macOS (Apple Silicon and Intel), VST3 for Windows (64-bit), VST3 + LV2 for
Linux (64-bit).
Try it in your browser at **[getsnaptune.com](https://getsnaptune.com)**.

![SnapTune](docs/screenshot.png)

## Features

- **Hard tune to natural:** Retune Speed from 0 ms (instant snap, the T-Pain sound) to slow, vibrato-friendly correction, plus Humanize for long notes
- **Formant-preserving:** pitch moves, your voice's character doesn't (no chipmunk). A Formant knob shifts it on purpose
- **Studio and Live modes:** 46 ms formant-safe processing for mixing (compensated by the DAW), or 2.7 ms for hearing yourself tuned while recording. Switch any time; the DAW is told the new latency automatically
- **Key and scale:** 13 scales, or click the note pills to build your own
- **MIDI target notes:** play or draw a melody and the voice follows it
- **See what it's doing:** a tuner gauge (where you sang vs. where it lands) and a piano-roll pitch graph
- **Factory presets:** Hard Tune, Melodic Trap, Natural, Subtle Polish, Deep Robot, Bright Pop
- Resizable window (91 % to 150 %), tooltips on every control, under 1 % CPU

## Download

Get the installer for your system from the [latest release](https://github.com/NicoFerni/snaptune/releases/latest):

**macOS 11+** (Apple Silicon and Intel): **SnapTune-…-macOS.pkg** installs the VST3, the Audio Unit
and a standalone app.

1. Open the .pkg. It isn't notarized by Apple yet, so macOS blocks it the first time: click **Done**,
   then **System Settings > Privacy & Security > Open Anyway** (on macOS 14 or earlier, right-click
   the .pkg and choose **Open**).
2. Restart your DAW and rescan plugins.

**Windows 10+** (64-bit): **SnapTune-…-Windows-Setup.exe** installs the VST3 in
`C:\Program Files\Common Files\VST3` and a standalone app.

1. Run the installer. It isn't code-signed yet, so SmartScreen may say "Windows protected your PC":
   click **More info > Run anyway**.
2. Restart your DAW and rescan plugins.

**Linux** (64-bit, glibc 2.35 or newer: Ubuntu 22.04, Debian 12, Fedora 36 or later):
**SnapTune-…-Linux.tar.gz** has the VST3, the LV2 and a standalone app.

1. Unpack it, open a terminal in the folder and run `./install.sh`. It installs for your user, no
   sudo: the VST3 in `~/.vst3`, the LV2 in `~/.lv2` and the app in `~/.local/bin`.
2. Restart your DAW and rescan plugins. The Linux builds are new; if your DAW has trouble,
   [open an issue](https://github.com/NicoFerni/snaptune/issues) with the DAW and your distribution.

For macOS and Windows there is also a zip for installing by hand; its INSTALL.txt has the steps.

The macOS warning goes away once SnapTune is notarized, which needs the $99/year Apple Developer
membership. If SnapTune is useful to you, you can [chip in on Ko-fi](https://ko-fi.com/nicofernandev).

## Build from source

Takes about two minutes:

```sh
brew install cmake ninja          # plus Xcode or the Xcode command-line tools
git clone https://github.com/NicoFerni/snaptune.git && cd snaptune
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --target SnapTune_VST3 SnapTune_AU SnapTune_Standalone
```

JUCE 9.0.4 is downloaded automatically during the first configure. The build installs
`SnapTune.vst3` to `~/Library/Audio/Plug-Ins/VST3` and `SnapTune.component` to
`~/Library/Audio/Plug-Ins/Components`; then rescan plugins in your DAW. `SnapTune.app` (Standalone,
in `build/SnapTune_artefacts/Release/Standalone`) lets you try it with a microphone, no DAW needed;
use headphones.

On Linux (Ubuntu or Debian; other distributions have the same libraries under their own names), the
build copies the VST3 to `~/.vst3` and the LV2 to `~/.lv2`:

```sh
sudo apt install cmake ninja-build g++ pkg-config libasound2-dev libjack-jackd2-dev ladspa-sdk \
  libcurl4-openssl-dev libfreetype-dev libfontconfig1-dev libx11-dev libxcomposite-dev \
  libxcursor-dev libxext-dev libxinerama-dev libxrandr-dev libxrender-dev libxi-dev
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --target SnapTune_VST3 SnapTune_LV2 SnapTune_Standalone
```

On Windows, with Visual Studio 2022 or later and CMake, from a terminal run as administrator (the
build copies the VST3 into `C:\Program Files\Common Files\VST3`):

```sh
cmake -B build -A x64
cmake --build build --config Release --target SnapTune_VST3 SnapTune_Standalone
```

## Quick start (FL Studio)

1. **Options > Manage plugins > Find installed plugins**, then load SnapTune on the vocal's mixer insert.
2. Set **Key** and **Scale** to the song (Chromatic if you don't know it).
3. Pick a preset: **Hard Tune** for the robotic effect, **Melodic Trap** for tight modern vocals, **Natural** for invisible correction.
4. Set **Voice** to match the singer (Low Male for deep voices).
5. Use **Live** while recording and **Studio** when mixing.

**MIDI target notes in FL Studio:** in SnapTune's wrapper (gear icon) set *MIDI input port* to a free
number, add a **MIDI Out** channel on the same port, write the melody in its piano roll, and turn on
**MIDI notes**. While notes are held the voice is tuned to them (any octave); otherwise it uses the scale.

## Controls

| Control | What it does |
| --- | --- |
| Presets | Starting points for the correction knobs. Key, scale and voice are left alone. |
| Studio / Live | Studio: TD-PSOLA, formant-safe, 46 ms. Live: delay-line resampling, 2.7 ms (Formant is inactive). |
| Key / Scale | The notes the voice may land on. |
| Scale notes | Lit = in the scale, solid = the note being tuned to now, violet dot = held MIDI note. Click to toggle. |
| MIDI notes | Tune to held MIDI notes instead of the scale. |
| Retune Speed | Time to reach the note. 0 ms = instant (hard tune); slower keeps slides and vibrato. |
| Humanize | Relaxes the correction on sustained notes. |
| Amount | How much of the pitch error is corrected. |
| Formant | Shifts the vocal character ±5 semitones without changing pitch (Studio only). |
| Tracking | Higher treats breathy or noisy singing as pitched; lower is stricter. |
| Mix | Dry/wet, latency-aligned. |
| Voice | Detection range: Soprano 110–1400 Hz, Alto/Tenor 75–1000 Hz, Low Male 65–600 Hz, Instrument 65–1600 Hz. |
| Pitch graph | The note range stays still while you sing. Scroll or drag to move it (it then stays put); double-click to follow the singer again. |

## Troubleshooting

- **The graph shows only dots, or nothing gets corrected.** SnapTune needs the vocal on its own: put it on
  the vocal's mixer track, not on the beat or the master. If the voice is breathy or the room is
  live, raise **Tracking**; for deep voices choose **Voice: Low Male**.
- **An update doesn't show up.** Your DAW keeps the old plugin loaded until it restarts: quit it
  completely and open it again after rebuilding.
- **Something else.** [Open an issue](https://github.com/NicoFerni/snaptune/issues) or write to
  [support@getsnaptune.com](mailto:support@getsnaptune.com), with your DAW, its version and your system.

## Usage data

Once per DAW session SnapTune sends an anonymous ping so I can see which versions, systems and DAWs
it runs on, and whether sessions end in a crash: the plugin version, OS name, CPU type (arm64/x64),
the DAW's name, the plugin format, and a random install id. Nothing about your audio, your projects
or your settings is sent, and no IP address is stored (only the country). The code is in
`Source/Telemetry.cpp`.

To turn it off, create an empty file named `no-telemetry` in the SnapTune folder
(`~/Library/Application Support/SnapTune` on a Mac, `%APPDATA%\SnapTune` on Windows,
`~/.config/SnapTune` on Linux), or set the environment variable `SNAPTUNE_NO_TELEMETRY=1`. On Linux
the ping goes out only if libcurl is installed; SnapTune doesn't need it otherwise.

When the window opens, SnapTune also asks `getsnaptune.com/api/version` for the latest release, at
most once a day, and shows "SnapTune x.y is out" in the header when there's a newer one; clicking it
opens the download page. Nothing is sent with that request, and the same opt-out turns it off
(`Source/UpdateCheck.cpp`).

## How it works

1. **Pitch detection: YIN** (de Cheveigné & Kawahara, 2002). Every 2.7 ms the plugin computes the
   squared-difference function `d(τ) = Σ (x[j] − x[j+τ])²` over the newest audio, normalises it by its
   running mean (the CMNDF, which removes the zero-lag bias of plain autocorrelation), and takes the
   *first* dip below an absolute threshold. Taking the first dip rather than the deepest avoids octave
   errors, and parabolic interpolation gives sub-sample accuracy (< 0.1 cent on steady tones). `d(τ)` is
   computed with FFT cross-correlation plus prefix sums: three real FFTs per analysis. The original
   Auto-Tune (US patent 5,973,252) also detects pitch by autocorrelation. Within a note the period
   being tracked carries the voice through brief dips in periodicity, and a sudden octave jump has to
   beat it: a strong second harmonic or breath noise otherwise makes a note read an octave off for a
   few hops.
2. **Note selection.** The detected pitch is snapped to the nearest allowed note, with 0.12 semitone
   hysteresis so a voice halfway between two notes doesn't flicker. In Live mode, whose shorter
   analysis is noisier, a breathy voice's note is chosen from a lightly smoothed pitch (at most ~8 ms
   later). A dropout of up to 40 ms inside a note doesn't restart it: if the voice comes back on the
   same pitch, the note resumes with its target and correction instead of gliding in again.
3. **Retune speed.** The correction (target − detected) passes through a one-pole smoother whose time
   constant is a third of the retune time. At 0 ms it jumps instantly (the stair-step effect); slower
   settings act like a high-pass on the pitch curve, so vibrato passes through while drift is corrected.
4. **Studio mode: TD-PSOLA.** Pitch marks are placed one period apart, each where its cycle best
   matches the previous one (normalised cross-correlation) and pulled gently toward the same waveform
   peak, so breath noise or the formant ripples of a low voice can't make a mark jump to a neighbouring
   peak. When the detector briefly locks onto a harmonic or a sub-harmonic, the harmonics present in
   the waveform decide which period the marks follow. Two-period grains (asymmetric Hann windows)
   centred on the marks are overlap-added at the corrected spacing. Because grains are re-spaced rather
   than resampled, the formants stay put. Unpitched sounds pass through uncorrected. Where the voice
   turns unpitched, or the detector loses it for a moment mid-note, they keep the voiced grains'
   alignment and return to the input's timing gradually (at once where it is quiet, or below 100% Mix),
   so at 100% Mix the hand-over doesn't crossfade two copies of the voice a fraction of a period apart.
   Grains need to see past the note they rebuild: for the lowest note (65 Hz) that is
   3 × 15.4 ms = 46 ms, reported to the host for compensation.
5. **Live mode: pitch-synchronous resampling** (the original Auto-Tune method). The input is read
   through a delay line at the corrected speed; when the read point drifts a full cycle it jumps back or
   forward exactly one period (found by cross-correlation, crossfaded), so the delay stays under one
   period. Between notes it returns to the reported latency in near silence, or in breaths and
   consonants once the pitch has been gone for ~20 ms; otherwise it keeps its delay (about a period at
   most). With no look-ahead, it analyses a shorter window (1.5 periods, up to 2.5 for a breathy voice,
   within ~5-15 ms) and extrapolates the correction across the detector's delay so vibrato is still
   caught, scaling the extrapolation down when the estimate is noisy. Formants move with the correction,
   which is inaudible for ±1 semitone tuning, so use Studio for big MIDI jumps.

## Project layout

```
Source/dsp/     PitchDetector (YIN) and AutoTuneEngine (both modes); no UI code
Source/ui/      LookAndFeel, tuner gauge, pitch graph, note pills, main view
Source/         plugin processor, parameters, presets, editor shell, usage pings (Telemetry)
tests/          offline test runner (DSP suite, plugin host test, file processing, UI snapshots)
packaging/      install notes and release text shipped with each release
.github/        CI: builds, tests and packages every push; tags publish a release
```

## Releasing

Bump `project(SnapTune VERSION x.y.z)` in `CMakeLists.txt` (and `versionText` in `Source/ui/MainView.cpp`),
commit, then push a matching tag: `git tag vx.y.z && git push origin vx.y.z`. CI builds and tests it,
then publishes the zip on the Releases page.

## Tests

```sh
cmake --build build --target SnapTuneTests
./build/SnapTuneTests_artefacts/Release/SnapTuneTests --out build/demo        # DSP suite + demo WAVs
./build/SnapTuneTests_artefacts/Release/SnapTuneTests --host ~/Library/Audio/Plug-Ins/VST3/SnapTune.vst3
./build/SnapTuneTests_artefacts/Release/SnapTuneTests --process in.wav out.wav --key A --scale Minor --retune 0 --mode live
./build/SnapTuneTests_artefacts/Release/SnapTuneTests --snapshot ui.png studio 1.0 4   # 4000 x 2560 render
(cd website && npm run shots)                                                    # README + site images
auval -v aumf Snpt Ncfz
```

The suite renders a synthetic singer (band-limited glottal source through formant resonators) singing an
off-key melody and checks, with an independent pitch tracker, that (in both modes unless marked):
- notes land within 1 cent
- retune speed keeps or removes vibrato as intended
- scales, fast glides and MIDI targets snap correctly
- a breathy note held near the switching point keeps its target (a few note flips at most; the old
  Live engine had 85)
- a short dropout inside a note doesn't make the correction glide in again
- formants stay in place
- unpitched audio passes through bit-exact
- low voices work, splices stay clean, detached notes start cleanly (Live), and mode switching is safe
- octave leaps are followed (also onto /u/, whose first formant sits on the low note's second harmonic)
- a brief octave slip of the detector, or a fast leap up, leaves the grains whole (Studio)
- output doesn't depend on block size, and CPU stays low

The host test loads the built VST3/AU, and checks that switching mode while running tells the host the new latency.

## License

SnapTune is free software under the [GNU Affero General Public License v3.0](LICENSE). It is built
with [JUCE](https://juce.com), used under the same AGPLv3 terms. The interface is set in Rokkitt and
Literata, both under the SIL Open Font License 1.1 (licences in `Source/fonts`). "Auto-Tune" is a
trademark of Antares Audio Technologies; SnapTune is not affiliated with Antares.

## References

- A. de Cheveigné, H. Kawahara, "YIN, a fundamental frequency estimator for speech and music", JASA 111(4), 2002
- H. Hildebrand, US patent 5,973,252, "Pitch detection and intonation correction apparatus and method"
- E. Moulines, F. Charpentier, "Pitch-synchronous waveform processing techniques for text-to-speech synthesis using diphones", Speech Communication 9, 1990
- P. McLeod, G. Wyvill, "A smarter way to find pitch", ICMC 2005
