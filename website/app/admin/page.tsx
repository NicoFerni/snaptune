import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { hostLabel } from "@/lib/funnel";
import { storageConfigured } from "@/lib/telemetry";
import {
  ago,
  countBy,
  DAY,
  day,
  EXIT_ALERT,
  getBuilds,
  getChecks,
  getFeedback,
  getInbox,
  getIssues,
  getMetrics,
  getNotice,
  getReleases,
  getRepo,
  getSearch,
  getTelemetry,
  lastRun,
  percent,
  repo,
  requestTime,
} from "@/lib/admin-data";
import Funnel from "./Funnel";
import Tabs from "./Tabs";
import { AdminNav, Bars, DailyBars, Loading, Notice, Panel, Stat, Table, ValueBars } from "./ui";

// The private panel's overview: what needs an answer first (mail, feedback, issues), then whether
// anything is broken, then the usage numbers. Google search, all the feedback, the mailbox and the
// plugin's header notice have their own pages. Each section streams in on its own, so a slow source
// (Zoho, Search Console) doesn't hold up the rest. proxy.ts keeps it behind ADMIN_PASSWORD.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin",
  robots: { index: false, follow: false },
};

export default function Admin() {
  return (
    <>
      <AdminNav current="overview" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <Suspense fallback={null}>
          <Problems />
        </Suspense>
        <Suspense fallback={<Loading title="Needs attention" height="h-44" />}>
          <Attention />
        </Suspense>
        <Suspense fallback={<Loading height="h-10" />}>
          <Health />
        </Suspense>
        <Suspense fallback={<Loading title="Numbers" height="h-64" />}>
          <Numbers />
        </Suspense>
        <Suspense fallback={<Loading title="Last 30 days" />}>
          <Trends />
        </Suspense>
        <Suspense fallback={<Loading title="Active installs, 30 days" height="h-72" />}>
          <Breakdown />
        </Suspense>
        <Suspense fallback={<Loading title="Stability by version" />}>
          <Stability />
        </Suspense>
        <Suspense fallback={null}>
          <LatestPings />
        </Suspense>
      </main>
    </>
  );
}

async function Problems() {
  const [telemetry, releases, issues, search] = await Promise.all([getTelemetry(), getReleases(), getIssues(), getSearch()]);
  return (
    <>
      {!storageConfigured && <Notice>Telemetry storage isn&apos;t set up: add Upstash Redis to the Vercel project. Downloads and issues still work.</Notice>}
      {telemetry instanceof Error && <Notice>Couldn&apos;t read telemetry: {telemetry.message}</Notice>}
      {search instanceof Error && <Notice>Couldn&apos;t read Search Console: {search.message}</Notice>}
      {(!releases || !issues) && <Notice>GitHub didn&apos;t answer (rate limit?). Set GITHUB_TOKEN to raise it.</Notice>}
    </>
  );
}

// Unread mail, this week's feedback and open issues, five of each.
async function Attention() {
  const [inbox, feedback, issues] = await Promise.all([getInbox(), getFeedback(50), getIssues()]);
  const now = requestTime();
  const unread = inbox && !(inbox instanceof Error) ? inbox.messages.filter((m) => m.unread) : [];
  const fresh = (feedback?.messages ?? []).filter((m) => now - m.t < 7 * DAY);
  const open = (issues ?? []).filter((i) => !i.pull_request && i.state === "open");
  // An issue nobody has answered in two days.
  const waiting = (i: (typeof open)[number]) => i.comments === 0 && now - Date.parse(i.created_at) > 2 * DAY;

  if (!unread.length && !fresh.length && !open.length && !(inbox instanceof Error))
    return (
      <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
        All caught up: no unread mail, no feedback this week, no open issues.{" "}
        <Link className="text-teal hover:underline" href="/admin/mail/new">Write an email</Link>
      </p>
    );

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Column
          title="Unread mail"
          count={unread.length}
          links={[
            { href: "/admin/mail", label: "Mailbox" },
            { href: "/admin/mail/new", label: "Write" },
          ]}
        >
          {inbox instanceof Error ? (
            <p className="text-sm text-coral">Couldn&apos;t read mail: {inbox.message}</p>
          ) : inbox === null ? (
            <p className="text-sm text-faint">Zoho isn&apos;t set up (ZOHO_* in Vercel).</p>
          ) : (
            <Rows
              empty="No unread mail."
              rows={unread.slice(0, 5).map((m) => ({
                key: `${m.accountId}-${m.messageId}`,
                href: `/admin/mail/${m.accountId}/${m.folderId}/${m.messageId}`,
                top: m.from,
                when: ago(m.received),
                text: m.subject,
              }))}
            />
          )}
        </Column>
        <Column title="Feedback, 7 days" count={fresh.length} links={[{ href: "/admin/feedback", label: `All ${feedback?.total ?? ""}` }]}>
          <Rows
            empty="Nothing new this week."
            rows={fresh.slice(0, 5).map((m) => ({
              key: String(m.t),
              href: `/admin/feedback?open=${m.t}#f-${m.t}`,
              top: m.email ? `✉ ${m.email}` : m.country || "anonymous",
              when: ago(m.t),
              text: m.message,
            }))}
          />
        </Column>
        <Column title="Open issues" count={open.length} alert={open.some(waiting)} links={[{ href: `https://github.com/${repo}/issues`, label: "GitHub ↗" }]}>
          <Rows
            empty="No open issues."
            rows={open.slice(0, 5).map((i) => ({
              key: String(i.number),
              href: i.html_url,
              top: `#${i.number}${waiting(i) ? " · no reply yet" : ""}`,
              alert: waiting(i),
              when: ago(Date.parse(i.created_at)),
              text: i.title,
            }))}
          />
        </Column>
      </div>
    </section>
  );
}

