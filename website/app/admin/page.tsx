import type { Metadata } from "next";
import Link from "next/link";
import { mailConfigured, readInboxes } from "@/lib/mail";
import { readSearch, searchConfigured, type SearchRow } from "@/lib/search-console";
import { NOT_DAWS, readTelemetry, snapshotDownloads, storageConfigured, TOOL_HOSTS, type StoredInstall, type TelemetryEvent } from "@/lib/telemetry";

// The private panel: plugin usage from the telemetry pings, downloads and reports from GitHub,
// Google searches from Search Console, and the latest mail in the Zoho inboxes.
// proxy.ts keeps it behind ADMIN_PASSWORD.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin",
  robots: { index: false, follow: false },
};

const repo = "NicoFerni/snaptune";
const DAY = 24 * 60 * 60 * 1000;

type Release = { tag_name: string; published_at: string; assets: { name: string; download_count: number }[] };
type Issue = { number: number; title: string; html_url: string; state: string; created_at: string; labels: { name: string }[]; pull_request?: unknown };
type Repo = { stargazers_count: number; forks_count: number };
type Runs = { workflow_runs: { name: string; conclusion: string | null; status: string; created_at: string; html_url: string }[] };

async function github<T>(path: string): Promise<T | null> {
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers, next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function assetOs(name: string): string {
  if (/macos/i.test(name)) return "macOS";
  if (/windows/i.test(name)) return "Windows";
  if (/linux/i.test(name)) return "Linux";
  return "Other";
}

// Plugin scanners, script runners and processes with random names load the plugin without being a
// DAW anyone records in, so the Host panel counts them together.
function hostLabel(host: string): string {
  if (!host) return "Unknown";
  if (NOT_DAWS.test(host)) return "Other";
  // One word with a run of six consonants, or digits in the middle of mixed case (not a trailing
  // version like Audacity4): a generated name, not a product.
  if (!/\s/.test(host) && (/[bcdfghjklmnpqrstvwxz]{6}/i.test(host) || (/\d[a-z]/i.test(host) && /[a-z]/.test(host) && /[A-Z]/.test(host)))) return "Other";
  return host;
}

function countBy<T>(items: T[], key: (item: T) => string, weight: (item: T) => number = () => 1): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item) || "Unknown";
    counts.set(k, (counts.get(k) ?? 0) + weight(item));
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function day(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function ago(t: number): string {
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

function percent(part: number, whole: number): string {
  return whole ? `${((part / whole) * 100).toFixed(1)} %` : "–";
}

/** Argentina time (UTC-3, no daylight saving), for the hour-of-day chart. */
const LOCAL_OFFSET = -3;

async function load() {
  const [telemetry, releases, issues, repoInfo, checks, builds, mail, search] = await Promise.all([
    storageConfigured ? readTelemetry().catch((e: Error) => e) : null,
    github<Release[]>("/releases?per_page=100"),
    github<Issue[]>("/issues?state=all&per_page=100"),
    github<Repo>(""),
    github<Runs>("/actions/workflows/downloads.yml/runs?per_page=20"),
    github<Runs>("/actions/workflows/build.yml/runs?branch=main&per_page=5"),
    mailConfigured ? readInboxes(8).catch((e: Error) => e) : null,
    searchConfigured ? readSearch().catch((e: Error) => e) : null,
  ]);

  const downloads = (releases ?? []).reduce((sum, r) => sum + r.assets.reduce((s, a) => s + a.download_count, 0), 0);
  const history = storageConfigured && releases ? await snapshotDownloads(downloads).catch(() => null) : null;

  return { telemetry, releases, issues, repoInfo, checks, builds, history, mail, search, now: Date.now() };
}

/** The latest run that finished with a verdict: skipped runs say nothing, and cancelled ones were
    only replaced by a newer push (the workflow cancels in-progress runs on the same branch). */
function lastRun(runs: Runs | null) {
  return runs?.workflow_runs.find((r) => r.status === "completed" && r.conclusion !== "skipped" && r.conclusion !== "cancelled") ?? null;
}

export default async function Admin() {
  const { telemetry, releases, issues, repoInfo, checks, builds, history, mail, search, now } = await load();
  const messages = mail && !(mail instanceof Error) ? mail.messages : [];
  const unread = messages.filter((m) => m.unread);
  const installs: StoredInstall[] = telemetry && !(telemetry instanceof Error) ? telemetry.installs : [];
  const events: TelemetryEvent[] = telemetry && !(telemetry instanceof Error) ? telemetry.events : [];

  const active7 = installs.filter((i) => now - i.last < 7 * DAY);
  const active30 = installs.filter((i) => now - i.last < 30 * DAY);
  const recent = events.filter((e) => now - e.t < 30 * DAY);
  const launches30 = recent.filter((e) => e.type === "launch");
  const exits30 = recent.filter((e) => e.type === "unclean_exit");
  const toolExits30 = exits30.filter((e) => TOOL_HOSTS.has(e.host)).length;
  const dawExits30 = exits30.length - toolExits30;
  const exits = events.filter((e) => e.type === "unclean_exit");

  const days = Array.from({ length: 30 }, (_, i) => day(now - (29 - i) * DAY));
  const perDay = days.map((d) => ({
    day: d,
    launches: launches30.filter((e) => day(e.t) === d).length,
    exits: exits30.filter((e) => day(e.t) === d).length,
  }));

  const assets = (releases ?? []).flatMap((r) => r.assets.map((a) => ({ ...a, version: r.tag_name })));
  const downloads = assets.reduce((sum, a) => sum + a.download_count, 0);
  const reports = (issues ?? []).filter((i) => !i.pull_request);
  const openReports = reports.filter((i) => i.state === "open");

  // Health.
  const latest = releases?.[0];
  const latestVersion = latest?.tag_name.replace(/^v/, "");
  const onLatest = active30.filter((i) => i.version === latestVersion).length;
  const downloadCheck = lastRun(checks);
  const build = lastRun(builds);

  // Growth: installs by the day they were first seen, and how many came back on another day.
  const newPerDay = days.map((d) => ({ day: d, value: installs.filter((i) => day(i.first) === d).length }));
  const daysUsed = new Map<string, Set<string>>();
  for (const e of events) if (e.type === "launch") (daysUsed.get(e.install) ?? daysUsed.set(e.install, new Set()).get(e.install)!).add(day(e.t));
  const returning = installs.filter((i) => (daysUsed.get(i.id)?.size ?? 0) > 1 || i.last - i.first > DAY).length;
  const sessionsTotal = installs.reduce((sum, i) => sum + i.launches, 0);

  // Downloads per day, from the daily totals the panel keeps.
  const downloadsPerDay = (history ?? []).slice(1).map(([d, total], i) => ({ day: d, value: Math.max(0, total - history![i][1]) })).slice(-30);
  const weekAgo = (history ?? []).filter(([d]) => d <= day(now - 7 * DAY)).at(-1) ?? history?.[0];
  const downloads7 = weekAgo ? downloads - weekAgo[1] : null;

  // Download → install since the daily snapshots began, so older downloads of builds that never
  // pinged don't drag the rate down.
  const tracked = history?.[0];
  const downloadsTracked = tracked ? downloads - tracked[1] : 0;
  const installsTracked = tracked ? installs.filter((i) => day(i.first) >= tracked[0]).length : 0;

  const searchReport = search && !(search instanceof Error) ? search : null;
  const searchClicks = searchReport?.perDay.reduce((sum, r) => sum + r.clicks, 0) ?? 0;
  const searchImpressions = searchReport?.perDay.reduce((sum, r) => sum + r.impressions, 0) ?? 0;

  // Stability by version: sessions and unclean exits, all recorded time.
  const stability = countBy(events, (e) => e.version).map(([version]) => {
    const sessions = events.filter((e) => e.version === version && e.type === "launch").length;
    const crashes = events.filter((e) => e.version === version && e.type === "unclean_exit").length;
    return [version, sessions, crashes, percent(crashes, sessions)] as React.ReactNode[];
  });

  // When people use it, by hour in Argentina.
  const perHour = Array.from({ length: 24 }, (_, h) => ({
    day: `${String(h).padStart(2, "0")}:00`,
    value: launches30.filter((e) => (new Date(e.t).getUTCHours() + 24 + LOCAL_OFFSET) % 24 === h).length,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="caption">SnapTune</p>
          <h1 className="headline text-3xl">Admin</h1>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm text-muted">
          <a className="hover:text-ink" href="https://vercel.com/nicofernandev/snaptune/analytics">Site visits (Vercel) ↗</a>
          <a className="hover:text-ink" href={`https://github.com/${repo}/issues`}>Issues ↗</a>
          <a className="hover:text-ink" href={`https://github.com/${repo}/releases`}>Releases ↗</a>
          <Link className="hover:text-ink" href="/admin/mail">Mail</Link>
        </nav>
      </header>

      {!storageConfigured && (
        <Notice>Telemetry storage isn&apos;t set up: add Upstash Redis to the Vercel project. Downloads and reports below still work.</Notice>
      )}
      {telemetry instanceof Error && <Notice>Couldn&apos;t read telemetry: {telemetry.message}</Notice>}
      {search instanceof Error && <Notice>Couldn&apos;t read Search Console: {search.message}</Notice>}
      {mail instanceof Error && <Notice>Couldn&apos;t read mail: {mail.message}</Notice>}
      {(!releases || !issues) && <Notice>GitHub didn&apos;t answer (rate limit?). Set GITHUB_TOKEN to raise it.</Notice>}

      <section className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Latest release" value={latest?.tag_name ?? "–"} note={latest ? `published ${ago(Date.parse(latest.published_at))}` : "no releases"} />
        <Stat
          label="Site downloads check"
          value={downloadCheck ? (downloadCheck.conclusion === "success" ? "OK" : "Failing") : "–"}
          note={downloadCheck ? `ran ${ago(Date.parse(downloadCheck.created_at))}` : "no run yet"}
          alert={downloadCheck?.conclusion === "failure"}
          href={downloadCheck?.html_url}
        />
        <Stat
          label="Build on main"
          value={build ? (build.conclusion === "success" ? "Passing" : "Failing") : "–"}
          note={build ? `ran ${ago(Date.parse(build.created_at))}` : "no run yet"}
          alert={build?.conclusion === "failure"}
          href={build?.html_url}
        />
        <Stat label={`On ${latestVersion ?? "latest"}`} value={percent(onLatest, active30.length)} note={`${onLatest} of ${active30.length} active installs`} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Installs" value={installs.length} note="one per device that ran it in a DAW" />
        <Stat label="Active, 7 days" value={active7.length} note={`${active30.length} in 30 days`} />
        <Stat label="Sessions, 30 days" value={launches30.length} note="one per DAW session" />
        <Stat
          label="Unclean exits, 30 days"
          value={dawExits30}
          note={`${percent(dawExits30, launches30.length)} of sessions${toolExits30 ? `, +${toolExits30} from tools` : ""}`}
          alert={dawExits30 > 0}
        />
        <Stat label="Downloads" value={downloads} note="all releases" />
        <Stat label="Open reports" value={openReports.length} note={`${reports.length} total`} alert={openReports.length > 0} />
        <Stat label="Stars" value={repoInfo?.stargazers_count ?? "–"} note={`${repoInfo?.forks_count ?? "–"} forks`} />
        <Stat label="Last ping" value={events[0] ? ago(events[0].t) : "–"} note={events[0] ? `${events[0].host}, ${events[0].os}` : "no data yet"} />
        <Stat
          label="Download → install"
          value={tracked ? percent(installsTracked, downloadsTracked) : percent(installs.length, downloads)}
          note={tracked ? `${installsTracked} of ${downloadsTracked} since ${tracked[0]}` : "installs that pinged, per download"}
        />
        <Stat label="Returning" value={percent(returning, installs.length)} note={`${returning} used it on more than one day`} />
        <Stat label="Sessions per install" value={installs.length ? (sessionsTotal / installs.length).toFixed(1) : "–"} note="all time" />
        <Stat label="Downloads, last day" value={downloadsPerDay.at(-1)?.value ?? "–"} note={history ? `tracked since ${history[0]?.[0] ?? "today"}` : "needs telemetry storage"} />
        <Stat label="Downloads, 7 days" value={downloads7 ?? "–"} note={weekAgo ? `since ${weekAgo[0]}` : "needs telemetry storage"} />
        <Stat label="Google clicks, 28 days" value={searchReport ? searchClicks : "–"} note={searchReport ? `${searchImpressions} impressions` : "Search Console not set up"} />
        <Stat label="Google CTR, 28 days" value={searchReport ? percent(searchClicks, searchImpressions) : "–"} note="clicks per impression" />
        <Stat
          label="New installs, 7 days"
          value={installs.filter((i) => now - i.first < 7 * DAY).length}
          note={`${percent(installs.filter((i) => now - i.first < 7 * DAY).length, downloads7 ?? 0)} of downloads`}
        />
      </section>

      <div className="grid gap-x-6 md:grid-cols-2">
        <Panel title="New installs per day" note={`last 30 days, UTC; ${installs.length} in total`}>
          <ValueBars data={newPerDay} />
        </Panel>
        <Panel title="Downloads per day" note="from a daily snapshot of GitHub's totals, taken when this panel opens">
          {downloadsPerDay.length ? <ValueBars data={downloadsPerDay} /> : <p className="text-sm text-faint">Starts filling in tomorrow.</p>}
        </Panel>
      </div>

      <Panel title="Google search" note="Search Console, last 28 days. Position is the average rank in the results.">
        {searchReport ? (
          <>
            <ValueBars data={searchReport.perDay.map((r) => ({ day: r.key, value: r.clicks, detail: `${r.clicks} clicks, ${r.impressions} impressions` }))} unit="clicks" />
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <Table head={["Query", "Clicks", "Impr.", "Pos."]} rows={searchRows(searchReport.queries)} empty="No searches yet." />
              <Table head={["Page", "Clicks", "Impr.", "Pos."]} rows={searchRows(searchReport.pages, (p) => p.replace(/^https?:\/\/getsnaptune\.com/, "") || "/")} empty="No pages yet." />
            </div>
          </>
        ) : (
          <p className="text-sm text-faint">
            {searchConfigured ? "Search Console didn't answer." : "Not set up: add GSC_CLIENT_ID, GSC_CLIENT_SECRET and GSC_REFRESH_TOKEN to the Vercel project."}
          </p>
        )}
      </Panel>

      <Panel title="Sessions per day" note="last 30 days, UTC. Coral: sessions that ended without a clean shutdown.">
        <DailyBars data={perDay} />
      </Panel>

      <div className="grid gap-x-6 md:grid-cols-2">
        <Panel title="Operating system" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.os)} />
        </Panel>
        <Panel title="Host" note="active installs, 30 days; scanners and unnamed processes as Other">
          <Bars rows={countBy(active30, (i) => hostLabel(i.host))} />
        </Panel>
        <Panel title="Plugin version" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.version)} />
        </Panel>
        <Panel title="Format and CPU" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => `${i.format} · ${i.arch}`)} />
        </Panel>
        <Panel title="Country" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.country)} />
        </Panel>
        <Panel title="Downloads by OS" note="GitHub release assets, all versions">
          <Bars rows={countBy(assets, (a) => assetOs(a.name), (a) => a.download_count)} />
        </Panel>
      </div>

      <div className="grid gap-x-6 md:grid-cols-2">
        <Panel title="Stability by version" note="sessions and unclean exits, all recorded time">
          <Table head={["Version", "Sessions", "Unclean exits", "Rate"]} rows={stability} empty="No data yet." />
        </Panel>
        <Panel title="Sessions by hour" note="last 30 days, Argentina time (UTC-3)">
          <ValueBars data={perHour} />
        </Panel>
      </div>

      <Panel
        title="Unclean exits"
        note="The DAW quit or crashed without SnapTune shutting down. Grouped by where it happened; a cluster on one version or host is the thing to look at."
      >
        <Table
          head={["Version", "Host", "OS", "Count", "Last"]}
          rows={countBy(exits, (e) => `${e.version}|${e.host}|${e.os}`).map(([key, count]) => {
            const [version, host, os] = key.split("|");
            const last = exits.find((e) => `${e.version}|${e.host}|${e.os}` === key)!;
            return [version, host, os, count, ago(last.t)];
          })}
          empty="None recorded."
        />
      </Panel>

      <Panel
        title={unread.length ? `Mail · ${unread.length} unread` : "Mail"}
        note={
          mail && !(mail instanceof Error)
            ? `latest ${messages.length} in ${mail.accounts.map((a) => a.address).join(" and ")}`
            : "Zoho Mail inboxes"
        }
      >
        {mailConfigured ? (
          <>
            <Table
              head={["Received", "From", "Subject", "To"]}
              rows={messages.map((m) => [
                <span key="t" className="whitespace-nowrap">{ago(m.received)}</span>,
                <span key="f" className={m.unread ? "font-semibold" : "text-muted"} title={m.fromAddress}>{m.from}</span>,
                <Link key="s" href={`/admin/mail/${m.accountId}/${m.folderId}/${m.messageId}`} className="block max-w-xl hover:underline">
                  <span className={m.unread ? "font-semibold text-teal" : "text-teal"}>{m.subject}</span>
                  {m.attachment && <span className="ml-2 text-xs text-faint">📎</span>}
                  <span className="block truncate text-faint">{m.summary}</span>
                </Link>,
                <span key="to" className="text-faint">{m.to.replace(/^.*<|>.*$/g, "") || m.inbox}</span>,
              ])}
              empty="The inboxes are empty."
            />
            <p className="mt-3 flex gap-4 text-sm">
              <Link href="/admin/mail" className="text-teal hover:underline">Open the mailbox →</Link>
              <Link href="/admin/mail/new" className="text-teal hover:underline">Write</Link>
            </p>
          </>
        ) : (
          <p className="text-sm text-faint">Not set up: add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN to the Vercel project (see the README).</p>
        )}
      </Panel>

      <Panel title="Reports" note="GitHub issues, newest first">
        <Table
          head={["#", "Title", "State", "Opened"]}
          rows={reports.slice(0, 15).map((i) => [
            i.number,
            <a key={i.number} href={i.html_url} className="text-teal hover:underline">
              {i.title}
              {i.labels.map((l) => (
                <span key={l.name} className="ml-2 rounded border border-line px-1.5 text-xs text-muted">{l.name}</span>
              ))}
            </a>,
            i.state,
            ago(Date.parse(i.created_at)),
          ])}
          empty="No issues yet."
        />
      </Panel>

      <Panel title="Downloads by release">
        <Table
          head={["Release", "File", "OS", "Downloads"]}
          rows={assets.map((a) => [a.version, a.name, assetOs(a.name), a.download_count])}
          empty="No releases."
        />
      </Panel>

      <Panel title="Recent sessions" note="latest 25 pings">
        <Table
          head={["When", "Event", "Version", "Host", "OS", "Format", "Country", "Install"]}
          rows={events.slice(0, 25).map((e) => [
            ago(e.t),
            e.type === "launch" ? "session" : <span key="x" className="text-coral">unclean exit</span>,
            e.version,
            e.host,
            e.os,
            `${e.format} · ${e.arch}`,
            e.country || "–",
            <code key="id" className="text-faint">{e.install.slice(0, 8)}</code>,
          ])}
          empty="No pings yet."
        />
      </Panel>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm">{children}</p>;
}

