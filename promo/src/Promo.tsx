import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import type { Params } from "../../website/components/demo/model";
import type { GraphModel } from "../../website/components/demo/PitchGraph";
import { Cent, Readout, Settle, Sheet, Tile, Wordmark, brand, display, text } from "./brand";
import recorded from "./frames.json";
import { PluginWindow } from "./plugin/PluginWindow";
import { centsAt, engineFrameAt, pluginStateAt } from "./plugin/state";
import { FPS, LIVE_SWITCH, SNAP, WIDTH, at, paramsAt } from "./timeline";
import "./styles.css";

// The promo. It opens on the problem: a good take, sung off-key, and no budget to fix it. Then the
// drop, and SnapTune. Dark shots show one part of the real window at a time, with the numbers it's
// producing set large beside it; gold and ivory sheets, laid down like the pages of a manual, carry
// the brand. Shots change on the beat.

type Plugin = ReturnType<typeof pluginStateAt>;

/** Window point (cx, cy) lands on screen point (ax, ay), scaled by z, and turned rx/ry degrees in
    perspective around that point. */
type View = { cx: number; cy: number; z: number; ax: number; ay: number; rx?: number; ry?: number };
type Rect = { x: number; y: number; w: number; h: number; r: number };

const GRAPH: Rect = { x: 342, y: 142, w: 638, h: 328, r: 6 };
const HERO: Rect = { x: 20, y: 142, w: 310, h: 328, r: 6 };
const LATENCY: Rect = { x: 682, y: 9, w: 304, h: 50, r: 4 };

const centre = (r: Rect) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2 });
const lerp = (a: number, b: number, x: number) => a + (b - a) * Math.min(1, Math.max(0, x));

/** A slow push over the shot, so a held frame still moves. */
const push = (t: number, from: number, to: number, z: number) => z * lerp(1, 1.03, (t - from) / (to - from));

/** Signed whole cents, with a real minus sign. */
function cents(value: number) {
  const r = Math.round(value);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}`;
}

//==============================================================================

/** The plugin window through a view, optionally cut down to one of its panels. */
export function WindowShot({ view, isolate, plugin, params }: { view: View; isolate?: Rect; plugin: Plugin; params: Params }) {
  const clipPath = isolate ? `inset(${isolate.y}px ${1000 - isolate.x - isolate.w}px ${640 - isolate.y - isolate.h}px ${isolate.x}px round ${isolate.r}px)` : undefined;

  const shot = (
    <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${view.ax - view.cx * view.z}px, ${view.ay - view.cy * view.z}px) scale(${view.z})`, clipPath }}>
      <PluginWindow params={params} graph={plugin.graph} gauge={plugin.gauge} pillTarget={plugin.pillTarget} outputFrom={engineFrameAt(SNAP - 0.05)} version={`v${recorded.version}`} />
    </div>
  );

  if (!view.rx && !view.ry) return shot;

  const origin = `${view.ax}px ${view.ay}px`;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2400, perspectiveOrigin: origin }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: origin, transform: `rotateX(${view.rx ?? 0}deg) rotateY(${view.ry ?? 0}deg)` }}>{shot}</div>
    </div>
  );
}

