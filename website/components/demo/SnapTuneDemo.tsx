"use client";

import "./demo.css";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import initial from "@/lib/demo-frames.json";
import { DemoAudio, workletSupported } from "./audio";
import { Combo, MidiToggle, ModeSwitch, NotePills, PluginLogo } from "./controls";
import { Knob } from "./Knob";
import { MiniKeyboard } from "./MiniKeyboard";
import {
  CUSTOM_SCALE,
  DEFAULT_PARAMS,
  HOME_NOTES,
  KNOBS,
  NOTE_NAMES,
  PRESETS,
  SCALE_NAMES,
  SMALL_KNOBS,
  TIPS,
  VOICE_NAMES,
  engineSettings,
  matchingPreset,
  pitchClass,
  pitchClassMask,
  type KnobId,
  type Params,
} from "./model";
import { GraphModel, PitchGraph } from "./PitchGraph";
import { GaugeModel, TunerGauge } from "./TunerGauge";

// The SnapTune window from Source/ui/MainView, running the plugin's engine in an AudioWorklet. On a
// wide screen it is the plugin's own 1000 x 640 layout, scaled; narrower, the same panels stack.

type Source = "voice" | "mic" | "file";
type Status = "idle" | "loading" | "playing" | "paused" | "recording";
type Take = { name: string; buffer: Float32Array };
type LastVoiced = { input: number; output: number; target: number };

const RECORD_SECONDS = 10;
const DESKTOP_MIN_WIDTH = 760;

/** Plugin coordinates (x, y, width, height) for the desktop layout. */
const at = (x: number, y: number, w: number, h: number) => ({ "--x": x, "--y": y, "--w": w, "--h": h }) as CSSProperties;

/** The engine's latency (AutoTuneEngine::prepare), for the readout before audio has started. */
function latencyMs(mode: number, sampleRate: number) {
  const maxPeriod = Math.ceil(sampleRate / 65);
  const samples = mode === 1 ? Math.max(8, Math.round(sampleRate * 0.0002)) + Math.round(sampleRate / 400) : 3 * maxPeriod;
  return ((1000 * samples) / sampleRate).toFixed(1);
}

const subscribeNever = () => () => {};

function hopsPerSecond(sampleRate: number) {
  return sampleRate / Math.max(32, Math.round(sampleRate / 375));
}

/** The graph and tuner start on the opening of the test voice, rendered by `npm run demo-frames`. */
function createModels() {
  const graph = new GraphModel();
  const gauge = new GaugeModel();
  const frames = initial.frames;
  const data = new Float32Array(frames.length * 4);
  const last: LastVoiced = { input: 0, output: 0, target: -1 };
  let sinceVoiced = 1 << 20;

  frames.forEach((f, i) => {
    if (Array.isArray(f)) {
      data.set([f[0], f[1], f[2], 1], i * 4);
      Object.assign(last, { input: f[0], output: f[1], target: f[2] });
      sinceVoiced = 0;
    } else {
      data[i * 4 + 2] = -1;
      ++sinceVoiced;
    }
  });

  graph.setFramesPerSecond(initial.framesPerSecond);
  const chunk = Math.ceil(initial.framesPerSecond / 60);
  for (let i = 0; i < frames.length; i += chunk) graph.pushFrames(data.subarray(i * 4), Math.min(chunk, frames.length - i));
  graph.viewLow = graph.targetLow;

  const singing = sinceVoiced < initial.framesPerSecond * 0.3;
  const target = last.target >= 0 ? last.target : Math.round(last.input);
  gauge.setState(singing, target, (last.input - target) * 100, (last.output - target) * 100);
  gauge.settle();

  return { graph, gauge, last, sinceVoiced, pillTarget: singing && last.target >= 0 ? pitchClass(target) : -1 };
}

function PlayIcon({ status, source }: { status: Status; source: Source }) {
  if (status === "loading")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
      </svg>
    );

  const stop = status === "recording" || (status === "playing" && source === "mic");
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      {stop ? <rect x="6.5" y="6.5" width="11" height="11" rx="2" /> : status === "playing" ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13l10.5-6.5z" />}
    </svg>
  );
}

