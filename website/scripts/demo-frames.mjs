// Runs the start of the demo's test voice through the engine and saves the pitch frames, so the demo
// on the page opens on a real picture before anyone presses play. Run after changing the engine, the
// test voice or the demo's default settings:
//
//   npm run demo-frames
//
// Writes lib/demo-frames.json.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { AutoTuneEngine, TestVoice } from "../public/snaptune-worklet.js";
import { DEFAULT_PARAMS, engineSettings } from "../components/demo/model.ts";

const sampleRate = 48000;
const seconds = 4.15; // ends on the flat G3, the moment the plugin screenshots show
const block = 128;

const voice = new TestVoice(sampleRate);
const engine = new AutoTuneEngine();
engine.setSettings(engineSettings(DEFAULT_PARAMS));
engine.prepare(sampleRate, 1);

const audio = new Float32Array(block);
const scratch = new Float32Array(2048 * 4);
const frames = [];

for (let done = 0; done < seconds * sampleRate; done += block) {
  voice.render(audio, block);
  engine.process([audio], 1, 0, block);
  const count = engine.popFrames(scratch, 2048);

  for (let i = 0; i < count; ++i) {
    const [input, output, target, voiced] = scratch.subarray(i * 4, i * 4 + 4);
    frames.push(voiced > 0.5 ? [Number(input.toFixed(3)), Number(output.toFixed(3)), target] : 0);
  }
}

const file = join(import.meta.dirname, "..", "lib", "demo-frames.json");
writeFileSync(file, JSON.stringify({ framesPerSecond: engine.getFramesPerSecond(), frames }) + "\n");
console.log(`${frames.length} frames (${frames.filter(Boolean).length} voiced) -> lib/demo-frames.json`);