function Line({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <div style={{ whiteSpace: "nowrap", ...style }}>{children}</div>;
}

const small: CSSProperties = { ...text, fontSize: 30 };

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** A turn that eases from one angle to another over [from, to]. */
const swing = (t: number, from: number, to: number, a: number, b: number) => lerp(a, b, 1 - Math.pow(1 - Math.min(1, Math.max(0, (t - from) / (to - from))), 3));

//==============================================================================
// Shots.

/** Bars 0-1: the problem. A good take, and how far off each note is, before any plugin. */
function Pain({ t }: { t: number }) {
  const reading = centsAt(t);

  return (
    <>
      <Line style={{ ...small, position: "absolute", left: 328, top: 46, color: brand.sage }}>Bypassed</Line>
      <Line style={{ ...small, position: "absolute", right: WIDTH - 1592, top: 46, color: brand.muted }}>
        Test melody, synthesized
      </Line>

      <Settle t={t} at={0.1} style={{ left: 0, right: 0, top: 150, textAlign: "center", color: brand.paper }}>
        <div style={{ ...display, fontSize: 170 }}>Great take.</div>
      </Settle>

      <Line style={{ ...small, position: "absolute", left: 0, right: 0, top: 390, textAlign: "center", color: brand.sage }}>Sung, in cents off the note</Line>
      {reading && <Readout value={cents(reading.sung)} unit="¢" size={260} color={brand.sage} style={{ position: "absolute", left: 0, right: 0, top: 432, textAlign: "center" }} />}

      <Settle t={t} at={at(1)} style={{ left: 0, right: 0, top: 790, textAlign: "center", color: brand.sage }}>
        <div style={{ ...display, fontSize: 108 }}>Every note a little off.</div>
      </Settle>
    </>
  );
}

/** Bars 2-4: the tuner, still bypassed, and the two sounds you might want. Then the drop: the same take
    through SnapTune, with the tuner's numbers set large. */
function Take({ t, plugin, params }: { t: number; plugin: Plugin; params: Params }) {
  const view: View = { ...centre(GRAPH), z: push(t, at(2), at(5), 1.98), ax: 960, ay: 690 };
  const left = view.ax - (GRAPH.w / 2) * view.z;
  const right = view.ax + (GRAPH.w / 2) * view.z;
  const tuned = t >= SNAP;
  const reading = centsAt(t);

  return (
    <>
      <WindowShot view={view} isolate={GRAPH} plugin={plugin} params={params} />

      <Line style={{ ...small, position: "absolute", left, top: 46, color: tuned ? brand.gold : brand.sage }}>{tuned ? "SnapTune on" : "Bypassed"}</Line>
      <Line style={{ ...small, position: "absolute", right: WIDTH - right, top: 46, color: brand.muted }}>
        Test melody, synthesized
      </Line>

      <Line style={{ ...small, position: "absolute", left, top: 120, color: brand.sage }}>Sung</Line>
      {reading && <Readout value={cents(reading.sung)} unit="¢" size={180} color={brand.sage} style={{ position: "absolute", left: left - 6, top: 152 }} />}

      <Settle t={t} at={at(2, 0.25)} until={SNAP} style={{ right: WIDTH - right, top: 120, textAlign: "right", color: brand.paper }}>
        <div style={{ ...display, fontSize: 84 }}>Want it robotic?</div>
      </Settle>
      <Settle t={t} at={at(3)} until={SNAP} style={{ right: WIDTH - right, top: 212, textAlign: "right", color: brand.paper }}>
        <div style={{ ...display, fontSize: 84 }}>Or just in tune?</div>
      </Settle>

      {tuned && reading && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", color: brand.gold }}>
          <Line style={small}>Note</Line>
          <Readout value={NOTE_NAMES[reading.note % 12]} unit={String(Math.floor(reading.note / 12) - 1)} size={180} color={brand.gold} style={{ display: "block", marginTop: 2 }} />
        </div>
      )}

      <Settle t={t} at={SNAP} style={{ right: WIDTH - right, top: 120, textAlign: "right" }}>
        <Line style={{ ...small, color: brand.gold }}>Out</Line>
        {reading && <Readout value={cents(reading.out)} unit="¢" size={180} color={brand.gold} style={{ display: "block", marginTop: 2 }} />}
      </Settle>
    </>
  );
}