export function SnapTuneDemo({ version }: { version: string }) {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [models] = useState(createModels);
  const [graphVersion, setGraphVersion] = useState(0);
  const [gaugeVersion, setGaugeVersion] = useState(0);
  const [pillTarget, setPillTarget] = useState(models.pillTarget);
  const [held, setHeld] = useState(0);
  const [layout, setLayout] = useState({ desktop: true, graphWidth: 636, graphHeight: 326 });
  const [source, setSource] = useState<Source>("voice");
  const [status, setStatus] = useState<Status>("idle");
  const [bypass, setBypass] = useState(false);
  const [backing, setBacking] = useState(true);
  const [take, setTake] = useState<Take | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const [recordLeft, setRecordLeft] = useState(0);
  const [tip, setTip] = useState<{ text: string; x: number; y: number; left: boolean; up: boolean } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const graphPanelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const audioRef = useRef<DemoAudio | null>(null);
  const loopRef = useRef({ raf: 0, last: 0, visible: true });
  const stateRef = useRef({ params, held, status, pillTarget: models.pillTarget, last: models.last, sinceVoiced: models.sinceVoiced });
  const tipTimer = useRef(0);
  const tipTarget = useRef<Element | null>(null);

  // The animation loop runs outside React and reads the latest values from here.
  useEffect(() => {
    Object.assign(stateRef.current, { params, held, status });
  }, [params, held, status]);

  const { graph, gauge } = models;
  const scaleMask = pitchClassMask(params.key, params.scale, params.notes);
  const allowedMask = params.midi && held !== 0 ? held : scaleMask;
  const preset = matchingPreset(params);
  const shortVersion = `v${version}`;

  const audio = useCallback(() => {
    if (!audioRef.current) {
      const a = new DemoAudio(engineSettings(stateRef.current.params));
      a.onRecorded = (buffer) => {
        if (buffer.length < 0.3 * a.sampleRate) {
          setMessage("That take was empty. Allow the mic and sing something.");
          setStatus("idle");
          return;
        }

        const recording = { name: "Your take", buffer };
        setTake(recording);
        setSource("file");
        a.stopMic();
        void a.playTake(buffer).then(() => setStatus(a.running ? "playing" : "paused"));
      };
      audioRef.current = a;
    }

    return audioRef.current;
  }, []);

  //==============================================================================
  // The editor's 60 Hz timer (MainView::timerCallback): take the engine's pitch frames, move the
  // graph and animate the tuner.
  const tick = useCallback(
    (consume: boolean) => {
      const s = stateRef.current;
      let graphChanged = false;

      if (consume && audioRef.current) {
        for (const { data, count } of audioRef.current.takeFrames()) {
          for (let i = 0; i < count; ++i) {
            if (data[i * 4 + 3] > 0.5) {
              s.last = { input: data[i * 4], output: data[i * 4 + 1], target: data[i * 4 + 2] };
              s.sinceVoiced = 0;
            } else {
              ++s.sinceVoiced;
            }
          }

          if (count > 0) {
            graph.pushFrames(data, count);
            graphChanged = true;
          }
        }
      }

      const singing = s.sinceVoiced < graph.framesPerSecond * 0.3;
      const target = s.last.target >= 0 ? s.last.target : Math.round(s.last.input);
      const pt = singing && s.last.target >= 0 ? pitchClass(target) : -1;

      if (pt !== s.pillTarget) {
        s.pillTarget = pt;
        setPillTarget(pt);
      }

      gauge.setState(singing, target, (s.last.input - target) * 100, (s.last.output - target) * 100);
      const gaugeChanged = gauge.animate();

      if (graphChanged) setGraphVersion((v) => v + 1);
      if (gaugeChanged) setGaugeVersion((v) => v + 1);
      return graphChanged || gaugeChanged;
    },
    [graph, gauge],
  );

  const kick = useCallback(() => {
    const loop = loopRef.current;
    if (loop.raf || !loop.visible) return;

    loop.last = performance.now();
    const frame = (now: number) => {
      // Fixed 60 Hz steps, whatever the display rate, so the animation constants mean the same.
      const steps = Math.min(4, Math.floor((now - loop.last) / (1000 / 60)));
      let busy = stateRef.current.status === "playing" || stateRef.current.status === "recording";

      for (let i = 0; i < steps; ++i) busy = tick(i === 0) || busy;
      if (steps > 0) loop.last += steps * (1000 / 60);

      loop.raf = busy || steps === 0 ? requestAnimationFrame(frame) : 0;
    };
    loop.raf = requestAnimationFrame(frame);
  }, [tick]);

  // Only animate while the window is on screen.
  useEffect(() => {
    const root = rootRef.current;
    const loop = loopRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(([entry]) => {
      loop.visible = entry.isIntersecting;
      if (loop.visible) kick();
      else if (loop.raf) {
        cancelAnimationFrame(loop.raf);
        loop.raf = 0;
      }
    });
    observer.observe(root);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(loop.raf);
      loop.raf = 0;
    };
  }, [kick]);

  useEffect(() => kick(), [status, kick]);

  useEffect(() => () => audioRef.current?.close(), []);

  useEffect(() => {
    audioRef.current?.setSettings(engineSettings(params));
  }, [params]);

  // Desktop: the plugin's fixed layout, graph 636 x 326. Narrower: measure the graph's panel.
  useEffect(() => {
    const root = rootRef.current;
    const panel = graphPanelRef.current;
    if (!root || !panel) return;

    const measure = () => {
      const desktop = root.clientWidth >= DESKTOP_MIN_WIDTH;
      const next = desktop
        ? { desktop, graphWidth: 636, graphHeight: 326 }
        : { desktop, graphWidth: Math.max(200, Math.round(panel.clientWidth)), graphHeight: Math.max(160, Math.round(panel.clientHeight)) };
      setLayout((l) => (l.desktop === next.desktop && l.graphWidth === next.graphWidth && l.graphHeight === next.graphHeight ? l : next));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  //==============================================================================
  const set = <K extends keyof Params>(key: K, value: Params[K]) => setParams((p) => ({ ...p, [key]: value }));

  function toggleNote(pc: number) {
    setParams((p) => ({ ...p, notes: pitchClassMask(p.key, p.scale, p.notes) ^ (1 << pc), scale: CUSTOM_SCALE }));
  }

  function setVoice(voice: number) {
    set("voice", voice);
    if (graph.setHomeNote(HOME_NOTES[voice])) setGraphVersion((v) => v + 1);
  }

  function applyPreset(index: number) {
    if (index >= 0) setParams((p) => ({ ...p, ...PRESETS[index].values }));
  }

  const heldNotes = useRef(new Set<number>());

  const noteOn = useCallback((note: number) => {
    if (heldNotes.current.has(note)) return;
    heldNotes.current.add(note);
    audioRef.current?.noteOn(note);
    setHeld((h) => h | (1 << pitchClass(note)));
  }, []);

  const noteOff = useCallback((note: number) => {
    if (!heldNotes.current.delete(note)) return;
    audioRef.current?.noteOff(note);
    let mask = 0;
    for (const n of heldNotes.current) mask |= 1 << pitchClass(n);
    setHeld(mask);
  }, []);

  function setMidi(on: boolean) {
    if (!on) {
      heldNotes.current.clear();
      audioRef.current?.allNotesOff();
      setHeld(0);
    }
    set("midi", on);
  }

  //==============================================================================
  // Transport.
  // Assumed until hydrated, so the server's HTML matches.
  const supported = useSyncExternalStore(subscribeNever, workletSupported, () => true);

  async function run(task: () => Promise<void>, next: Status = "playing") {
    setMessage(null);
    setStatus("loading");
    try {
      await task();
      const a = audio();
      setSampleRate(a.sampleRate);
      graph.setFramesPerSecond(hopsPerSecond(a.sampleRate));
      setStatus(a.running || next === "recording" ? next : "paused");
    } catch (error) {
      setStatus("idle");
      const name = error instanceof DOMException ? error.name : "";
      setMessage(
        name === "NotAllowedError" || name === "SecurityError"
          ? "The browser blocked the microphone. Allow it from the address bar, then try again."
          : name === "NotFoundError"
            ? "No microphone found."
            : name === "EncodingError"
              ? "Couldn’t read that file. Try a WAV, MP3 or M4A."
              : "Audio couldn’t start in this browser.",
      );
    }
  }

  function startVoice() {
    setSource("voice");
    void run(() => audio().playVoice());
  }

  function startTake(t: Take) {
    setSource("file");
    void run(() => audio().playTake(t.buffer));
  }

  function askForMic() {
    // Opened here, inside the click, so Safari lets it play later.
    void audio().open().catch(() => undefined);
    dialogRef.current?.showModal();
  }

  function startMic(record: boolean) {
    dialogRef.current?.close();
    setSource("mic");

    if (record) {
      setRecordLeft(RECORD_SECONDS);
      void run(() => audio().startMic(RECORD_SECONDS), "recording");
    } else {
      // Live, as the plugin suggests while recording: you hear yourself with 3 ms of delay, not 46.
      set("mode", 1);
      void run(() => audio().startMic());
    }
  }

  function chooseFile() {
    void audio().open().catch(() => undefined);
    fileRef.current?.click();
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|m4a|aac|ogg|flac|aiff?)$/i.test(file.name)) {
      setMessage("That isn’t an audio file.");
      return;
    }

    const a = audio();
    a.stopMic();
    setSource("file");
    await run(async () => {
      const buffer = await a.decode(file);
      const t = { name: file.name.replace(/\.[^.]+$/, ""), buffer };
      setTake(t);
      await a.playTake(buffer);
    });
  }

  function selectSource(next: Source) {
    if (next === "voice") startVoice();
    else if (next === "mic") askForMic();
    else if (take && source !== "file") startTake(take);
    else chooseFile();
  }

  function togglePlay() {
    const a = audioRef.current;

    if (status === "recording") {
      a?.stopRecording();
    } else if (status === "playing" && source === "mic") {
      a?.stopMic();
      void a?.pause();
      setStatus("idle");
    } else if (status === "playing") {
      void a?.pause();
      setStatus("paused");
    } else if (status === "paused" && a) {
      void a.resume()?.then(() => setStatus(a.running ? "playing" : "paused"));
      setStatus("playing");
    } else if (source === "mic") {
      askForMic();
    } else if (source === "file") {
      if (take) startTake(take);
      else chooseFile();
    } else {
      startVoice();
    }
  }

  // Countdown while recording a take.
  useEffect(() => {
    if (status !== "recording") return;
    const started = performance.now();
    const timer = setInterval(() => setRecordLeft(Math.max(0, Math.ceil(RECORD_SECONDS - (performance.now() - started) / 1000))), 250);
    return () => clearInterval(timer);
  }, [status]);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    void loadFile(e.dataTransfer.files[0]);
  }

  //==============================================================================
  // Tooltips like the plugin's: after a pause over a control, next to the pointer.
  function onPointerOver(e: ReactPointerEvent<HTMLDivElement>) {
    const target = (e.target as Element).closest<HTMLElement | SVGElement>("[data-tip]");
    if (e.pointerType !== "mouse" || target === tipTarget.current) return;

    hideTip();
    tipTarget.current = target;
    if (!target || !rootRef.current) return;

    const text = target.dataset.tip!;
    const { clientX, clientY } = e;
    tipTimer.current = window.setTimeout(() => {
      const r = rootRef.current!.getBoundingClientRect();
      setTip({ text, x: clientX - r.left, y: clientY - r.top, left: clientX > r.left + r.width / 2, up: clientY > r.top + r.height / 2 });
    }, 700);
  }

  function hideTip() {
    clearTimeout(tipTimer.current);
    tipTarget.current = null;
    setTip(null);
  }

  // Moving between parts of the same control (an SVG knob is many elements) keeps its tooltip.
  function onPointerOut(e: ReactPointerEvent<HTMLDivElement>) {
    const next = e.relatedTarget instanceof Element ? e.relatedTarget.closest("[data-tip]") : null;
    if (next !== tipTarget.current) hideTip();
  }

  //==============================================================================
  const formantEnabled = params.mode === 0;
  const playLabel =
    status === "recording" ? "Stop recording" : status === "playing" ? (source === "mic" ? "Stop the mic" : "Pause") : status === "paused" ? "Resume" : "Play";

  let context;
  if (message) context = <span className="try-alert">{message}</span>;
  else if (status === "recording") context = <>Recording… sing anything. {recordLeft} s left, then you’ll hear it tuned.</>;
  else if (source === "mic" && status === "playing") context = <>Listening, in Live mode. Sing something and watch where it lands.</>;
  else if (source === "mic") context = <>Sing into your mic and watch it land on the notes. Headphones keep it from feeding back.</>;
  else if (source === "file" && take) context = <>Playing <b>{take.name}</b>. Set Key and Scale to match it.</>;
  else if (source === "voice")
    context = (
      <>
        SnapTune’s own engine, ported line by line from the plugin, running in your browser. The test voice is a synthesized singer,
        off-key on purpose, over chords in tune. Turn the knobs while it plays.{" "}
        <button type="button" className="try-link" aria-pressed={!backing} onClick={() => { setBacking(!backing); audioRef.current?.setBacking(!backing); }}>
          {backing ? "Mute the chords" : "Play the chords"}
        </button>
      </>
    );

  const sources: { value: Source; label: string }[] = [
    { value: "voice", label: "Test voice" },
    { value: "mic", label: "Your mic" },
    { value: "file", label: take?.name ?? "Your file" },
  ];

  return (
    <div className="try">
      <div className="try-text" data-reveal>
        <div className="try-tabs" role="group" aria-label="What goes in">
          {sources.map((o) => (
            <button key={o.value} type="button" aria-pressed={source === o.value} onClick={() => selectSource(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        <div className="try-body">
          <h2 id="try-title" className="heading">
            Play it here
          </h2>
          <p className="try-copy" aria-live="polite">
            {supported ? context : "This browser can’t run the demo. It needs Web Audio worklets (any current Chrome, Safari, Firefox or Edge)."}
            {source === "file" && take && status !== "loading" && (
              <>
                {" "}
                <button type="button" className="try-link" onClick={chooseFile}>
                  Open another
                </button>
              </>
            )}
            {status === "recording" && (
              <>
                {" "}
                <button type="button" className="try-link" onClick={() => audioRef.current?.stopRecording()}>
                  Stop now
                </button>
              </>
            )}
          </p>
        </div>

        <div className="try-cells">
          <button type="button" className="cell cell-ink" onClick={togglePlay} disabled={!supported || status === "loading"}>
            <PlayIcon status={status} source={source} />
            {playLabel}
          </button>
          <button
            type="button"
            className="cell"
            aria-pressed={bypass}
            onClick={() => {
              setBypass(!bypass);
              audioRef.current?.setBypass(!bypass);
            }}
          >
            {bypass ? "Hear it tuned" : "Hear it as sung"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => void loadFile(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      </div>

      <div ref={rootRef} className="st-demo try-plate" data-reveal onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()} onDrop={onDrop} onPointerOver={onPointerOver} onPointerOut={onPointerOut} onPointerDown={hideTip}>
      {/* The plugin window. */}
      <div className="st-window">
        <div className="st-header" data-ui>
          <div className="st-brand">
            <PluginLogo className="st-at st-logo" style={at(20, 19, 30, 30)} />
            <span className="st-at st-wordmark" style={at(62, 18, 124, 32)}>
              SNAPTUNE
            </span>
            <span className="st-at st-chip" style={at(192, 26, 40, 19)}>
              {shortVersion}
            </span>
          </div>
          <Combo className="st-at st-presets" style={at(232, 19, 196, 30)} label="Presets" value={preset} onChange={applyPreset} tip={TIPS.presets}>
            <option value={-1} hidden disabled>
              Presets
            </option>
            <optgroup label="Factory presets">
              {PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </Combo>
          <div className="st-at st-latency" style={at(690, 14, 128, 40)}>
            <span className="st-caption">Latency</span>
            <span className="st-latency-value">{latencyMs(params.mode, sampleRate)} ms</span>
          </div>
          <ModeSwitch className="st-at" style={at(830, 19, 150, 30)} mode={params.mode} onChange={(m) => set("mode", m)} tip={TIPS.mode} />
        </div>

        <section className="st-panel st-at st-scalebar" data-ui style={at(20, 66, 960, 64)} aria-label="Key and scale">
          <div className="st-field st-key-field">
            <span className="st-caption st-at" style={at(18, 7, 100, 15)} aria-hidden="true">
              Key
            </span>
            <Combo className="st-at" style={at(16, 26, 70, 30)} label="Key" value={params.key} onChange={(v) => set("key", v)} tip={TIPS.key}>
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </Combo>
          </div>
          <div className="st-field st-scale-field">
            <span className="st-caption st-at" style={at(100, 7, 168, 15)} aria-hidden="true">
              Scale
            </span>
            <Combo className="st-at" style={at(98, 26, 168, 30)} label="Scale" value={params.scale} onChange={(v) => set("scale", v)} tip={TIPS.scale}>
              {SCALE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </Combo>
          </div>
          <div className="st-field st-notes-field">
            <span className="st-caption st-at" style={at(292, 7, 508, 15)} aria-hidden="true">
              Scale notes
            </span>
            <NotePills className="st-at" style={at(290, 26, 508, 30)} allowed={allowedMask} held={params.midi ? held : 0} target={pillTarget} onToggle={toggleNote} tip={TIPS.pills} />
          </div>
          <div className="st-field st-target-field">
            <span className="st-caption st-at" style={at(828, 7, 118, 15)} aria-hidden="true">
              Target
            </span>
            <MidiToggle className="st-at" style={at(826, 26, 118, 30)} on={params.midi} onChange={setMidi} tip={TIPS.midi} />
          </div>
        </section>

        <section className="st-panel st-at st-hero" data-ui style={at(20, 142, 310, 328)} aria-label="Tuner and retune speed">
          <TunerGauge className="st-at st-gauge" style={at(10, 8, 290, 164)} model={gauge} version={gaugeVersion} />
          <span className="st-caption st-dim st-at st-retune-caption" style={at(0, 178, 310, 16)} aria-hidden="true">
            Retune speed
          </span>
          <Knob hero className="st-at st-hero-knob" style={at(65, 196, 180, 128)} param="retune" value={params.retune} onChange={(v) => set("retune", v)} />
        </section>

        <section ref={graphPanelRef} className="st-panel st-at st-graph" data-ui style={at(342, 142, 638, 328)} aria-label="Pitch graph">
          <PitchGraph
            className="st-graph-svg"
            model={graph}
            width={layout.graphWidth}
            height={layout.graphHeight}
            mask={allowedMask}
            version={graphVersion}
            onChange={() => setGraphVersion((v) => v + 1)}
          />
        </section>

        <section className="st-panel st-at st-controls" data-ui style={at(20, 482, 960, 138)} aria-label="Correction">
          {SMALL_KNOBS.map((id: KnobId, i) => {
            const disabled = id === "formant" && !formantEnabled;
            const x = 49 + 150 * i;
            return (
              <div key={id} className="st-cell">
                <span className={`st-caption st-at st-knob-caption ${disabled ? "" : "st-dim"}`} style={at(x - 40, 18, 164, 15)} aria-hidden="true">
                  {KNOBS[id].title}
                  {disabled && <span className="st-studio-only"> (Studio only)</span>}
                </span>
                <Knob className="st-at st-small-knob" style={at(x, 34, 84, 92)} param={id} value={params[id]} disabled={disabled} onChange={(v) => set(id, v)} />
              </div>
            );
          })}
          <span className="st-at st-divider" style={at(776, 18, 1, 102)} aria-hidden="true" />
          <div className="st-field st-voice-field">
            <span className="st-caption st-dim st-at" style={at(792, 18, 154, 15)} aria-hidden="true">
              Voice
            </span>
            <Combo className="st-at" style={at(790, 56, 154, 30)} label="Voice" value={params.voice} onChange={setVoice} tip={TIPS.voice}>
              {VOICE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </Combo>
            <span className="st-at st-help" style={at(792, 94, 154, 30)}>
              Pitch range the detector
              <br />
              listens for
            </span>
          </div>
        </section>
      </div>

      {tip && (
        <div
          className="st-tip"
          role="tooltip"
          style={{
            ...(tip.left ? { right: `calc(100% - ${tip.x - 12}px)` } : { left: tip.x + 24 }),
            ...(tip.up ? { bottom: `calc(100% - ${tip.y - 6}px)` } : { top: tip.y + 6 }),
          }}
        >
          {tip.text}
        </div>
      )}

      {params.midi && <MiniKeyboard held={held} onNoteOn={noteOn} onNoteOff={noteOff} />}
      </div>

      <dialog ref={dialogRef} className="try-dialog" aria-labelledby="st-dialog-title">
        <h2 id="st-dialog-title">Headphones on?</h2>
        <p>
          Through speakers, the mic hears SnapTune’s output and it feeds back. Without headphones, record a {RECORD_SECONDS}-second take and
          hear it tuned right after.
        </p>
        <div className="try-dialog-actions">
          <button type="button" autoFocus onClick={() => startMic(false)} className="cell cell-ink">
            Yes, let me hear myself
          </button>
          <button type="button" onClick={() => startMic(true)} className="cell">
            No, record a take first
          </button>
          <button type="button" onClick={() => dialogRef.current?.close()} className="try-link">
            Cancel
          </button>
        </div>
      </dialog>
    </div>
  );
}