function Column({ title, count, alert, links, children }: { title: string; count: number; alert?: boolean; links: { href: string; label: string }[]; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-panel p-4">
      <p className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className={`text-2xl font-semibold tabular-nums ${alert ? "text-coral" : count ? "" : "text-faint"}`}>{count}</span>
      </p>
      <div className="flex-1">{children}</div>
      <p className="mt-3 flex gap-4 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-teal hover:underline">
            {l.label} →
          </Link>
        ))}
      </p>
    </div>
  );
}

function Rows({ rows, empty }: { rows: { key: string; href: string; top: string; when: string; text: string; alert?: boolean }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-faint">{empty}</p>;
  return (
    <ul className="-mx-2">
      {rows.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-line/50">
            <span className="flex justify-between gap-3">
              <span className={`truncate ${r.alert ? "text-coral" : "text-muted"}`}>{r.top}</span>
              <span className="shrink-0 text-xs text-faint">{r.when}</span>
            </span>
            <span className="block truncate text-ink">{r.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// One line: is the latest release out, are the builds and the download links fine, are pings
// arriving. Anything failing turns coral and gets its own line above.
async function Health() {
  const [releases, checks, builds, repoInfo, notice, m] = await Promise.all([getReleases(), getChecks(), getBuilds(), getRepo(), getNotice(), getMetrics()]);
  const latest = releases?.[0];
  const downloadCheck = lastRun(checks);
  const build = lastRun(builds);
  const lastPing = m.events[0];
  const silent = storageConfigured && (!lastPing || m.now - lastPing.t > DAY);

  const failing = [
    build?.conclusion === "failure" && { text: "The build on main is failing.", href: build.html_url },
    downloadCheck?.conclusion === "failure" && { text: "The site's download links check is failing.", href: downloadCheck.html_url },
    silent && { text: `No pings for ${lastPing ? ago(lastPing.t).replace(" ago", "") : "ever"}: check the telemetry endpoint.`, href: null },
  ].filter(Boolean) as { text: string; href: string | null }[];

  return (
    <section className="mt-6">
      {failing.map((f) => (
        <Notice key={f.text}>
          {f.text}{" "}
          {f.href && (
            <a className="underline" href={f.href}>
              See the run ↗
            </a>
          )}
        </Notice>
      ))}
      <div className="flex flex-wrap gap-2 text-sm">
        <Pill href={`https://github.com/${repo}/releases`} label="Release" value={latest ? `${latest.tag_name} · ${ago(Date.parse(latest.published_at))}` : "–"} />
        <Pill href={build?.html_url} label="Build" value={build ? (build.conclusion === "success" ? "✓ passing" : "✗ failing") : "–"} alert={build?.conclusion === "failure"} />
        <Pill href={downloadCheck?.html_url} label="Download links" value={downloadCheck ? (downloadCheck.conclusion === "success" ? "✓ ok" : "✗ failing") : "–"} alert={downloadCheck?.conclusion === "failure"} />
        <Pill
          label={`On ${m.latestVersion ?? "latest"}`}
          value={percent(m.onLatest, m.active7.length)}
          title={`${m.onLatest} of the ${m.active7.length} installs used in the last 7 days`}
        />
        <Pill label="Last ping" value={lastPing ? ago(lastPing.t) : "–"} title={lastPing ? `${lastPing.host}, ${lastPing.os}` : undefined} alert={silent} />
        <Pill href="/admin/search" label="Google, 28 d" value={m.searchReport ? `${m.searchClicks} clicks` : "–"} />
        <Pill href={`https://github.com/${repo}/stargazers`} label="Stars" value={repoInfo ? `★ ${repoInfo.stargazers_count}` : "–"} />
        <Pill href="/admin/notice" label="Notice" value={notice ? `“${notice.text}”` : "none"} />
      </div>
    </section>
  );
}

function Pill({ label, value, href, alert, title }: { label: string; value: string; href?: string | null; alert?: boolean; title?: string }) {
  const body = (
    <>
      <span className="text-faint">{label}</span> <span className={`font-semibold tabular-nums ${alert ? "text-coral" : "text-ink"}`}>{value}</span>
    </>
  );
  const box = `rounded-lg border px-3 py-1.5 ${alert ? "border-coral/60 bg-coral/10" : "border-line bg-panel"}`;
  return href ? (
    <Link href={href} title={title} className={`${box} hover:border-line-bright`}>
      {body}
    </Link>
  ) : (
    <span title={title} className={box}>
      {body}
    </span>
  );
}

// Eight cards. The ones marked "funnel" open the activation funnel on their window, and show
// exactly the funnel's numbers for it.
async function Numbers() {
  const m = await getMetrics();
  const { w7, w30, pace7, pace30 } = m;
  const short = (d: string) => d.slice(5);
  const exitRate = m.launches30.length ? m.exits30.length / m.launches30.length : 0;
  const pings = m.installs.length ? short(day(Math.min(...m.installs.map((i) => i.first)))) : null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Numbers</h2>
        <button type="button" data-funnel="30" className="rounded-lg border border-line-bright px-3 py-1 text-sm hover:bg-line">
          Activation funnel →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Installs"
          value={m.installs.length}
          note={pings ? `devices, since ${pings}` : "devices"}
          info="One per device that ran it in a DAW or the app, since the pings began. A device a scanner or validator only loaded doesn't count, and installs that opted out of pings are missing."
        />
        <Stat label="Active, 7 days" value={m.active7.length} note={`${m.active30.length} in 30 days`} info="Installs with a session in the last 7 days." />
        <Stat
          funnel="7"
          label={`New installs, ${w7.days} days`}
          value={w7.installed}
          alert={pace7.down}
          note={`${pace7.perDay.toFixed(1)}/day · ${pace7.change} vs before`}
          info={`Installs first seen from ${w7.since}, the same days as the funnel. Against ${pace7.previous} in the ${w7.days} days before (${pace7.previousPerDay.toFixed(1)} a day).`}
        />
        <Stat
          funnel="30"
          label={`New installs, ${w30.days} days`}
          value={w30.installed}
          alert={pace30.down}
          note={pace30.complete ? `${pace30.perDay.toFixed(1)}/day · ${pace30.change} vs before` : `${pace30.perDay.toFixed(1)}/day · growth from ${short(pace30.readyOn)}`}
          info={
            w30.days === 30
              ? `Installs first seen from ${w30.since}, the same days as the funnel.`
              : `Installs first seen from ${w30.since}, the same days as the funnel: its 30 days start where the saved download totals do, so downloads and installs cover the same days. It reaches 30 days by itself.`
          }
        />
        <Stat
          funnel="7"
          label={`Downloads, ${w7.days} days`}
          value={w7.downloaded ?? "–"}
          note={`${m.unique?.last7 ?? "–"} by IP · ${m.downloads} all time`}
          info={`GitHub's count over the same days as the 7-day installs, with the ${w7.updated} downloads that were updates left out. "By IP" counts the site's download buttons once per IP.`}
        />
        <Stat
          funnel="30"
          label="Download → install"
          value={percent(w30.installed, w30.downloaded)}
          note={w30.downloaded === null ? "needs saved download totals" : `${w30.installed} of ${w30.downloaded} since ${short(w30.since)}`}
          info="A floor: GitHub's count has bots, link scanners and retried downloads in it, and installs that opted out of pings or never went online are missing."
        />
        <Stat
          label="Returning"
          value={percent(m.returning, m.couldReturn.length)}
          note={`${m.returning} of ${m.couldReturn.length}, all time`}
          info="Installs with a session a full day or more after their first, of the installs at least a day old."
        />
        <Stat
          label="Sessions, 30 days"
          value={m.launches30.length}
          alert={exitRate > EXIT_ALERT}
          note={`${m.exits30.length} unclean · ${percent(m.exits30.length, m.launches30.length)}`}
          info={`DAW sessions. Unclean: the DAW quit or crashed without SnapTune shutting down; coral above ${EXIT_ALERT * 100} %.${m.toolExits30 ? ` ${m.toolExits30} more from scripts and scanners, left out.` : ""}`}
        />
      </div>
      <Funnel data={m.funnel} />
    </section>
  );
}

async function Trends() {
  const m = await getMetrics();
  return (
    <Panel
      title="Last 30 days"
      info={
        <>
          By day, Argentina time. <b>Downloads</b>: GitHub&apos;s count, updates and bots included, from a total saved each day this panel is opened; days it wasn&apos;t share the
          difference. <b>Sessions</b>: coral is sessions that ended without a clean shutdown.
        </>
      }
    >
      <Tabs
        id="trends"
        tabs={[
          { label: `New installs · ${m.newPerDay.reduce((s, d) => s + d.value, 0)}`, content: <ValueBars data={m.newPerDay} unit="installs" /> },
          {
            label: `Downloads · ${m.downloadsPerDay.reduce((s, d) => s + d.value, 0)}`,
            content: m.downloadsPerDay.length ? <ValueBars data={m.downloadsPerDay} unit="downloads" /> : <p className="text-sm text-faint">Starts filling in tomorrow.</p>,
          },
          { label: `Sessions · ${m.launches30.length}`, content: <DailyBars data={m.sessionsPerDay} /> },
        ]}
      />
    </Panel>
  );
}

async function Breakdown() {
  const { active30 } = await getMetrics();
  return (
    <Panel title="Active installs, 30 days" info={`The ${active30.length} installs with a session in the last 30 days, by what they run on. Scanners and unnamed processes count as Other under Host.`}>
      <Tabs
        id="breakdown"
        tabs={[
          { label: "OS", content: <Bars rows={countBy(active30, (i) => i.os)} /> },
          { label: "Host", content: <Bars rows={countBy(active30, (i) => hostLabel(i.host))} /> },
          { label: "Version", content: <Bars rows={countBy(active30, (i) => i.version)} /> },
          { label: "Format · CPU", content: <Bars rows={countBy(active30, (i) => `${i.format} · ${i.arch}`)} /> },
          { label: "Country", content: <Bars rows={countBy(active30, (i) => i.country)} /> },
        ]}
      />
    </Panel>
  );
}

async function Stability() {
  const { stability } = await getMetrics();
  return (
    <Panel
      title="Stability by version"
      info={`DAW sessions and unclean exits (the DAW quit or crashed without SnapTune shutting down), all recorded time, newest ten versions. Coral: over ${EXIT_ALERT * 100} % on 20 sessions or more. A cluster on one host or OS is the thing to look at.`}
    >
      <Table
        head={["Version", "Sessions", "Unclean", "Rate", "Where", "Last"]}
        align={["left", "right", "right", "right", "left", "left"]}
        rows={stability.map((s) => {
          const high = s.sessions >= 20 && s.exits / s.sessions > EXIT_ALERT;
          return [
            s.version,
            s.sessions,
            s.exits,
            <span key="r" className={high ? "font-semibold text-coral" : ""}>{percent(s.exits, s.sessions)}</span>,
            <span key="w" className="block max-w-[20rem] truncate text-muted" title={s.where.map(([w, n]) => `${w}: ${n}`).join("\n")}>
              {s.where.slice(0, 2).map(([w, n]) => `${w} (${n})`).join(", ") || "–"}
            </span>,
            <span key="l" className="whitespace-nowrap text-faint">{s.last ? ago(s.last) : "–"}</span>,
          ];
        })}
        empty="No data yet."
      />
    </Panel>
  );
}

// For checking a ping arrived, mostly while testing a build: closed by default.
async function LatestPings() {
  const { events } = await getMetrics();
  return (
    <details className="group mt-8">
      <summary className="cursor-pointer text-sm text-muted hover:text-ink">
        Latest pings <span className="text-faint">· the 25 newest sessions and exits, raw</span>
      </summary>
      <div className="mt-3 rounded-xl border border-line bg-panel p-4">
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
      </div>
    </details>
  );
}
