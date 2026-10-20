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

export async function readTelemetry(): Promise<{ installs: Install[]; events: TelemetryEvent[] }> {
  const [hash, list] = await redis(["HGETALL", "installs"], ["LRANGE", "events", 0, MAX_EVENTS - 1]);

  // HGETALL comes back as a flat [field, value, field, value, …] array.
  const fields = (hash as string[]) ?? [];
  const installs: Install[] = [];
  for (let i = 1; i < fields.length; i += 2) installs.push(JSON.parse(fields[i]));

  const events = ((list as string[]) ?? []).map((e) => JSON.parse(e) as TelemetryEvent);
  return { installs, events };
}
