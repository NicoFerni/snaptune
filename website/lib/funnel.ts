import { isDawHost, NOT_DAWS, type StoredInstall, type TelemetryEvent } from "@/lib/telemetry";

// The activation funnel behind the admin panel's download and install cards: from a download to
// someone still using SnapTune a week later, for the installs first seen in a window, with the same
// steps split by DAW, OS and the version they started on so the leaks show where they are.

const DAY = 24 * 60 * 60 * 1000;

/** One step: `count` installs made it out of `base`, the installs from the step before that have
    been around long enough to make it (a day-old install can't have come back a week later). */
export type FunnelStep = { label: string; count: number; base: number | null; note: string };

/** A group of installs, with how many of those at least three days old opened SnapTune a second
    time, and came back on a later day, within three days of their first session. */
export type SegmentRow = { label: string; installs: number; base: number; twice: number; cameBack: number };

export type FunnelWindow = {
  key: string;
  label: string;
  since: string;
  steps: FunnelStep[];
  /** The whole window as one segment, to compare each group against. */
  overall: SegmentRow;
  segments: { title: string; rows: SegmentRow[] }[];
};

export type OsConversion = { os: string; downloads: number; updates: number; installs: number };

export type FunnelData = {
  windows: FunnelWindow[];
  byOs: OsConversion[];
  byOsSince: string | null;
  search: { clicks: number; impressions: number } | null;
};

// Plugin scanners, script runners and processes with random names load the plugin without being a
// DAW anyone records in, so they're counted together.
export function hostLabel(host: string): string {
  if (!host) return "Unknown";
  if (NOT_DAWS.test(host)) return "Other";
  // One word with a run of six consonants, or digits in the middle of mixed case (not a trailing
  // version like Audacity4): a generated name, not a product.
  if (!/\s/.test(host) && (/[bcdfghjklmnpqrstvwxz]{6}/i.test(host) || (/\d[a-z]/i.test(host) && /[a-z]/.test(host) && /[A-Z]/.test(host)))) return "Other";
  return host;
}

export function osFamily(os: string): string {
  if (/mac|os ?x/i.test(os)) return "macOS";
  if (/windows/i.test(os)) return "Windows";
  if (/linux/i.test(os)) return "Linux";
  return os || "Unknown";
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function day(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** What each install did in DAWs, from the event list: sessions, first and last, and where it
    started. Installs whose events were trimmed away fall back to what the installs hash kept. */
type Usage = { install: StoredInstall; times: number[]; first: number; last: number; host: string; os: string; version: string };

// Rates are compared over the same span after each install's first session, so a version or DAW
// that's only been around a few days isn't marked down for it.
const SPAN = 3 * DAY;

/** A second DAW session within `span` of the first. */
function twiceWithin(u: Usage, span: number): boolean {
  return u.times.length >= 2 && u.times[1] - u.first <= span;
}

/** A session on a later day (a full day or more after the first), within `span` of the first. */
function backWithin(u: Usage, span: number): boolean {
  return u.times.some((t) => t - u.first > DAY && t - u.first <= span);
}

function usage(installs: StoredInstall[], events: TelemetryEvent[]): Usage[] {
  const byInstall = new Map<string, TelemetryEvent[]>();
  // Events are newest first; walk them oldest first.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== "launch" || !isDawHost(e.host)) continue;
    const list = byInstall.get(e.install);
    if (list) list.push(e);
    else byInstall.set(e.install, [e]);
  }
  return installs.map((install) => {
    const launches = byInstall.get(install.id);
    // Only the totals are left: take the second session to be the last one.
    if (!launches) {
      const times = install.launches >= 2 ? [install.first, install.last] : [install.first];
      return { install, times, first: install.first, last: install.last, host: install.host, os: install.os, version: install.version };
    }
    const [start] = launches;
    return {
      install,
      times: launches.map((e) => e.t),
      first: start.t,
      last: launches[launches.length - 1].t,
      host: start.host,
      os: start.os,
      version: start.version,
    };
  });
}

/** Installs that showed up on a different version than their session before: each was a download
    that updated SnapTune rather than bringing someone new. */
function updates(events: TelemetryEvent[]): { t: number; os: string }[] {
  const changes: { t: number; os: string }[] = [];
  const lastVersion = new Map<string, string>();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== "launch") continue;
    const before = lastVersion.get(e.install);
    if (before && before !== e.version) changes.push({ t: e.t, os: osFamily(e.os) });
    lastVersion.set(e.install, e.version);
  }
  return changes;
}

function row(label: string, us: Usage[], now: number): SegmentRow {
  const old = us.filter((u) => now - u.first >= SPAN);
  return { label, installs: us.length, base: old.length, twice: old.filter((u) => twiceWithin(u, SPAN)).length, cameBack: old.filter((u) => backWithin(u, SPAN)).length };
}

