import { cache } from "react";
import { DAY, day, dayStart } from "@/lib/days";
import { readFeedback, readNotice } from "@/lib/feedback";
import { buildFunnel, type FunnelWindow } from "@/lib/funnel";
import { mailConfigured, readInboxes } from "@/lib/mail";
import { readSearch, searchConfigured } from "@/lib/search-console";
import { isDawHost, readTelemetry, readUniqueDownloads, snapshotDownloads, storageConfigured, type StoredInstall, type TelemetryEvent } from "@/lib/telemetry";

// Everything the admin pages read, each source once per request (React's cache), so every section
// of a page can ask for what it needs and stream in on its own.

export const repo = "NicoFerni/snaptune";
export { DAY, day };

/** Unclean exits above this share of DAW sessions are worth a look. */
export const EXIT_ALERT = 0.02;

type Release = { tag_name: string; published_at: string; assets: { name: string; download_count: number }[] };
export type Issue = { number: number; title: string; html_url: string; state: string; created_at: string; comments: number; labels: { name: string }[]; pull_request?: unknown };
type Repo = { stargazers_count: number; forks_count: number };
type Runs = { workflow_runs: { name: string; conclusion: string | null; status: string; created_at: string; html_url: string }[] };

async function github<T>(path: string): Promise<T | null> {
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers, next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** One "now" for the whole request, so every section measures from the same moment. */
export const requestTime = cache(() => Date.now());

export const getTelemetry = cache(async () => (storageConfigured ? readTelemetry().catch((e: Error) => e) : null));
export const getUnique = cache(async () => (storageConfigured ? readUniqueDownloads().catch(() => null) : null));
export const getReleases = cache(() => github<Release[]>("/releases?per_page=100"));
export const getIssues = cache(() => github<Issue[]>("/issues?state=all&per_page=100"));
export const getRepo = cache(() => github<Repo>(""));
export const getChecks = cache(() => github<Runs>("/actions/workflows/downloads.yml/runs?per_page=20"));
export const getBuilds = cache(() => github<Runs>("/actions/workflows/build.yml/runs?branch=main&per_page=5"));
export const getInbox = cache(async () => (mailConfigured ? readInboxes(30).catch((e: Error) => e) : null));
export const getSearch = cache(async () => (searchConfigured ? readSearch().catch((e: Error) => e) : null));
export const getFeedback = cache(async (limit: number) => (storageConfigured ? readFeedback(limit).catch(() => null) : null));
export const getNotice = cache(async () => (storageConfigured ? readNotice().catch(() => null) : null));

const totalDownloads = (releases: Release[]) => releases.reduce((sum, r) => sum + r.assets.reduce((s, a) => s + a.download_count, 0), 0);

/** The daily download totals; opening the panel saves today's. */
export const getHistory = cache(async () => {
  const releases = await getReleases();
  return storageConfigured && releases ? snapshotDownloads(totalDownloads(releases)).catch(() => null) : null;
});

/** The latest run that finished with a verdict: skipped runs say nothing, and cancelled ones were
    only replaced by a newer push (the workflow cancels in-progress runs on the same branch). */
export function lastRun(runs: Runs | null) {
  return runs?.workflow_runs.find((r) => r.status === "completed" && r.conclusion !== "skipped" && r.conclusion !== "cancelled") ?? null;
}

export function assetOs(name: string): string {
  if (/macos/i.test(name)) return "macOS";
  if (/windows/i.test(name)) return "Windows";
  if (/linux/i.test(name)) return "Linux";
  return "Other";
}

export function countBy<T>(items: T[], key: (item: T) => string, weight: (item: T) => number = () => 1): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item) || "Unknown";
    counts.set(k, (counts.get(k) ?? 0) + weight(item));
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

