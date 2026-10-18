// Renders the plugin window at 4x and cuts every image the site and README use from it, each sized
// for a 2x (Retina) screen at the width the page shows it. Run after a UI change:
//
//   cmake --build build --target SnapTuneTests   (from the repo root)
//   npm run shots                                 (from website/)
//
// Writes public/shots/*.webp, lib/shots.json (sizes for the page), public/screenshot.png (social
// preview) and ../docs/screenshot.png (README).

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..", "..");
const runner = join(root, "build", "SnapTuneTests_artefacts", "Release", "SnapTuneTests");
const source = join(mkdtempSync(join(tmpdir(), "snaptune-shots-")), "window.png");

execFileSync(runner, ["--snapshot", source, "studio", "1.0", "4"], { stdio: "inherit" });

// Regions of the 1000 x 640 window as fractions of its size, and the CSS width each is shown at.
const shots = {
  window: { region: { x: 0, y: 0, w: 1, h: 1 }, cssWidth: 1100 },
  graph: { region: { x: 0.3425, y: 0.223, w: 0.6375, h: 0.512 }, cssWidth: 1100 },
  gauge: { region: { x: 0.03, y: 0.234, w: 0.29, h: 0.254 }, cssWidth: 540 },
  retune: { region: { x: 0.03, y: 0.522, w: 0.29, h: 0.205 }, cssWidth: 540 },
  notes: { region: { x: 0.306, y: 0.139, w: 0.514, h: 0.056 }, cssWidth: 640 },
};

const { width: W, height: H } = await sharp(source).metadata();
const outDir = join(import.meta.dirname, "..", "public", "shots");
mkdirSync(outDir, { recursive: true });
const manifest = {};

for (const [name, { region, cssWidth }] of Object.entries(shots)) {
  const left = Math.round(region.x * W);
  const top = Math.round(region.y * H);
  const width = Math.round(region.w * W);
  const height = Math.round(region.h * H);
  const target = Math.min(width, cssWidth * 2);

  const info = await sharp(source)
    .extract({ left, top, width, height })
    .resize({ width: target, kernel: "lanczos3" })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(join(outDir, `${name}.webp`));

  manifest[name] = { src: `/shots/${name}.webp`, width: info.width, height: info.height };
  console.log(`${name}.webp  ${info.width} x ${info.height}  ${Math.round(info.size / 1024)} KB`);
}

writeFileSync(join(import.meta.dirname, "..", "lib", "shots.json"), JSON.stringify(manifest, null, 2) + "\n");

// Social preview (Open Graph wants PNG or JPEG) and the README image.
await sharp(source).resize({ width: 1600, kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(join(import.meta.dirname, "..", "public", "screenshot.png"));
await sharp(source).resize({ width: 2000, kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(join(root, "docs", "screenshot.png"));
console.log("screenshot.png (1600) and docs/screenshot.png (2000)");
