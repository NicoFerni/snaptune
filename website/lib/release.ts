import { links, version as builtVersion } from "@/lib/site";

// The download links come from the release that is actually published on GitHub, not from the
// version in CMakeLists.txt: bumping the version or merging before the release is out must never
// point the buttons at files that don't exist yet. Pages read it at most every ten minutes, so a new
// release reaches the site on its own shortly after the Build workflow publishes it.

export type Release = {
  /** The released version, e.g. "2.0.0". */
  version: string;
  /** Direct download of each installer, or null when the release has none for that system. */
  mac: string | null;
  windows: string | null;
  linux: string | null;
};

type GitHubRelease = { tag_name: string; assets: { name: string; browser_download_url: string }[] };

const asset = (release: GitHubRelease, suffix: string) => release.assets.find((a) => a.name.endsWith(suffix))?.browser_download_url ?? null;

export async function latestRelease(): Promise<Release> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch("https://api.github.com/repos/NicoFerni/snaptune/releases/latest", { headers, next: { revalidate: 600 } });
    if (res.ok) {
      const release = (await res.json()) as GitHubRelease;
      return {
        version: release.tag_name.replace(/^v/, ""),
        mac: asset(release, "-macOS.pkg"),
        windows: asset(release, "-Windows-Setup.exe"),
        linux: asset(release, "-Linux.tar.gz"),
      };
    }
  } catch {
    // Offline build or GitHub down: fall through.
  }

  // Without GitHub's answer, every button opens the latest release's page, which always exists.
  return { version: builtVersion, mac: links.releases, windows: links.releases, linux: links.releases };
}
