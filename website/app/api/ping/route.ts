import { MAX_EVENTS, redis, storageConfigured, type Install, type TelemetryEvent } from "@/lib/telemetry";

// Receives the plugin's usage ping (../Source/Telemetry.cpp): one per DAW session, with the
// install's anonymous id, this session, and earlier sessions that ended without a clean shutdown.

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max = 60): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

type Session = { version: string; os: string; arch: string; host: string; format: string; started: number };

function session(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const started = typeof v.started === "number" && Number.isFinite(v.started) ? v.started : Date.now();
  return {
    version: text(v.version, 20),
    os: text(v.os),
    arch: text(v.arch, 10),
    host: text(v.host),
    format: text(v.format, 20),
    started: Math.min(started, Date.now()),
  };
}

export async function POST(request: Request) {
  if (!storageConfigured) return new Response(null, { status: 503 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const install = text(payload.install, 36);
  const current = session(payload.session);
  if (!uuid.test(install) || !current) return new Response(null, { status: 400 });

  // Vercel geolocates the request; only the country is kept, never the IP.
  const country = request.headers.get("x-vercel-ip-country") ?? "";
  const now = Date.now();

  const event = (s: Session, type: TelemetryEvent["type"], t: number): TelemetryEvent => ({
    t,
    type,
    install,
    version: s.version,
    os: s.os,
    arch: s.arch,
    host: s.host,
    format: s.format,
    country,
  });

  const exits = Array.isArray(payload.uncleanExits) ? payload.uncleanExits.slice(0, 10) : [];
  const events = [
    ...exits.map(session).filter((s): s is Session => s !== null).map((s) => event(s, "unclean_exit", s.started)),
    event(current, "launch", now),
  ];

  const [previous] = (await redis(["HGET", "installs", install])) as (string | null)[];
  const before: Install | null = previous ? JSON.parse(previous) : null;
  const updated: Install = {
    first: before?.first ?? now,
    last: now,
    launches: (before?.launches ?? 0) + 1,
    version: current.version,
    os: current.os,
    arch: current.arch,
    host: current.host,
    format: current.format,
    country,
  };

  await redis(
    ["HSET", "installs", install, JSON.stringify(updated)],
    ["LPUSH", "events", ...events.map((e) => JSON.stringify(e))],
    ["LTRIM", "events", 0, MAX_EVENTS - 1],
  );

  return new Response(null, { status: 204 });
}