/** Bar 5: the cover, laid down. */
function Cover({ t }: { t: number }) {
  const from = at(5);

  return (
    <Sheet t={t} at={from} color={brand.gold} style={{ left: 560, top: 70, width: 800, height: 1120 }}>
      <Tile size={96} progress={(t - from - 0.36) / 0.32} style={{ position: "absolute", left: 352, top: 120 }} />
      <Settle t={t} at={from + 0.42} style={{ left: 0, right: 0, top: 290, textAlign: "center", color: brand.green }}>
        <div style={{ ...display, fontSize: 200 }}>
          <div style={{ transform: "translateX(-60px)" }}>Snap</div>
          <div style={{ transform: "translateX(60px)" }}>Tune</div>
        </div>
      </Settle>
      <Settle t={t} at={from + 0.56} amount={16} style={{ left: 0, right: 0, top: 690, textAlign: "center", color: brand.green }}>
        <Line style={{ ...text, fontSize: 42 }}>Free pitch correction for your DAW</Line>
      </Settle>
    </Sheet>
  );
}

/** Bars 8-11: Retune Speed, from robot to natural, with the knob's value set large. Cuts to a turned
    angle halfway, on the beat. */
function Retune({ t, plugin, params }: { t: number; plugin: Plugin; params: Params }) {
  const from = at(8);
  const cut = at(10);
  const turn = at(11, 1.9);
  const view: View =
    t < cut
      ? { ...centre(HERO), z: push(t, from, cut, 2.55), ax: 1365, ay: 540 }
      : { ...centre(HERO), z: push(t, cut, at(12), 2.3), ax: 1360, ay: 540, ry: swing(t, cut, cut + 1.2, -26, -16), rx: 4 };
  const landed = from + 0.4;

  return (
    <>
      <WindowShot view={view} isolate={HERO} plugin={plugin} params={params} />
      <Sheet t={t} at={from} from="left" color={brand.gold} style={{ left: 0, top: 0, width: 800, height: 1080 }}>
        <div style={{ position: "absolute", left: 96, top: 80, display: "flex", alignItems: "center", gap: 18, color: brand.green }}>
          <Cent size={56} color={brand.green} />
          <Wordmark size={44} color={brand.green} />
        </div>
        <Settle t={t} at={landed} style={{ left: 96, top: 300, color: brand.green }}>
          <Line style={{ ...text, fontSize: 32 }}>Retune speed</Line>
          <Readout value={String(Math.round(params.retune))} unit="ms" size={250} color={brand.green} style={{ display: "block", marginTop: 8 }} />
        </Settle>
        <Settle t={t} at={landed + 0.08} until={turn} style={{ left: 96, top: 680, color: brand.green }}>
          <div style={{ ...display, fontSize: 124 }}>Full robot</div>
        </Settle>
        <Settle t={t} at={turn} style={{ left: 96, top: 640, color: brand.green }}>
          <div style={{ ...display, fontSize: 112 }}>
            Or keep
            <br />
            the vibrato
          </div>
        </Settle>
      </Sheet>
    </>
  );
}

/** Where engine frame `frame` sits on the graph (its own coordinates), or null when off it. */
function graphPoint(m: GraphModel, frame: number, corrected: boolean) {
  const age = m.totalFrames - 1 - frame;
  const visible = m.visibleFrames();
  if (age < 0 || age >= visible) return null;

  const i = m.at(age);
  if (!m.voiced[i]) return null;

  const width = 636;
  const height = 326;
  const note = corrected ? m.output[i] : m.input[i];
  return { x: width - (age * (width - 46)) / visible, y: height - ((note - m.viewLow) / m.span) * height };
}

function Pin({ x, y, length, color, label }: { x: number; y: number; length: number; color: string; label: string }) {
  const top = Math.min(y, y + length);

  return (
    <>
      <div style={{ position: "absolute", left: x - 1.5, top, width: 3, height: Math.abs(length), background: color }} />
      <div style={{ position: "absolute", left: x - 8, top: y - 8, width: 16, height: 16, borderRadius: 8, background: color, boxShadow: `0 0 0 4px ${brand.deep}` }} />
      <Line style={{ ...text, fontSize: 30, fontWeight: 600, position: "absolute", left: x - 22, top: y + length + (length < 0 ? -58 : 8), padding: "6px 16px", background: color, color: brand.green }}>{label}</Line>
    </>
  );
}

