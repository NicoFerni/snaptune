import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The version comes from the plugin's CMakeLists.txt, so a release only needs bumping there.
// Read once at module scope: it's fixed for the whole build.
function readVersion(): string {
  try {
    const cmake = readFileSync(join(process.cwd(), "..", "CMakeLists.txt"), "utf8");
    return cmake.match(/project\(SnapTune VERSION ([0-9.]+)/)?.[1] ?? "1.1.0";
  } catch {
    return "1.1.0";
  }
}

export const version = readVersion();

const repo = "https://github.com/NicoFerni/snaptune";

export const links = {
  repo,
  releases: `${repo}/releases/latest`,
  download: `${repo}/releases/download/v${version}/SnapTune-${version}-macOS.zip`,
  readme: `${repo}#readme`,
  issues: `${repo}/issues`,
  license: `${repo}/blob/main/LICENSE`,
};

// Ko-fi page and the Apple Developer Program goal. Update `raised` by hand from the Ko-fi dashboard;
// the progress bar stays hidden while it's 0.
export const kofi = {
  url: "https://ko-fi.com/nicofernandev",
  goal: 99,
  raised: 0,
};

export const quarantineCommand =
  "xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/VST3/SnapTune.vst3 ~/Library/Audio/Plug-Ins/Components/SnapTune.component";

// True when a file exists in public/. Demo media is optional: sections without their files are left
// out of the production build and shown as placeholders in `next dev`.
export function hasPublicFile(path: string): boolean {
  return existsSync(join(process.cwd(), "public", path));
}

// Before/after clips: the same dry take, then rendered through SnapTune. Drop the files in
// public/audio/ as <id>-dry.mp3 and <id>-tuned.mp3.
export const clips = [
  { id: "hard-tune", preset: "Hard Tune", note: "Retune Speed 0 ms: the robotic stair-step." },
  { id: "melodic-trap", preset: "Melodic Trap", note: "Tight, but slides between notes survive." },
  { id: "natural", preset: "Natural", note: "Pulled in tune without sounding tuned." },
].map((c) => ({ ...c, dry: `/audio/${c.id}-dry.mp3`, tuned: `/audio/${c.id}-tuned.mp3` }));

// Screen recording of FL Studio's piano roll driving the pitch graph.
export const midiDemo = "/midi-demo.mp4";
