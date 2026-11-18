"use client";

import { useEffect, useRef, useState } from "react";
import type { FunnelData, FunnelStep, SegmentRow } from "@/lib/funnel";

// The activation funnel, in a dialog that any card marked data-funnel opens (on the window its
// value is "7" or "30"). The numbers are worked out on the server; this only shows them.

function rate(part: number, whole: number | null): number | null {
  return whole ? part / whole : null;
}

function pct(r: number | null): string {
  return r === null ? "–" : `${(r * 100).toFixed(1)} %`;
}

export default function Funnel({ data }: { data: FunnelData }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(data.windows[1]?.key ?? "30");

  useEffect(() => {
    function open(event: MouseEvent) {
      const card = (event.target as Element | null)?.closest<HTMLElement>("[data-funnel]");
      if (!card) return;
      setKey(card.dataset.funnel || "30");
      dialog.current?.showModal();
    }
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);

  const view = data.windows.find((w) => w.key === key) ?? data.windows[0];
  if (!view) return null;

  // The step that loses the largest share of the one before it, among steps with enough installs
  // behind them for the share to mean something.
  const rated = view.steps.map((s) => (s.base !== null && s.base >= 20 ? rate(s.count, s.base) : null));
  const worst = rated.reduce<number | null>((w, r, i) => (r !== null && (w === null || r < rated[w]!) ? i : w), null);
  const top = Math.max(1, ...view.steps.map((s) => s.count));

  // Rates for the whole window, to mark the groups well below them.
  const overall = { twice: rate(view.overall.twice, view.overall.base), back: rate(view.overall.cameBack, view.overall.base) };

  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-line-bright bg-bg p-0 text-ink backdrop:bg-black/60"
    >
      <div className="p-5 sm:p-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="caption">Activation</p>
            <h2 className="headline text-2xl">From download to using it a week later</h2>
            <p className="mt-1 text-sm text-faint">
              Installs first seen from {view.since} to today ({view.days} {view.days === 1 ? "day" : "days"}), and what each of them did after. The cards that open this show the same numbers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5 text-sm" role="tablist">
              {data.windows.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  role="tab"
                  aria-selected={w.key === key}
                  onClick={() => setKey(w.key)}
                  className={`rounded-md px-3 py-1 ${w.key === key ? "bg-line-bright text-ink" : "text-muted hover:text-ink"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border border-line px-3 py-1 text-sm text-muted hover:text-ink" aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        {data.search && (
          <p className="mt-5 text-sm text-muted">
            Before the funnel, Google, last 28 days: {data.search.impressions} impressions → {data.search.clicks} clicks ({pct(rate(data.search.clicks, data.search.impressions))}). Site visits from every source are in{" "}
            <a className="text-teal hover:underline" href="https://vercel.com/nicofernandev/snaptune/analytics">Vercel Analytics ↗</a>.
          </p>
        )}

        <ol className="mt-6 space-y-4">
          {view.steps.map((s, i) => (
            <Step key={s.label} step={s} top={top} worst={i === worst} lost={s.base !== null ? s.base - s.count : null} />
          ))}
        </ol>
        {view.sessions.mean !== null && (
          <p className="mt-4 text-sm text-muted">
            Sessions per install so far: <span className="font-semibold text-ink tabular-nums">{view.sessions.mean.toFixed(1)}</span> on average; half have {view.sessions.median} or fewer.
          </p>
        )}
        {!view.steps.some((s) => s.label === "Still using it a week later") && (
          <p className="mt-3 text-xs text-faint">No &ldquo;still using it a week later&rdquo; here: installs from these seven days can&apos;t be a week old yet. The 30 days have it.</p>
        )}

        <h3 className="mt-8 text-lg font-semibold">Where it leaks</h3>
        <p className="mb-3 text-sm text-faint">
          The same installs, split. Twice and Back count what happened within three days of the first session, over installs at least three days old, so a
          newer version or DAW isn&apos;t marked down for being new. Coral: under three quarters of the whole window&apos;s rate, on ten installs or more.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {view.segments.map((seg) => (
            <Segment key={seg.title} title={seg.title} rows={seg.rows} overall={overall} />
          ))}
        </div>

        <h3 className="mt-8 text-lg font-semibold">Downloads to installs by OS</h3>
        <p className="mb-3 text-sm text-faint">
          All time, over the releases that send pings{data.byOsSince ? ` (${data.byOsSince} on)` : ""}. Linux downloads include servers, which never load it in a DAW.
        </p>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel p-4">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-faint">
              <tr>
                {["OS", "Downloads", "Updates", "Installs", "Download → install"].map((h) => (
                  <th key={h} className="whitespace-nowrap pb-2 pr-4 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byOs.map((o) => (
                <tr key={o.os} className="border-t border-line">
                  <td className="py-2 pr-4">{o.os}</td>
                  <td className="py-2 pr-4">{o.downloads}</td>
                  <td className="py-2 pr-4">{o.updates}</td>
                  <td className="py-2 pr-4">{o.installs}</td>
                  <td className="py-2 pr-4 font-semibold">{pct(rate(o.installs, Math.max(0, o.downloads - o.updates)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </dialog>
  );
}

function Step({ step, top, worst, lost }: { step: FunnelStep; top: number; worst: boolean; lost: number | null }) {
  const r = rate(step.count, step.base);
  return (
    <li className={`rounded-xl border p-4 ${worst ? "border-coral/60 bg-coral/10" : "border-line bg-panel"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {step.label}
          {worst && <span className="ml-2 rounded border border-coral/60 px-1.5 text-xs font-normal text-coral">biggest drop</span>}
        </p>
        <p className="tabular-nums">
          <span className="text-2xl font-semibold">{step.count}</span>
          {step.base !== null && (
            <span className="ml-2 text-sm text-muted">
              of {step.base} · <span className={worst ? "text-coral" : "text-ink"}>{pct(r)}</span>
              {lost ? ` · ${lost} lost` : ""}
            </span>
          )}
        </p>
      </div>
      <div className="mt-2 h-2.5 rounded-r bg-line">
        <div className={`h-full rounded-r ${worst ? "bg-coral" : "bg-teal-deep"}`} style={{ width: `${(step.count / top) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-faint">{step.note}</p>
    </li>
  );
}

function Segment({ title, rows, overall }: { title: string; rows: SegmentRow[]; overall: { twice: number | null; back: number | null } }) {
  const low = (r: number | null, whole: number | null, n: number) => r !== null && whole !== null && n >= 10 && r < whole * 0.75;
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="caption mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-faint">No installs.</p>
      ) : (
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-faint">
            <tr>
              <th className="pb-2 pr-2 font-normal" />
              <th className="pb-2 pr-2 text-right font-normal" title="Installs">Inst.</th>
              <th className="pb-2 pr-2 text-right font-normal" title="A second session within three days">Twice</th>
              <th className="pb-2 text-right font-normal" title="A session on a later day, within three days">Back</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const twice = rate(row.twice, row.base);
              const back = rate(row.cameBack, row.base);
              return (
                <tr key={row.label} className="border-t border-line">
                  <td className="max-w-[8rem] truncate py-1.5 pr-2 text-muted" title={row.label}>{row.label}</td>
                  <td className="py-1.5 pr-2 text-right">{row.installs}</td>
                  <td className={`py-1.5 pr-2 text-right ${low(twice, overall.twice, row.base) ? "text-coral" : ""}`} title={`${row.twice} of ${row.base} three days old`}>{pct(twice).replace(".0 ", " ")}</td>
                  <td className={`py-1.5 text-right ${low(back, overall.back, row.base) ? "text-coral" : ""}`} title={`${row.cameBack} of ${row.base} three days old`}>
                    {pct(back).replace(".0 ", " ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
