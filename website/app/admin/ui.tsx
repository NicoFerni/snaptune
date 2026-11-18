import Link from "next/link";
import { Suspense } from "react";
import { getInbox, repo } from "@/lib/admin-data";

// The pieces every admin page is built from.

export function Notice({ children, tone = "alert" }: { children: React.ReactNode; tone?: "alert" | "plain" }) {
  return (
    <p className={`mb-4 rounded-lg border px-4 py-3 text-sm ${tone === "alert" ? "border-coral/40 bg-coral/10" : "border-line bg-panel"}`}>{children}</p>
  );
}

/** A small ⓘ that shows the explanation at once on hover or focus, so notes don't take up the page. */
export function Info({ children, align = "center" }: { children: React.ReactNode; align?: "center" | "left" | "right" }) {
  const place = { center: "left-1/2 -translate-x-1/2", left: "left-0", right: "right-0" }[align];
  return (
    <span className="group relative ml-1.5 inline-block align-[0.1em]" tabIndex={0}>
      <span aria-hidden className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line-bright text-[10px] leading-none text-faint group-hover:text-ink">
        i
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-1.5 hidden w-72 max-w-[70vw] rounded-md border border-line-bright bg-panel px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink normal-case shadow-lg group-hover:block group-focus:block ${place}`}
      >
        {children}
      </span>
    </span>
  );
}

// A card with `funnel` opens the activation funnel on that window ("7" or "30" days); one with
// `href` is a link. `info` is the long explanation, behind an ⓘ (or the tooltip, on a button).
export function Stat({
  label,
  value,
  note,
  info,
  alert,
  href,
  funnel,
}: {
  label: string;
  value: number | string;
  note: React.ReactNode;
  info?: string;
  alert?: boolean;
  href?: string;
  funnel?: "7" | "30";
}) {
  const interactive = Boolean(funnel || href);
  const body = (
    <>
      <p className="caption flex items-center justify-between gap-2">
        <span>
          {label}
          {info && !interactive && <Info align="left">{info}</Info>}
        </span>
        {funnel && <span className="shrink-0 text-xs text-faint"><span className="hidden sm:inline">funnel </span>›</span>}
        {href && !funnel && <span className="text-xs text-faint">↗</span>}
      </p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${alert ? "text-coral" : ""}`}>{value}</p>
      <p className="mt-1 text-sm text-faint">{note}</p>
    </>
  );
  const box = "block w-full rounded-xl border border-line bg-panel p-4 text-left";
  if (funnel)
    return (
      <button type="button" data-funnel={funnel} title={info} className={`${box} cursor-pointer hover:border-line-bright`}>
        {body}
      </button>
    );
  if (href)
    return (
      <Link href={href} title={info} className={`${box} hover:border-line-bright`}>
        {body}
      </Link>
    );
  return <div className={box}>{body}</div>;
}

export function Panel({ title, info, action, children, id }: { title: string; info?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">
          {title}
          {info && <Info align="left">{info}</Info>}
        </h2>
        {action && <div className="text-sm">{action}</div>}
      </div>
      <div className="rounded-xl border border-line bg-panel p-4">{children}</div>
    </section>
  );
}

/** What shows while a section's data is on its way. */
export function Loading({ height = "h-40", title }: { height?: string; title?: string }) {
  return (
    <section className="mt-8" aria-busy>
      {title && <h2 className="mb-3 text-lg font-semibold text-faint">{title}</h2>}
      <div className={`${height} animate-pulse rounded-xl border border-line bg-panel`} />
    </section>
  );
}

export function Table({ head, rows, empty, align }: { head: string[]; rows: React.ReactNode[][]; empty: string; align?: ("left" | "right")[] }) {
  if (rows.length === 0) return <p className="text-sm text-faint">{empty}</p>;
  const side = (j: number) => (align?.[j] === "right" ? "text-right" : "");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-faint">
          <tr>
            {head.map((h, j) => (
              <th key={h} className={`whitespace-nowrap pb-2 pr-4 font-normal ${side(j)}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 pr-4 tabular-nums ${side(j)} ${align?.[j] === "right" ? "whitespace-nowrap" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

// One series per chart: a bar per day, the value on hover and the peak below.
export function ValueBars({ data, unit }: { data: { day: string; value: number; detail?: string }[]; unit?: string }) {
  if (data.length === 0) return <p className="text-sm text-faint">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]">
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
        <span>{data[0].day}</span>
        <span>max {max}</span>
        <span>{data[data.length - 1].day}</span>
      </div>
    </div>
  );
}

export function DailyBars({ data }: { data: { day: string; launches: number; exits: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.launches + d.exits));
  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end gap-[2px] hover:bg-line/40">
            <Tip>
              <span className="text-faint">{d.day}</span> · <span className="font-semibold tabular-nums">{d.launches} sessions</span>
              {d.exits > 0 && <span className="text-coral"> · {d.exits} unclean</span>}
            </Tip>
            {d.exits > 0 && <div className="rounded-t-sm bg-coral" style={{ height: `${(d.exits / max) * 100}%` }} />}
            <div className={`bg-teal-deep group-hover:bg-teal ${d.exits > 0 ? "" : "rounded-t-sm"}`} style={{ height: `${(d.launches / max) * 100}%`, minHeight: d.launches ? 2 : 0 }} />
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

// One series, so a single hue: bar length is the value, and the number is printed beside it.
// Ten rows show; a long tail (hosts, macOS versions) scrolls inside the panel.
export function Bars({ rows }: { rows: [string, number][] }) {
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

const pages = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "search", label: "Google", href: "/admin/search" },
  { key: "feedback", label: "Feedback", href: "/admin/feedback" },
  { key: "mail", label: "Mail", href: "/admin/mail" },
  { key: "notice", label: "Notice", href: "/admin/notice" },
] as const;

export type AdminPage = (typeof pages)[number]["key"];

async function UnreadCount() {
  const inbox = await getInbox();
  const unread = inbox && !(inbox instanceof Error) ? inbox.messages.filter((m) => m.unread).length : 0;
  return unread ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink tabular-nums">{unread}</span> : null;
}

/** The bar on top of every admin page: the pages, the unread mail, and the outside dashboards. */
export function AdminNav({ current }: { current: AdminPage }) {
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/admin" className="shrink-0 py-3 text-lg font-semibold">
          SnapTune <span className="text-faint">admin</span>
        </Link>
        <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
          {pages.map((p) => (
            <Link
              key={p.key}
              href={p.href}
              aria-current={p.key === current ? "page" : undefined}
              className={`flex shrink-0 items-center border-b-2 px-2.5 py-3 ${p.key === current ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {p.label}
              {p.key === "mail" && (
                <Suspense fallback={null}>
                  <UnreadCount />
                </Suspense>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 gap-4 text-sm text-muted md:flex">
          <a className="hover:text-ink" href="https://vercel.com/nicofernandev/snaptune/analytics">Vercel ↗</a>
          <a className="hover:text-ink" href={`https://github.com/${repo}`}>GitHub ↗</a>
        </div>
      </div>
    </div>
  );
}
