# SnapTune website

The download page for SnapTune, plus the plugin's usage-ping API and a private admin panel. Next.js on Vercel.

```sh
npm install
npm run dev      # http://localhost:3000, shows placeholders for missing demo media
npm run build
```

- The version and download link come from `project(SnapTune VERSION …)` in `../CMakeLists.txt`, so a release needs no change here.
- Ko-fi link and the Apple Developer Program goal live in `lib/site.ts`. Update `raised` by hand; the progress bar stays hidden at 0.
- Set `SITE_URL` (e.g. `https://snaptune.example`) when building outside Vercel so the social preview image gets an absolute URL.

## Admin panel and usage pings

`/admin` shows plugin usage (installs, active installs, sessions per day, unclean exits, OS, DAW, version,
format, country), downloads per release and OS, and GitHub issues. The plugin posts one ping per DAW
session to `/api/ping` (`app/api/ping/route.ts`, sender in `../Source/Telemetry.cpp`).

Vercel environment variables:

| Variable | What it does |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis, set by adding Upstash from the Vercel Marketplace. Without it the panel shows only GitHub data and pings get a 503. |
| `ADMIN_PASSWORD` | Password for `/admin` (HTTP Basic auth, any user name; `proxy.ts`). Without it `/admin` is a 404. |
| `GITHUB_TOKEN` | Optional. Raises GitHub's API limit (60 requests/hour per IP without it; the panel caches for 5 minutes). |

"Unclean exit" means a session whose SnapTune never shut down: the DAW or the plugin crashed, or the DAW
was killed. Some DAWs exit without unloading plugins, which also counts, so watch for clusters on one
version or host rather than the raw number.

To test a plugin build against a local server: `SNAPTUNE_TELEMETRY_URL=http://localhost:3000/api/ping`.

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
