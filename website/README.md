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

## Demo media

Sections with missing files are left out of the build, and shown as dashed "needs proof" boxes in `npm run dev`.

| File | What it is |
| --- | --- |
| `public/audio/hard-tune-dry.mp3`, `public/audio/hard-tune-tuned.mp3` | 8–10 s of a real dry vocal, then the same file through the Hard Tune preset |
| `public/audio/melodic-trap-{dry,tuned}.mp3` | Same, Melodic Trap |
| `public/audio/natural-{dry,tuned}.mp3` | Same, Natural |
| `public/midi-demo.mp4` | 10–15 s screen recording: FL Studio's piano roll driving SnapTune's pitch graph |

Each dry/tuned pair must be the same length and start at the same moment: the player plays both and switches which one you hear.