function segment(title: string, cohort: Usage[], now: number, key: (u: Usage) => string): { title: string; rows: SegmentRow[] } {
  const groups = new Map<string, Usage[]>();
  for (const u of cohort) {
    const k = key(u) || "Unknown";
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  const rows = [...groups].map(([label, us]) => row(label, us, now));
  return { title, rows: rows.sort((a, b) => b.installs - a.installs).slice(0, 8) };
}

type Input = {
  now: number;
  installs: StoredInstall[];
  events: TelemetryEvent[];
  /** GitHub's download total now and the totals the panel saved per day (YYYY-MM-DD, total). */
  downloads: number;
  history: [string, number][] | null;
  /** Downloads through the site's buttons, one per IP, per window key. */
  siteDownloads: Record<string, number | null>;
  /** Every release file with its download count. */
  assets: { name: string; version: string; os: string; download_count: number }[];
  search: { clicks: number; impressions: number } | null;
};

export function buildFunnel({ now, installs, events, downloads, history, siteDownloads, assets, search }: Input): FunnelData {
  const used = usage(installs, events);
  const changes = updates(events);

  const windows = [
    { key: "7", days: 7, label: "Last 7 days" },
    { key: "30", days: 30, label: "Last 30 days" },
  ].map(({ key, days, label }): FunnelWindow => {
    // The window starts at the download total saved on its first day, or on the first day the panel
    // saved one, so downloads and installs cover the same days.
    const from = day(now - days * DAY);
    const baseline = history?.filter(([d]) => d <= from).at(-1) ?? history?.[0] ?? null;
    const since = baseline?.[0] ?? from;
    const start = Date.parse(since);

    const cohort = used.filter((u) => day(u.install.first) >= since);
    const updated = changes.filter((c) => c.t >= start).length;
    const downloaded = baseline ? Math.max(0, downloads - baseline[1] - updated) : null;

    const old = cohort.filter((u) => now - u.first >= SPAN);
    const twice = old.filter((u) => twiceWithin(u, SPAN));
    const cameBack = twice.filter((u) => u.last - u.first > DAY);
    const weekOld = cameBack.filter((u) => now - u.first > 7 * DAY);
    const stayed = weekOld.filter((u) => u.last - u.first >= 7 * DAY);
    const site = siteDownloads[key];

    const steps: FunnelStep[] = [
      ...(downloaded === null
        ? []
        : [{
            label: "Downloaded",
            count: downloaded,
            base: null,
            note: `GitHub's count, ${updated} updates left out${site != null ? ` · ${site} through the site's buttons, one per IP` : ""}. Bots and retried downloads are in it, so every rate after this is a floor.`,
          }]),
      { label: "Installed", count: cohort.length, base: downloaded, note: "First ping from a DAW: the plugin loaded on a new device. A DAW's own plugin scan counts too." },
      {
        label: "Opened it twice",
        count: twice.length,
        base: old.length,
        note: `A second DAW session within three days of the first, of the installs three days old (${cohort.length - old.length} aren't yet). If the DAW scans plugins in its own process, the scan can be the first.`,
      },
      {
        label: "Came back another day",
        count: cameBack.length,
        base: twice.length,
        note: "A session a full day or more after the first, at any time since.",
      },
      // Installs from the last seven days can't have a session a week after their first yet.
      ...(days > 7
        ? [{
            label: "Still using it a week later",
            count: stayed.length,
            base: weekOld.length,
            note: `A session seven days or more after the first; of the ones that came back and are a week old (${cameBack.length - weekOld.length} aren't yet).`,
          }]
        : []),
    ];

    return {
      key,
      label,
      since,
      steps,
      overall: row("All", cohort, now),
      segments: [
        segment("By DAW", cohort, now, (u) => hostLabel(u.host)),
        segment("By OS", cohort, now, (u) => osFamily(u.os)),
        segment("By version they started on", cohort, now, (u) => u.version),
      ],
    };
  });

  // Downloads to installs by OS, all time, over the releases that send pings: the oldest version any
  // install has reported, and every release since.
  const versions = [...new Set(events.map((e) => e.version).filter(Boolean))].sort(compareVersions);
  const oldest = versions[0];
  const pinging = oldest ? assets.filter((a) => compareVersions(a.version.replace(/^v/, ""), oldest) >= 0) : [];
  const byOs = ["Windows", "macOS", "Linux"].map((os) => ({
    os,
    downloads: pinging.filter((a) => a.os === os).reduce((sum, a) => sum + a.download_count, 0),
    updates: changes.filter((c) => c.os === os).length,
    installs: installs.filter((i) => osFamily(i.os) === os).length,
  }));

  return { windows, byOs, byOsSince: oldest ?? null, search };
}
