# SnapTune promo video

A 30-second promo, 1920 × 1080 at 60 fps: SnapTune's window, animated by what the engine actually
did, over a soundtrack rendered by the same engine.

```sh
npm install
npm run render     # soundtrack, then video -> out/snaptune-promo.mp4
npm run loop       # the silent 10 s film on the website's cover, and its poster frame
npm run studio     # preview and scrub in the browser (run `npm run audio` first)
```

- `src/timeline.ts` is the beat, the melody the test voice sings, and what the plugin is set to at
  each moment. The soundtrack and the picture both read it.
- `scripts/render-audio.ts` runs the website's test voice through the engine
  (`../website/public/snaptune-worklet.js`, the port of `Source/dsp`), synthesizes the beat and mixes
  it to -14 LUFS. It writes `public/soundtrack.wav` and `src/frames.json` (the pitch frames the
  graph and tuner draw).
- `src/Promo.tsx` is the shots: which part of the window is on screen, and the numbers and lines set
  next to it. `Loop` is the cover film for the website (`../website/public/media/`).
- `src/brand.tsx` is the look, the same as the website and the plugin: bottle green and gold, ivory
  for paper. The mark is a cent sign drawn as a tuner; cards are laid down like printed sheets; text
  settles like a note under hard tune. Type: Rokkitt for display and Literata for text (both SIL
  OFL, licences in `public/fonts`).
- The window is the website's demo (`../website/components/demo`), so UI changes there show up here
  on the next render.

You hear a synth lead, not a singer: it plays the pitch the engine measured and put out for the
website's test voice, off-key until the drop and tuned after it. The video says it's a test melody.
