import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The version being built, from the plugin's CMakeLists.txt. Pages show the released version
// (lib/release.ts); this is only the fallback when GitHub can't be reached.
function readVersion(): string {
  try {
    const cmake = readFileSync(join(process.cwd(), "..", "CMakeLists.txt"), "utf8");
    return cmake.match(/project\(SnapTune VERSION ([0-9.]+)/)?.[1] ?? "1.2.0";
  } catch {
    return "1.2.0";
  }
}

export const version = readVersion();

const repo = "https://github.com/NicoFerni/snaptune";

export const links = {
  repo,
  // The installers' own links come from the published release (lib/release.ts).
  releases: `${repo}/releases/latest`,
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

// True when a file exists in public/: the cover film is optional, and the cover shows the screenshot
// without it.
export function hasPublicFile(path: string): boolean {
  return existsSync(join(process.cwd(), "public", path));
}
