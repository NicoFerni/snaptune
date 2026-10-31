// Storage for the plugin's usage pings (../Source/Telemetry.h), in Upstash Redis over its REST API.
// Add Upstash Redis to the Vercel project from the Marketplace; it sets KV_REST_API_URL and
// KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_* pair).
//
// Two keys:
//   installs  hash: install id -> Install (latest version/OS/host, first and last seen, launches)
//   events    list, newest first, capped at MAX_EVENTS: every launch and unclean exit

export type Install = {
  first: number;
  last: number;
  launches: number;
  version: string;
  os: string;
  arch: string;
  host: string;
  format: string;
  country: string;
  // Set once the install has launched in a DAW, not only in a scanner or script.
  daw?: boolean;
};

export type TelemetryEvent = {
  t: number;
  type: "launch" | "unclean_exit";
  install: string;
  version: string;
  os: string;
  arch: string;
  host: string;
  format: string;
  country: string;
};

export const MAX_EVENTS = 20000;

// The developer's own installs, left out of every metric so testing doesn't skew them.
// An install's id is in ~/Library/Application Support/SnapTune/install-id (macOS).
const IGNORED_INSTALLS = new Set(["3467e8d7-5552-466a-be7e-5374d0b31859"]);

// Hosts that aren't DAWs: scripts, plugin scanners and people's own test hosts load the plugin and
// exit without destroying it, so their unclean exits say nothing about crashes.
export const TOOL_HOSTS = new Set(["python", "vst3cat", "Auralis-picker-pitch-live-fx"]);

// Plugin scanners and validators, by executable name.
export const NOT_DAWS = /^(pythonw?|vstscanner|vst3cat|pluginval|.*scanner.*|.*validator.*)$/i;

export function isDawHost(host: string): boolean {
  return Boolean(host) && !TOOL_HOSTS.has(host) && !NOT_DAWS.test(host);
}

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const storageConfigured = Boolean(url && token);

// Runs several Redis commands in one request and returns their results in order.
export async function redis(...commands: (string | number)[][]): Promise<unknown[]> {
  if (!url || !token) throw new Error("Upstash Redis is not configured");

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);

  const replies = (await res.json()) as { result?: unknown; error?: string }[];
  return replies.map((r) => {
    if (r.error) throw new Error(`Upstash: ${r.error}`);
    return r.result;
  });
}

/** An install as read back, with the anonymous id it's stored under. */
export type StoredInstall = Install & { id: string };

export async function readTelemetry(): Promise<{ installs: StoredInstall[]; events: TelemetryEvent[] }> {
  const [hash, list] = await redis(["HGETALL", "installs"], ["LRANGE", "events", 0, MAX_EVENTS - 1]);

  // HGETALL comes back as a flat [field, value, field, value, …] array.
  const fields = (hash as string[]) ?? [];
  const events = ((list as string[]) ?? [])
    .map((e) => JSON.parse(e) as TelemetryEvent)
    .filter((e) => !IGNORED_INSTALLS.has(e.install));

  // One install is one device (the id lives in the user's app data, shared by every DAW and
  // version), and it only counts once it has run in a DAW: an install only a scanner or
  // validator ever loaded isn't a user. Installs from before the `daw` flag fall back to events.
  const inDaw = new Set(events.filter((e) => e.type === "launch" && isDawHost(e.host)).map((e) => e.install));

  const installs: StoredInstall[] = [];
  for (let i = 1; i < fields.length; i += 2) {
    const id = fields[i - 1];
    const install: Install = JSON.parse(fields[i]);
    if (!IGNORED_INSTALLS.has(id) && (install.daw || inDaw.has(id) || isDawHost(install.host)))
      installs.push({ ...install, id });
  }
  return { installs, events };
}

// GitHub only reports each release file's total downloads, so the admin panel keeps one total per
// day (hash `downloads`: YYYY-MM-DD -> total) each time it's opened, to draw downloads over time.
export async function snapshotDownloads(total: number): Promise<[string, number][]> {
  const today = new Date().toISOString().slice(0, 10);
  const [, all] = await redis(["HSET", "downloads", today, String(total)], ["HGETALL", "downloads"]);
  const fields = (all as string[]) ?? [];
  const days: [string, number][] = [];
  for (let i = 0; i < fields.length; i += 2) days.push([fields[i], Number(fields[i + 1])]);
  return days.sort((a, b) => a[0].localeCompare(b[0]));
}

// Downloads through the site's buttons (app/download/[os]), one per IP: each IP goes, hashed, into
// HyperLogLogs (`dl:all`, `dl:<os>`, `dl:day:YYYY-MM-DD`), which keep only an estimate of how many
// distinct values they've seen, never the values.
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`snaptune:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex").slice(0, 32);
}

export async function recordDownload(ip: string, os: string): Promise<void> {
  const id = await hashIp(ip);
  const today = new Date().toISOString().slice(0, 10);
  await redis(["SET", "dl:since", today, "NX"], ["PFADD", "dl:all", id], ["PFADD", `dl:${os}`, id], ["PFADD", `dl:day:${today}`, id]);
}

export type UniqueDownloads = { since: string | null; all: number; last7: number; lastDay: number; byOs: [string, number][] };

export async function readUniqueDownloads(): Promise<UniqueDownloads> {
  const days = Array.from({ length: 7 }, (_, i) => `dl:day:${new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)}`);
  const [since, all, last7, lastDay, mac, windows, linux] = (await redis(
    ["GET", "dl:since"],
    ["PFCOUNT", "dl:all"],
    ["PFCOUNT", ...days],
    ["PFCOUNT", days[0]],
    ["PFCOUNT", "dl:mac"],
    ["PFCOUNT", "dl:windows"],
    ["PFCOUNT", "dl:linux"],
  )) as [string | null, ...number[]];
  return { since, all, last7, lastDay, byOs: [["Mac", mac], ["Windows", windows], ["Linux", linux]] };
}
