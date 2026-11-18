import type { Metadata } from "next";
import { ago, getNotice } from "@/lib/admin-data";
import { NOTICE_LENGTH, NOTICE_ORIGIN } from "@/lib/feedback";
import { storageConfigured } from "@/lib/telemetry";
import { setNoticeAction } from "../actions";
import { AdminNav, Notice } from "../ui";

// The one line the plugin shows in its header.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin · notice",
  robots: { index: false, follow: false },
};

const input = "w-full rounded-lg border border-line bg-deep px-3 py-2 text-ink placeholder:text-faint focus:border-line-bright focus:outline-none";

export default async function NoticePage() {
  const notice = await getNotice();

  return (
    <>
      <AdminNav current="notice" />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="mb-1 text-2xl font-semibold">Header notice</h1>
        <p className="mb-6 text-sm text-faint">
          One line in the plugin&apos;s header, gold, until the user clicks it. Each computer asks once a day, so it takes a day or more to reach everyone. A newer
          version&apos;s notice shows first.
        </p>

        {!storageConfigured ? (
          <Notice>Needs the telemetry storage.</Notice>
        ) : (
          <>
            <p className="mb-4 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              {notice ? (
                <>
                  Showing since {ago(Number(notice.id))}: <span className="font-semibold">{notice.text}</span> <span className="text-faint">→ {notice.url}</span>
                </>
              ) : (
                <span className="text-faint">No notice is showing.</span>
              )}
            </p>
            <form action={setNoticeAction} className="grid gap-4 rounded-xl border border-line bg-panel p-4 text-sm sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-faint">Text, up to {NOTICE_LENGTH} characters</span>
                <input name="text" maxLength={NOTICE_LENGTH} defaultValue={notice?.text ?? ""} placeholder="Join the Discord" className={input} />
              </label>
              <label className="grid gap-1">
                <span className="text-faint">Page it opens, on this site</span>
                <input name="url" type="url" pattern="https://getsnaptune\.com/.*" defaultValue={notice?.url ?? NOTICE_ORIGIN} className={input} />
              </label>
              <div className="flex gap-3 sm:col-span-2">
                <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink">{notice ? "Replace" : "Show"}</button>
                {notice && (
                  <button name="clear" value="1" className="rounded-lg border border-line px-4 py-2 text-muted hover:bg-line">
                    Take it down
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </main>
    </>
  );
}
