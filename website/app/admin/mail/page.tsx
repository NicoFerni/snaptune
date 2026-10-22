import type { Metadata } from "next";
import Link from "next/link";
import { FOLDERS, mailConfigured, readFolder, webmail, type FolderType } from "@/lib/mail";

// The mailbox: Inbox, Sent, Spam and Trash across the Zoho accounts, 30 at a time.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin · mail",
  robots: { index: false, follow: false },
};

const PAGE = 30;

function ago(t: number): string {
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });
}

export default async function Mailbox({ searchParams }: { searchParams: Promise<{ folder?: string; start?: string; sent?: string; trashed?: string }> }) {
  const q = await searchParams;
  const folder: FolderType = FOLDERS.find((f) => f === q.folder) ?? "Inbox";
  const start = Math.max(0, Number(q.start) || 0);
  const mail = mailConfigured ? await readFolder(folder, { start, limit: PAGE }).catch((e: Error) => e) : null;
  const sentFolder = folder === "Sent";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="caption hover:text-ink" href="/admin">← Admin</Link>
          <h1 className="headline text-3xl">Mail</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a className="text-muted hover:text-ink" href={webmail}>Zoho Mail ↗</a>
          <Link href="/admin/mail/new" className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink">Write</Link>
        </div>
      </header>

      {q.sent && <Note>Sent.</Note>}
      {q.trashed && <Note>Moved to the trash.</Note>}
      {!mailConfigured && <Note alert>Not set up: add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN (see the README).</Note>}
      {mail instanceof Error && <Note alert>Couldn&apos;t read mail: {mail.message}</Note>}

      <nav className="mb-3 flex gap-1 text-sm">
        {FOLDERS.map((f) => (
          <Link
            key={f}
            href={`/admin/mail?folder=${f}`}
            className={`rounded-lg px-3 py-1.5 ${f === folder ? "bg-panel text-ink" : "text-muted hover:text-ink"}`}
          >
            {f}
          </Link>
        ))}
      </nav>

      {mail && !(mail instanceof Error) && (
        <div className="rounded-xl border border-line bg-panel">
          {mail.messages.length === 0 ? (
            <p className="p-4 text-sm text-faint">Nothing in {folder}.</p>
          ) : (
            <ul>
              {mail.messages.map((m) => (
                <li key={`${m.accountId}-${m.messageId}`} className="border-t border-line first:border-t-0">
                  <Link
                    href={`/admin/mail/${m.accountId}/${m.folderId}/${m.messageId}`}
                    className="grid grid-cols-1 gap-x-4 px-4 py-3 hover:bg-panel-2 sm:grid-cols-[14rem_1fr_6rem]"
                  >
                    <span className={`truncate text-sm ${m.unread ? "font-semibold text-ink" : "text-muted"}`} title={sentFolder ? m.to : m.fromAddress}>
                      {m.unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label="unread" />}
                      {sentFolder ? `To ${m.to.replace(/"?([^"<]*)"?\s*<[^>]*>/g, "$1").trim() || m.to}` : m.from}
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className={m.unread ? "font-semibold text-teal" : "text-teal"}>{m.subject}</span>
                      {m.attachment && <span className="ml-2 text-xs text-faint">📎</span>}
                      <span className="block truncate text-faint">{m.summary}</span>
                    </span>
                    <span className="text-sm whitespace-nowrap text-faint sm:text-right">{ago(m.received)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mail && !(mail instanceof Error) && (start > 0 || mail.more) && (
        <nav className="mt-4 flex justify-between text-sm text-muted">
          {start > 0 ? <Link className="hover:text-ink" href={`/admin/mail?folder=${folder}&start=${Math.max(0, start - PAGE)}`}>← Newer</Link> : <span />}
          {mail.more && <Link className="hover:text-ink" href={`/admin/mail?folder=${folder}&start=${start + PAGE}`}>Older →</Link>}
        </nav>
      )}
    </main>
  );
}

function Note({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
  return (
    <p className={`mb-4 rounded-lg border px-4 py-3 text-sm ${alert ? "border-coral/40 bg-coral/10" : "border-line bg-panel"}`}>{children}</p>
  );
}