function Stat({ label, value, note, alert, href }: { label: string; value: number | string; note: string; alert?: boolean; href?: string }) {
  const body = (
    <>
      <p className="caption">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${alert ? "text-coral" : ""}`}>{value}</p>
      <p className="mt-1 truncate text-sm text-faint">{note}</p>
    </>
  );
  return href ? (
    <a href={href} className="block rounded-xl border border-line bg-panel p-4 hover:border-line-bright">
      {body}
    </a>
  ) : (
    <div className="rounded-xl border border-line bg-panel p-4">{body}</div>
  );
}

function searchRows(rows: SearchRow[], label: (key: string) => string = (k) => k): React.ReactNode[][] {
  return rows.map((r) => [<span key="k" className="block max-w-[16rem] truncate" title={r.key}>{label(r.key)}</span>, r.clicks, r.impressions, r.position.toFixed(1)]);
}

// The day and its numbers, shown at once over the hovered bar (the browser's own title tooltip
// takes a second to appear and often doesn't).
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line-bright bg-panel px-2 py-1 text-xs text-ink shadow-lg group-hover:block">
      {children}
    </span>
  );
}

// One series per chart: a bar per day (or hour), the value on hover and the peak below.
function ValueBars({ data, unit }: { data: { day: string; value: number; detail?: string }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end hover:bg-line/40">
            <Tip>
              <span className="text-faint">{d.day}</span> · <span className="font-semibold tabular-nums">{d.detail ?? `${d.value}${unit ? ` ${unit}` : ""}`}</span>
            </Tip>
            <div className="rounded-t-sm bg-teal-deep group-hover:bg-teal" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{data[0]?.day}</span>
        <span>max {max}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mb-3 text-sm text-faint">{note}</p>}
      <div className="rounded-xl border border-line bg-panel p-4">{children}</div>
    </section>
  );
}

// One series, so a single hue: bar length is the value, and the number is printed beside it.
// Ten rows show; a long tail (hosts, macOS versions) scrolls inside the panel.
function Bars({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-sm text-faint">No data yet.</p>;
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <>
      <ul className="max-h-[17.5rem] space-y-2 overflow-y-auto pr-1">
        {rows.map(([label, n]) => (
          <li key={label} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm" title={`${label}: ${n}`}>
            <span className="truncate text-muted">{label}</span>
            <span className="h-2.5 rounded-r bg-line">
              <span className="block h-full rounded-r bg-teal-deep" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
      {rows.length > 10 && <p className="mt-3 text-xs text-faint">{rows.length} in total, scroll for the rest</p>}
    </>
  );
}

function DailyBars({ data }: { data: { day: string; launches: number; exits: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.launches + d.exits));
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end gap-[2px] hover:bg-line/40">
            <Tip>
              <span className="text-faint">{d.day}</span> · <span className="font-semibold tabular-nums">{d.launches} sessions</span>
              {d.exits > 0 && <span className="text-coral"> · {d.exits} unclean</span>}
            </Tip>
            {d.exits > 0 && <div className="rounded-t-sm bg-coral" style={{ height: `${(d.exits / max) * 100}%` }} />}
            <div
              className={`bg-teal-deep ${d.exits > 0 ? "" : "rounded-t-sm"}`}
              style={{ height: `${(d.launches / max) * 100}%`, minHeight: d.launches ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{data[0].day}</span>
        <span>max {max} / day</span>
        <span>{data[data.length - 1].day}</span>
      </div>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-faint">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-faint">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap pb-2 pr-4 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 tabular-nums">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
