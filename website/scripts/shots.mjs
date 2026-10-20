// Renders the plugin window at 4x (Studio and Live) and cuts every image the site and README use from
// it, each sized for a 2x (Retina) screen at the width the page shows it. Run after a UI change:
//
//   cmake --build build --target SnapTuneTests   (from the repo root)
//   npm run shots                                 (from website/)
//
// Writes public/shots/*.webp, lib/shots.json (sizes for the page), public/screenshot.png (the
// window in the link preview, app/opengraph-image.tsx) and ../docs/screenshot.png (README).

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..", "..");
const runner = join(root, "build", "SnapTuneTests_artefacts", "Release", "SnapTuneTests");
const scratch = mkdtempSync(join(tmpdir(), "snaptune-shots-"));
// Studio at 8x, for the close-up of one knob; Live at 4x.
const windows = { studio: join(scratch, "studio.png"), live: join(scratch, "live.png") };
const pixelScale = { studio: "8", live: "4" };

for (const [mode, file] of Object.entries(windows)) execFileSync(runner, ["--snapshot", file, mode, "1.0", pixelScale[mode]], { stdio: "inherit" });

// Regions of the 1000 x 640 window in its own pixels, the window they come from, and the CSS width
// each is shown at. Each is cut close to square around one part, with its edges in the gaps between
// panels and controls, so no neighbour is sliced through a word.
const shots = {
  tuner: { from: "studio", region: { x: 8, y: 132, w: 334, h: 350 }, cssWidth: 700 },
  keys: { from: "studio", region: { x: 307, y: 56, w: 384, h: 414 }, cssWidth: 700 },
  voice: { from: "studio", region: { x: 310, y: 485, w: 200, h: 132 }, cssWidth: 700 },
  graph: { from: "studio", region: { x: 335, y: 134, w: 410, h: 344 }, cssWidth: 700 },
  modes: { from: "live", region: { x: 560, y: 0, w: 440, h: 400 }, cssWidth: 700 },
};

const outDir = join(import.meta.dirname, "..", "public", "shots");
mkdirSync(outDir, { recursive: true });
const manifest = {};

for (const [name, { from, region, cssWidth }] of Object.entries(shots)) {
  const { width: W } = await sharp(windows[from]).metadata();
  const scale = W / 1000;
  const width = Math.round(region.w * scale);
  const target = Math.min(width, cssWidth * 2);

  const info = await sharp(windows[from])
    .extract({ left: Math.round(region.x * scale), top: Math.round(region.y * scale), width, height: Math.round(region.h * scale) })
    .resize({ width: target, kernel: "lanczos3" })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(join(outDir, `${name}.webp`));

  manifest[name] = { src: `/shots/${name}.webp`, width: info.width, height: info.height };
  console.log(`${name}.webp  ${info.width} x ${info.height}  ${Math.round(info.size / 1024)} KB`);
}

writeFileSync(join(import.meta.dirname, "..", "lib", "shots.json"), JSON.stringify(manifest, null, 2) + "\n");

// The window for the link preview (ImageResponse takes PNG or JPEG) and the README image.
await sharp(windows.studio).resize({ width: 1600, kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(join(import.meta.dirname, "..", "public", "screenshot.png"));
await sharp(windows.studio).resize({ width: 2000, kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(join(root, "docs", "screenshot.png"));
console.log("screenshot.png (1600) and docs/screenshot.png (2000)");
