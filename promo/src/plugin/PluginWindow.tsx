import type { CSSProperties } from "react";
import "../../../website/components/demo/demo.css";
import { Combo, MidiToggle, ModeSwitch, NotePills, PluginLogo } from "../../../website/components/demo/controls";
import { Knob } from "../../../website/components/demo/Knob";
import { KNOBS, NOTE_NAMES, PRESETS, SCALE_NAMES, SMALL_KNOBS, VOICE_NAMES, matchingPreset, pitchClassMask, type Params } from "../../../website/components/demo/model";
import { PitchGraph, type GraphModel } from "../../../website/components/demo/PitchGraph";
import { TunerGauge, type GaugeModel } from "../../../website/components/demo/TunerGauge";


// The SnapTune window as the website's demo draws it (SnapTuneDemo, the plugin's 1000 x 640
// MainView layout), with every value coming from the timeline instead of the mouse.

const at = (x: number, y: number, w: number, h: number) => ({ "--x": x, "--y": y, "--w": w, "--h": h }) as CSSProperties;
const noop = () => {};

/** The engine's latency at 48 kHz (AutoTuneEngine::prepare), as the header shows it. */
function latencyMs(mode: number) {
  const sampleRate = 48000;
  const samples = mode === 1 ? Math.max(8, Math.round(sampleRate * 0.0002)) + Math.round(sampleRate / 400) : 3 * Math.ceil(sampleRate / 65);
  return ((1000 * samples) / sampleRate).toFixed(1);
}

type Props = {
  params: Params;
  graph: GraphModel;
  gauge: GaugeModel;
  pillTarget: number;
  outputFrom: number;
  version: string;
};

export function PluginWindow({ params, graph, gauge, pillTarget, outputFrom, version }: Props) {
  const mask = pitchClassMask(params.key, params.scale, params.notes);
  const formantEnabled = params.mode === 0;

  return (
    <div className="st-demo" style={{ width: 1000 }}>
      <div className="st-window" style={{ boxShadow: "0 50px 140px -20px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.1)" }}>
        <div className="st-header">
          <div className="st-brand">
            <PluginLogo className="st-at st-logo" style={at(20, 19, 30, 30)} />
            <span className="st-at st-wordmark" style={at(62, 18, 124, 32)}>
              SNAPTUNE
            </span>
            <span className="st-at st-chip" style={at(192, 26, 40, 19)}>
              {version}
            </span>
          </div>
          <Combo className="st-at st-presets" style={at(232, 19, 196, 30)} label="Presets" value={matchingPreset(params)} onChange={noop} tip="">
            <option value={-1} hidden disabled>
              Presets
            </option>
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </Combo>
          <div className="st-at st-latency" style={at(690, 14, 128, 40)}>
            <span className="st-caption">Latency</span>
            <span className="st-latency-value">{latencyMs(params.mode)} ms</span>
          </div>
          <ModeSwitch className="st-at" style={at(830, 19, 150, 30)} mode={params.mode} onChange={noop} tip="" />
        </div>

        <section className="st-panel st-at st-scalebar" style={at(20, 66, 960, 64)}>
          <div className="st-field st-key-field">
            <span className="st-caption st-at" style={at(18, 7, 100, 15)}>
              Key
            </span>
            <Combo className="st-at" style={at(16, 26, 70, 30)} label="Key" value={params.key} onChange={noop} tip="">
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </Combo>
          </div>
          <div className="st-field st-scale-field">
            <span className="st-caption st-at" style={at(100, 7, 168, 15)}>
              Scale
            </span>
            <Combo className="st-at" style={at(98, 26, 168, 30)} label="Scale" value={params.scale} onChange={noop} tip="">
              {SCALE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </Combo>
          </div>
          <div className="st-field st-notes-field">
            <span className="st-caption st-at" style={at(292, 7, 508, 15)}>
              Scale notes
            </span>
            <NotePills className="st-at" style={at(290, 26, 508, 30)} allowed={mask} held={0} target={pillTarget} onToggle={noop} tip="" />
          </div>
          <div className="st-field st-target-field">
            <span className="st-caption st-at" style={at(828, 7, 118, 15)}>
              Target
            </span>
            <MidiToggle className="st-at" style={at(826, 26, 118, 30)} on={params.midi} onChange={noop} tip="" />
          </div>
        </section>

        <section className="st-panel st-at st-hero" style={at(20, 142, 310, 328)}>
          <TunerGauge className="st-at st-gauge" style={at(10, 8, 290, 164)} model={gauge} version={0} />
          <span className="st-caption st-dim st-at st-retune-caption" style={at(0, 178, 310, 16)}>
            Retune speed
          </span>
          <Knob hero className="st-at st-hero-knob" style={at(65, 196, 180, 128)} param="retune" value={params.retune} onChange={noop} />
        </section>

        <section className="st-panel st-at st-graph" style={at(342, 142, 638, 328)}>
          <PitchGraph className="st-graph-svg" model={graph} width={636} height={326} mask={mask} version={0} onChange={noop} outputFrom={outputFrom} />
        </section>

        <section className="st-panel st-at st-controls" style={at(20, 482, 960, 138)}>
          {SMALL_KNOBS.map((id, i) => {
            const disabled = id === "formant" && !formantEnabled;
            const x = 49 + 150 * i;
            return (
              <div key={id} className="st-cell">
                <span className={`st-caption st-at st-knob-caption ${disabled ? "" : "st-dim"}`} style={at(x - 40, 18, 164, 15)}>
                  {KNOBS[id].title}
                  {disabled && <span className="st-studio-only"> (Studio only)</span>}
                </span>
                <Knob className="st-at st-small-knob" style={at(x, 34, 84, 92)} param={id} value={params[id]} disabled={disabled} onChange={noop} />
              </div>
            );
          })}
          <span className="st-at st-divider" style={at(776, 18, 1, 102)} />
          <div className="st-field st-voice-field">
            <span className="st-caption st-dim st-at" style={at(792, 18, 154, 15)}>
              Voice
            </span>
            <Combo className="st-at" style={at(790, 56, 154, 30)} label="Voice" value={params.voice} onChange={noop} tip="">
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
    </div>
  );
}
