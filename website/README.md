# SnapTune website

The download page for SnapTune: Next.js, exported as static HTML.

```sh
npm install
npm run dev      # http://localhost:3000, shows placeholders for missing demo media
npm run build    # static site in out/
```

- The version and download link come from `project(SnapTune VERSION …)` in `../CMakeLists.txt`, so a release needs no change here.
- Ko-fi link and the Apple Developer Program goal live in `lib/site.ts`. Update `raised` by hand; the progress bar stays hidden at 0.
- Set `SITE_URL` (e.g. `https://snaptune.example`) when building outside Vercel so the social preview image gets an absolute URL.

## The playable plugin window

The hero is the SnapTune window rebuilt in HTML and SVG (`components/demo/`), running the real engine in an AudioWorklet. Visitors can play a test voice, sing into their mic (live with headphones, or record a 10 s take), or open their own file.

- `public/snaptune-worklet.js` is a line-by-line port of `../Source/dsp` (Scales, PitchDetector, AutoTuneEngine). Checked against the compiled C++ engine on test melodies and speech, in both modes and at 44.1 and 48 kHz: the output matched to 88–98 dB SNR, with the same voicing and target note on every frame. When the C++ changes, port the change.
- The same file holds the test voice: a synthesized singer, off-key on purpose, over chords played in tune. The page says it's synthesized.
- Before anyone presses play, the window shows the first 4 seconds of the test voice through the engine. After changing the engine, the test voice or the demo's default settings (`components/demo/model.ts`), refresh that with `npm run demo-frames`, which writes `lib/demo-frames.json`.
- Layout: from 840 px wide it's the plugin's own 1000 × 640 layout, scaled. Narrower, the same panels stack.

## Demo media

Sections with missing files are left out of the build, and shown as dashed "needs proof" boxes in `npm run dev`.

| File | What it is |
| --- | --- |
| `public/audio/hard-tune-dry.mp3`, `public/audio/hard-tune-tuned.mp3` | 8–10 s of a real dry vocal, then the same file through the Hard Tune preset |
| `public/audio/melodic-trap-{dry,tuned}.mp3` | Same, Melodic Trap |
| `public/audio/natural-{dry,tuned}.mp3` | Same, Natural |
| `public/midi-demo.mp4` | 10–15 s screen recording: FL Studio's piano roll driving SnapTune's pitch graph |

Each dry/tuned pair must be the same length and start at the same moment: the player plays both and switches which one you hear.