/** Bars 12-13: the graph, with a sung note and its output pinned as they scroll by. */
function Graph({ t, plugin, params }: { t: number; plugin: Plugin; params: Params }) {
  const from = at(12);
  const view: View = { ...centre(GRAPH), z: push(t, from, at(14), 2.04), ax: 960, ay: 650 };
  const left = view.ax - (GRAPH.w / 2) * view.z;

  // A sung E, sharp, that SnapTune's Natural setting brings down while keeping its vibrato.
  const anchor = engineFrameAt(at(12, 2) + 0.4);
  const sung = graphPoint(plugin.graph, anchor, false);
  const out = graphPoint(plugin.graph, anchor, true);
  const toScreen = (p: { x: number; y: number }) => ({ x: view.ax + (GRAPH.x + 1 + p.x - view.cx) * view.z, y: view.ay + (GRAPH.y + 1 + p.y - view.cy) * view.z });

  let pins = null;
  if (t >= at(12, 2) + 0.6 && sung && out) {
    const s = toScreen(sung);
    const o = toScreen(out);
    const outAbove = o.y <= s.y;
    pins = (
      <>
        <Pin {...o} length={outAbove ? -150 : 96} color={brand.gold} label="SnapTune" />
        <Pin {...s} length={outAbove ? 96 : -150} color={brand.sage} label="You" />
      </>
    );
  }

  return (
    <>
      <WindowShot view={view} isolate={GRAPH} plugin={plugin} params={params} />
      <Settle t={t} at={at(12)} style={{ left, top: 100, color: brand.gold }}>
        <div style={{ ...display, fontSize: 132 }}>It shows its work</div>
      </Settle>
      {pins}
    </>
  );
}

/** Bars 5.5-7: Studio to Live, the latency set large. */
function Live({ t, plugin, params }: { t: number; plugin: Plugin; params: Params }) {
  const from = at(5, 2);
  const view: View = { ...centre(LATENCY), z: push(t, from, at(7, 2), 3.1), ax: 960, ay: 250 };
  const live = t >= LIVE_SWITCH;

  return (
    <>
      <WindowShot view={view} isolate={LATENCY} plugin={plugin} params={params} />
      <Line style={{ ...small, position: "absolute", left: 0, right: 0, top: 420, textAlign: "center", color: live ? brand.gold : brand.muted }}>{live ? "Live mode latency" : "Studio mode latency"}</Line>
      <Settle t={t} at={live ? LIVE_SWITCH : from} style={{ left: 0, right: 0, top: 466, textAlign: "center" }}>
        <Readout value={live ? "2.7" : "46.2"} unit="ms" size={260} color={live ? brand.gold : brand.paper} />
      </Settle>
      <Settle t={t} at={LIVE_SWITCH + 0.3} style={{ left: 0, right: 0, top: 780, textAlign: "center", color: brand.gold }}>
        <div style={{ ...display, fontSize: 124 }}>Track through it</div>
      </Settle>
    </>
  );
}