export function ago(t: number): string {
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

export function percent(part: number, whole: number | null): string {
  return whole ? `${((part / whole) * 100).toFixed(1)}\u00a0%` : "–";
}

/** Change from one period to the next, signed: "+40 %", "−12 %". */
export function growth(current: number, before: number): string {
  if (!before) return "–";
  const change = (current / before - 1) * 100;
  return `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(0)}\u00a0%`;
}

/** New installs in a funnel window against the same number of days just before it, per day. The
    comparison needs installs from the whole earlier span; until then it says from when. */
function pace(w: FunnelWindow, installs: StoredInstall[], firstSeen: number) {
  const target = Number(w.key);
  const start = dayStart(w.since);
  const before = start - w.days * DAY;
  const previous = installs.filter((i) => i.first >= before && i.first < start).length;
  const complete = firstSeen <= before;
  return {
    perDay: w.installed / w.days,
    previousPerDay: previous / w.days,
    previous,
    complete,
    readyOn: day(firstSeen + (2 * target - 1) * DAY),
    change: complete ? growth(w.installed, previous) : "–",
    // Coral only for a real drop, not a day's noise.
    down: complete && w.installed < previous * 0.9,
  };
}

/** The usage numbers every overview section shares, worked out once. */
export const getMetrics = cache(async () => {
  const [telemetry, unique, releases, history, search] = await Promise.all([getTelemetry(), getUnique(), getReleases(), getHistory(), getSearch()]);
  const now = requestTime();
  const installs: StoredInstall[] = telemetry && !(telemetry instanceof Error) ? telemetry.installs : [];
  const events: TelemetryEvent[] = telemetry && !(telemetry instanceof Error) ? telemetry.events : [];

  const active7 = installs.filter((i) => now - i.last < 7 * DAY);
  const active30 = installs.filter((i) => now - i.last < 30 * DAY);
  const recent = events.filter((e) => now - e.t < 30 * DAY);
  // Sessions and unclean exits count DAWs only: scripts, offline renderers and scanners load the
  // plugin and exit without destroying it, so their exits say nothing about crashes.
  const launches30 = recent.filter((e) => e.type === "launch" && isDawHost(e.host));
  const allExits30 = recent.filter((e) => e.type === "unclean_exit");
  const exits30 = allExits30.filter((e) => isDawHost(e.host));

  const days = Array.from({ length: 30 }, (_, i) => day(now - (29 - i) * DAY));
  const sessionsPerDay = days.map((d) => ({
    day: d,
    launches: launches30.filter((e) => day(e.t) === d).length,
    exits: exits30.filter((e) => day(e.t) === d).length,
  }));
  const newPerDay = days.map((d) => ({ day: d, value: installs.filter((i) => day(i.first) === d).length }));

  // Downloads per day, from the daily totals the panel keeps. A total is only saved on the days the
  // panel is opened, so the downloads between two saved days are spread evenly over the days between.
  const downloadsPerDay = (history ?? [])
    .slice(1)
    .flatMap(([d, total], i) => {
      const gap = Math.max(1, Math.round((dayStart(d) - dayStart(history![i][0])) / DAY));
      const each = Math.max(0, total - history![i][1]) / gap;
      return Array.from({ length: gap }, (_, k) => ({ day: day(dayStart(d) - (gap - 1 - k) * DAY), value: Math.round(each) }));
    })
    .slice(-30);

  const assets = (releases ?? []).flatMap((r) => r.assets.map((a) => ({ ...a, version: r.tag_name, os: assetOs(a.name) })));
  const downloads = releases ? totalDownloads(releases) : 0;

  const latestVersion = releases?.[0]?.tag_name.replace(/^v/, "");
  // Adoption among installs used this week: someone who tried it a month ago and never came back
  // can't update, so counting them would only say how many left.
  const onLatest = active7.filter((i) => i.version === latestVersion).length;

  // Coming back is a session a full day or more after the first: two sessions either side of
  // midnight are one evening, not a return. Installs less than a day old haven't had the chance.
  const couldReturn = installs.filter((i) => now - i.first > DAY);
  const returning = couldReturn.filter((i) => i.last - i.first > DAY).length;

  const searchReport = search && !(search instanceof Error) ? search : null;
  const searchClicks = searchReport?.perDay.reduce((sum, r) => sum + r.clicks, 0) ?? 0;
  const searchImpressions = searchReport?.perDay.reduce((sum, r) => sum + r.impressions, 0) ?? 0;

  const funnel = buildFunnel({
    now,
    installs,
    events,
    downloads,
    history,
    siteDownloads: { "7": unique?.last7 ?? null, "30": unique?.last30 ?? null, all: unique?.all ?? null },
    siteSince: unique?.since ?? null,
    assets,
    search: searchReport ? { clicks: searchClicks, impressions: searchImpressions } : null,
  });
  const firstSeen = installs.length ? Math.min(...installs.map((i) => i.first)) : now;
  const [w7, w30] = [funnel.windows.find((w) => w.key === "7")!, funnel.windows.find((w) => w.key === "30")!];

  // Stability by version, newest first: sessions and unclean exits in DAWs, all recorded time,
  // with where the exits happened.
  const dawEvents = events.filter((e) => isDawHost(e.host));
  const versions = [...new Set(dawEvents.map((e) => e.version))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const stability = versions.slice(0, 10).map((version) => {
    const sessions = dawEvents.filter((e) => e.version === version && e.type === "launch").length;
    const exits = dawEvents.filter((e) => e.version === version && e.type === "unclean_exit");
    return { version, sessions, exits: exits.length, where: countBy(exits, (e) => `${e.host} · ${e.os}`), last: exits[0]?.t ?? null };
  });

  return {
    now,
    telemetry,
    unique,
    installs,
    events,
    active7,
    active30,
    launches30,
    exits30,
    toolExits30: allExits30.length - exits30.length,
    sessionsPerDay,
    newPerDay,
    downloadsPerDay,
    assets,
    downloads,
    latestVersion,
    onLatest,
    couldReturn,
    returning,
    searchReport,
    searchClicks,
    searchImpressions,
    funnel,
    w7,
    w30,
    pace7: pace(w7, installs, firstSeen),
    pace30: pace(w30, installs, firstSeen),
    stability,
  };
});
