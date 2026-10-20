import type { Metadata } from "next";
import { readTelemetry, storageConfigured, type Install, type TelemetryEvent } from "@/lib/telemetry";

// The private panel: plugin usage from the telemetry pings, downloads and reports from GitHub.
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
  return "Other";
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

async function load() {
  const [telemetry, releases, issues, repoInfo] = await Promise.all([
    storageConfigured ? readTelemetry().catch((e: Error) => e) : null,
    github<Release[]>("/releases?per_page=100"),
    github<Issue[]>("/issues?state=all&per_page=100"),
    github<Repo>(""),
  ]);
  return { telemetry, releases, issues, repoInfo, now: Date.now() };
}

export default async function Admin() {
  const { telemetry, releases, issues, repoInfo, now } = await load();
  const installs: Install[] = telemetry && !(telemetry instanceof Error) ? telemetry.installs : [];
  const events: TelemetryEvent[] = telemetry && !(telemetry instanceof Error) ? telemetry.events : [];

  const active7 = installs.filter((i) => now - i.last < 7 * DAY);
  const active30 = installs.filter((i) => now - i.last < 30 * DAY);
  const recent = events.filter((e) => now - e.t < 30 * DAY);
  const launches30 = recent.filter((e) => e.type === "launch");
  const exits30 = recent.filter((e) => e.type === "unclean_exit");
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
        </nav>
      </header>

      {!storageConfigured && (
        <Notice>Telemetry storage isn&apos;t set up: add Upstash Redis to the Vercel project. Downloads and reports below still work.</Notice>
      )}
      {telemetry instanceof Error && <Notice>Couldn&apos;t read telemetry: {telemetry.message}</Notice>}
      {(!releases || !issues) && <Notice>GitHub didn&apos;t answer (rate limit?). Set GITHUB_TOKEN to raise it.</Notice>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Installs" value={installs.length} note="unique, all time" />
        <Stat label="Active, 7 days" value={active7.length} note={`${active30.length} in 30 days`} />
        <Stat label="Sessions, 30 days" value={launches30.length} note="one per DAW session" />
        <Stat
          label="Unclean exits, 30 days"
          value={exits30.length}
          note={`${percent(exits30.length, launches30.length)} of sessions`}
          alert={exits30.length > 0}
        />
        <Stat label="Downloads" value={downloads} note="all releases" />
        <Stat label="Open reports" value={openReports.length} note={`${reports.length} total`} alert={openReports.length > 0} />
        <Stat label="Stars" value={repoInfo?.stargazers_count ?? "–"} note={`${repoInfo?.forks_count ?? "–"} forks`} />
        <Stat label="Last ping" value={events[0] ? ago(events[0].t) : "–"} note={events[0] ? `${events[0].host}, ${events[0].os}` : "no data yet"} />
      </section>

      <Panel title="Sessions per day" note="last 30 days, UTC. Coral: sessions that ended without a clean shutdown.">
        <DailyBars data={perDay} />
      </Panel>

      <div className="grid gap-x-6 md:grid-cols-2">
        <Panel title="Operating system" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.os)} />
        </Panel>
        <Panel title="Host" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.host)} />
        </Panel>
        <Panel title="Plugin version" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.version)} />
        </Panel>
        <Panel title="Format and CPU" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => `${i.format} · ${i.arch}`)} />
        </Panel>
        <Panel title="Country" note="active installs, 30 days">
          <Bars rows={countBy(active30, (i) => i.country).slice(0, 10)} />
        </Panel>
        <Panel title="Downloads by OS" note="GitHub release assets, all versions">
          <Bars rows={countBy(assets, (a) => assetOs(a.name), (a) => a.download_count)} />
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

function Stat({ label, value, note, alert }: { label: string; value: number | string; note: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="caption">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${alert ? "text-coral" : ""}`}>{value}</p>
      <p className="mt-1 truncate text-sm text-faint">{note}</p>
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
function Bars({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-sm text-faint">No data yet.</p>;
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <ul className="space-y-2">
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
  );
}

function DailyBars({ data }: { data: { day: string; launches: number; exits: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.launches + d.exits));
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]">
        {data.map((d) => (
          <div
            key={d.day}
            className="flex h-full flex-1 flex-col justify-end gap-[2px] hover:opacity-80"
            title={`${d.day}: ${d.launches} sessions, ${d.exits} unclean exits`}
          >
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