/** Bars 14-15: the whole window, and the receipt for it. */
function Receipt({ t, plugin, params }: { t: number; plugin: Plugin; params: Params }) {
  const from = at(14);
  const view: View = { cx: 500, cy: 320, z: push(t, from, at(16), 0.96), ax: 590, ay: 540, ry: swing(t, from, from + 1.4, 22, 12) };
  const rows = ["VST3 for Mac", "Audio Unit for Mac", "VST3 for Windows", "VST3 and LV2 for Linux", "Six presets, 13 scales", "MIDI target notes", "Updates and source code"];

  return (
    <>
      <WindowShot view={view} plugin={plugin} params={params} />
      <Sheet t={t} at={from} from="right" color={brand.paper} style={{ left: 1200, top: 110, width: 600, height: 860, padding: "44px 48px", color: brand.green }}>
        <div style={{ display: "flex", justifyContent: "space-between", ...display, fontSize: 40 }}>
          <span>SnapTune {recorded.version}</span>
          <span>Receipt</span>
        </div>
        {rows.map((row, i) => {
          const shownAt = from + 0.5 + 0.22 * i;
          if (t < shownAt) return null;
          return (
            <div key={row} style={{ ...text, display: "flex", alignItems: "baseline", gap: 12, marginTop: i === 0 ? 40 : 20, fontSize: 30, transform: `translateY(${Math.max(0, 1 - (t - shownAt) / 0.12) * 10}px)` }}>
              <span>{row}</span>
              <span style={{ flex: 1, borderBottom: `5px dotted rgba(19, 54, 33, 0.45)`, transform: "translateY(-6px)" }} />
              <span>0¢</span>
            </div>
          );
        })}
        {t >= from + 0.5 + 0.22 * rows.length && (
          <div style={{ ...text, display: "flex", justifyContent: "space-between", marginTop: 40, padding: "16px 20px", background: brand.green, color: brand.paper, fontSize: 36, fontWeight: 600 }}>
            <span>Total</span>
            <span>0¢</span>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** Bar 16 on: the cover again, closed: the mark, the name, the line, the address. */
function End({ t }: { t: number }) {
  const from = at(16);

  return (
    <Sheet t={t} at={from} color={brand.gold} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <Tile size={150} inverted progress={(t - from - 0.35) / 0.4} style={{ position: "absolute", left: 885, top: 150 }} />
      <Settle t={t} at={from + 0.6} style={{ left: 0, right: 0, top: 360, textAlign: "center" }}>
        <Wordmark size={200} color={brand.green} />
      </Settle>
      <Settle t={t} at={from + 0.82} amount={18} style={{ left: 0, right: 0, top: 600, textAlign: "center", color: brand.green }}>
        <Line style={{ ...text, fontSize: 56, fontStyle: "italic" }}>Tuned to 0¢. Priced at 0¢.</Line>
      </Settle>
      <Settle t={t} at={from + 1.0} amount={14} style={{ left: 0, right: 0, top: 760, textAlign: "center", color: brand.green }}>
        <Line style={{ ...text, fontSize: 60, fontWeight: 600 }}>getsnaptune.com</Line>
        <Line style={{ ...text, fontSize: 30, marginTop: 14 }}>Free for Mac, Windows and Linux</Line>
      </Settle>
    </Sheet>
  );
}

//==============================================================================

export function Promo() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const plugin = pluginStateAt(frame);
  const params = paramsAt(t);
  const shared = { t, plugin, params };

  let shot: ReactNode;
  if (t < at(2)) shot = <Pain t={t} />;
  else if (t < at(5)) shot = <Take {...shared} />;
  else if (t < at(5, 2)) shot = <Cover t={t} />;
  else if (t < at(7, 2)) shot = <Live {...shared} />;
  else if (t < at(8)) shot = <WindowShot view={{ cx: 500, cy: 320, z: push(t, at(7, 2), at(8), 1.2), ax: 960, ay: 540, ry: swing(t, at(7, 2), at(8), -24, -12), rx: 6 }} plugin={plugin} params={params} />;
  else if (t < at(12)) shot = <Retune {...shared} />;
  else if (t < at(14)) shot = <Graph {...shared} />;
  else if (t < at(16)) shot = <Receipt {...shared} />;
  else shot = <End t={t} />;

  return (
    <AbsoluteFill className="promo">
      <Audio src={staticFile("soundtrack.wav")} />
      {shot}
    </AbsoluteFill>
  );
}

/** The window alone, tuning the voice from Hard Tune through Natural: a muted loop for the website. */
export function Loop() {
  const frame = useCurrentFrame() + Math.round(SNAP * FPS);
  const t = frame / FPS;
  const plugin = pluginStateAt(frame);
  const params = paramsAt(t);

  return (
    <AbsoluteFill className="promo" style={{ background: brand.green }}>
      <WindowShot view={{ cx: 500, cy: 320, z: 1.25, ax: 640, ay: 400 }} plugin={plugin} params={params} />
    </AbsoluteFill>
  );
}
