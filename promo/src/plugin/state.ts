import { GraphModel } from "../../../website/components/demo/PitchGraph";
import { GaugeModel } from "../../../website/components/demo/TunerGauge";
import { pitchClass } from "../../../website/components/demo/model";
import recorded from "../frames.json";
import { FPS } from "../timeline";

// The editor's 60 Hz timer (MainView::timerCallback, tick() in the website's demo), replayed over the
// pitch frames the engine produced in scripts/render-audio.ts: each video frame hands the graph the
// frames made since the last one and moves the tuner one step.

const enginePerSecond = recorded.framesPerSecond;
const data = new Float32Array(recorded.frames.length * 4);

recorded.frames.forEach((f, i) => {
  if (Array.isArray(f)) data.set([f[0], f[1], f[2], 1], i * 4);
  else data[i * 4 + 2] = -1;
});

/** The graph's rows, held still around the melody: F3 to G#4. */
const VIEW_LOW = 52.5;

function start() {
  const graph = new GraphModel();
  graph.setFramesPerSecond(enginePerSecond);
  graph.followSinger = false;
  graph.moveViewTo(VIEW_LOW);
  graph.viewLow = graph.targetLow;

  return { frame: 0, consumed: 0, graph, gauge: new GaugeModel(), last: { input: 0, output: 0, target: -1 }, sinceVoiced: 1 << 20, pillTarget: -1 };
}

let state = start();

/** The models after `frame` video frames. Replays from the start when asked for an earlier frame. */
export function pluginStateAt(frame: number) {
  if (frame < state.frame) state = start();

  while (state.frame < frame) {
    ++state.frame;
    const until = Math.min(recorded.frames.length, Math.floor((state.frame / FPS) * enginePerSecond));

    for (let i = state.consumed; i < until; ++i) {
      if (data[i * 4 + 3] > 0.5) {
        state.last = { input: data[i * 4], output: data[i * 4 + 1], target: data[i * 4 + 2] };
        state.sinceVoiced = 0;
      } else {
        ++state.sinceVoiced;
      }
    }

    if (until > state.consumed) state.graph.pushFrames(data.subarray(state.consumed * 4), until - state.consumed);
    state.consumed = until;

    const singing = state.sinceVoiced < enginePerSecond * 0.3;
    const target = state.last.target >= 0 ? state.last.target : Math.round(state.last.input);
    state.pillTarget = singing && state.last.target >= 0 ? pitchClass(target) : -1;
    state.gauge.setState(singing, target, (state.last.input - target) * 100, (state.last.output - target) * 100);
    state.gauge.animate();
  }

  return state;
}

/** Index of the engine frame being drawn at `seconds`. */
export const engineFrameAt = (seconds: number) => Math.floor(seconds * enginePerSecond);

/** The note being tuned to (MIDI), and the sung and output pitch at `seconds` in cents from it, the
    way a tuner shows them: read ten times a second and held through the gaps between notes. */
export function centsAt(seconds: number) {
  let i = Math.min(recorded.frames.length - 1, Math.floor((Math.floor(seconds * 10) / 10) * enginePerSecond));

  for (let k = 0; k < enginePerSecond && i >= 0; ++k, --i) {
    const f = recorded.frames[i];
    if (!Array.isArray(f)) continue;
    const target = f[2] >= 0 ? f[2] : Math.round(f[0]);
    return { note: target, sung: (f[0] - target) * 100, out: (f[1] - target) * 100 };
  }

  return null;
}
