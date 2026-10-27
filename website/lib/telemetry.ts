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
  const installs: StoredInstall[] = [];
  for (let i = 1; i < fields.length; i += 2)
    if (!IGNORED_INSTALLS.has(fields[i - 1])) installs.push({ ...JSON.parse(fields[i]), id: fields[i - 1] });

  const events = ((list as string[]) ?? [])
    .map((e) => JSON.parse(e) as TelemetryEvent)
    .filter((e) => !IGNORED_INSTALLS.has(e.install));
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
