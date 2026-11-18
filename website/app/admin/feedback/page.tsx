import type { Metadata } from "next";
import Link from "next/link";
import { ago, getFeedback } from "@/lib/admin-data";
import { storageConfigured } from "@/lib/telemetry";
import { AdminNav, Notice } from "../ui";

// Messages from the plugin's Feedback button and getsnaptune.com/feedback, newest first: one line
// each, opened to read in full and answer from the admin mailbox. ?open=<time> opens that one.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin · feedback",
  robots: { index: false, follow: false },
};

const SHOWN = 50;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const feedback = await getFeedback(SHOWN);
  const messages = feedback?.messages ?? [];

  return (
    <>
      <AdminNav current="feedback" />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="mb-1 text-2xl font-semibold">Feedback</h1>
        <p className="mb-4 text-sm text-faint">
          From the plugin&apos;s Feedback button and getsnaptune.com/feedback, newest first
          {feedback && feedback.total > messages.length ? `: the latest ${messages.length} of ${feedback.total}` : ""}.
        </p>
        {!storageConfigured && <Notice>Needs the telemetry storage.</Notice>}

        {messages.length === 0 ? (
          <p className="text-sm text-faint">No messages yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-panel">
            {messages.map((m) => {
              const firstLine = m.message.trim().split("\n")[0];
              const from = [m.version, m.format, m.host, m.os].filter(Boolean).join(" · ") || "the site";
              const reply = m.email
                ? `/admin/mail/new?${new URLSearchParams({ to: m.email, subject: "Re: your SnapTune feedback", from: "support" })}`
                : null;
              return (
                <li key={m.t} id={`f-${m.t}`} className="scroll-mt-20 border-t border-line first:border-t-0">
                  <details open={open === String(m.t)} className="group">
                    <summary className="flex cursor-pointer list-none items-baseline gap-3 px-4 py-3 hover:bg-panel-2 [&::-webkit-details-marker]:hidden">
                      <span className="w-20 shrink-0 text-xs text-faint">{ago(m.t)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm group-open:whitespace-normal">{firstLine}</span>
                      {m.email && <span className="shrink-0 text-xs text-teal" title={m.email}>✉ answer wanted</span>}
                      <span className="w-8 shrink-0 text-right text-xs text-faint">{m.country || "–"}</span>
                    </summary>
                    <div className="px-4 pb-4 sm:pl-[7.75rem]">
                      <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                      <p className="mt-3 text-xs text-faint">
                        Sent from {from}
                        {m.country ? ` · ${m.country}` : ""} · {new Date(m.t).toLocaleString("en-GB", { timeZone: "America/Argentina/Buenos_Aires" })}
                      </p>
                      {reply && (
                        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <Link href={reply} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink">
                            Reply from support@
                          </Link>
                          <span className="text-faint">{m.email}</span>
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
