import type { EngineSettings } from "./model";

// The demo's audio graph: source -> SnapTune worklet (public/snaptune-worklet.js) -> speakers. The
// worklet plays the test voice and uploaded takes itself; the mic comes in on its input.

export const workletSupported = () => typeof window !== "undefined" && "AudioWorkletNode" in window;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Lets iPhones play through the ring/silent switch, and record when the mic is on. */
function setAudioSession(type: "playback" | "play-and-record") {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = type;
}

export class DemoAudio {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private output: GainNode | null = null;
  private ready: Promise<void> | null = null;
  private mic: { stream: MediaStream; source: MediaStreamAudioSourceNode } | null = null;
  private pending: { data: Float32Array; count: number }[] = [];
  private settings: EngineSettings;
  private bypassed = false;
  private backing = true;

  onRecorded: ((take: Float32Array) => void) | null = null;

  constructor(settings: EngineSettings) {
    this.settings = settings;
  }

  get sampleRate() {
    return this.ctx?.sampleRate ?? 48000;
  }

  get running() {
    return this.ctx?.state === "running";
  }

  /** Pitch frames posted by the engine since the last call. */
  takeFrames() {
    const frames = this.pending;
    this.pending = [];
    return frames;
  }

  /** Builds the graph. Call it from a click: browsers only start audio after a user gesture, and
      Safari only when resume() is called inside the gesture itself. */
  open() {
    if (this.ready) {
      void this.ctx?.resume();
      return this.ready;
    }

    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    void ctx.resume();

    this.ready = ctx.audioWorklet.addModule("/snaptune-worklet.js").then(() => {
      const node = new AudioWorkletNode(ctx, "snaptune", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 1,
        channelCountMode: "explicit",
      });

      node.port.onmessage = (event: MessageEvent) => {
        const m = event.data;
        if (m.type === "frames") this.pending.push({ data: m.data, count: m.count });
        else if (m.type === "recorded") this.onRecorded?.(m.buffer);
      };

      const output = ctx.createGain();
      node.connect(output).connect(ctx.destination);
      this.node = node;
      this.output = output;
      this.post({ type: "settings", settings: this.settings });
      this.post({ type: "bypass", value: this.bypassed });
      this.post({ type: "backing", value: this.backing });
    });

    this.ready.catch(() => {
      this.ready = null;
      void ctx.close();
    });

    return this.ready;
  }

  private post(message: object, transfer: Transferable[] = []) {
    this.node?.port.postMessage(message, transfer);
  }

  setSettings(settings: EngineSettings) {
    this.settings = settings;
    this.post({ type: "settings", settings });
  }

  setBypass(bypassed: boolean) {
    this.bypassed = bypassed;
    this.post({ type: "bypass", value: bypassed });
  }

  setBacking(on: boolean) {
    this.backing = on;
    this.post({ type: "backing", value: on });
  }

  noteOn(note: number) {
    this.post({ type: "noteOn", note });
  }

  noteOff(note: number) {
    this.post({ type: "noteOff", note });
  }

  allNotesOff() {
    this.post({ type: "allNotesOff" });
  }

  async playVoice() {
    await this.open();
    this.stopMic();
    setAudioSession("playback");
    this.setMonitor(true);
    this.post({ type: "source", kind: "voice" });
  }

  async playTake(take: Float32Array) {
    await this.open();
    this.stopMic();
    setAudioSession("playback");
    this.setMonitor(true);
    const copy = take.slice();
    this.post({ type: "source", kind: "buffer", buffer: copy }, [copy.buffer]);
  }

  /** Live through the mic. With `record`, the output stays silent (no headphones, no feedback) and
      the input is captured for `record` seconds; onRecorded gets the take. */
  async startMic(record = 0) {
    setAudioSession("play-and-record");
    const opened = this.open();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await opened;
    this.stopMic();

    const source = this.ctx!.createMediaStreamSource(stream);
    source.connect(this.node!);
    this.mic = { stream, source };
    this.setMonitor(record === 0);
    this.post({ type: "source", kind: "input" });
    if (record > 0) this.post({ type: "record", seconds: record });
  }

  stopRecording() {
    this.post({ type: "stopRecording" });
  }

  stopMic() {
    if (!this.mic) return;
    this.mic.source.disconnect();
    for (const track of this.mic.stream.getTracks()) track.stop();
    this.mic = null;
  }

  private setMonitor(on: boolean) {
    if (this.output) this.output.gain.value = on ? 1 : 0;
  }

  pause() {
    return this.ctx?.suspend();
  }

  resume() {
    return this.ctx?.resume();
  }

  /** Decodes an audio file at the graph's sample rate and mixes it to mono (at most a minute). */
  async decode(file: File) {
    await this.open();
    const audio = await this.ctx!.decodeAudioData(await file.arrayBuffer());
    const length = Math.min(audio.length, Math.round(60 * audio.sampleRate));
    const mono = new Float32Array(length);

    for (let c = 0; c < audio.numberOfChannels; ++c) {
      const channel = audio.getChannelData(c);
      for (let i = 0; i < length; ++i) mono[i] += channel[i] / audio.numberOfChannels;
    }

    return mono;
  }

  close() {
    this.stopMic();
    void this.ctx?.close();
    this.ctx = null;
    this.node = null;
    this.ready = null;
  }
}
