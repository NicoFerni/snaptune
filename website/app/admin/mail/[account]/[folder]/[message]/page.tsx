import type { Metadata } from "next";
import Link from "next/link";
import { markRead, readMessage, webmail } from "@/lib/mail";
import { markUnreadAction, trashAction } from "../../../actions";

// One email from the admin mailbox. proxy.ts keeps it behind ADMIN_PASSWORD like /admin.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin · mail",
  robots: { index: false, follow: false },
};

const button = "rounded-lg border border-line px-3 py-1.5 text-sm hover:border-line-bright";

export default async function Message({ params }: { params: Promise<{ account: string; folder: string; message: string }> }) {
  const { account, folder, message } = await params;
  const mail = await readMessage(account, folder, message).catch((e: Error) => e);
  // Opening it here counts as reading it, as in Zoho. Best effort: a read-only token can't.
  if (!(mail instanceof Error)) await markRead(account, message, true).catch(() => {});

  const ids = `a=${account}&f=${folder}&m=${message}`;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <nav className="mb-6 flex flex-wrap justify-between gap-4 text-sm text-muted">
        <Link className="hover:text-ink" href="/admin/mail">← Mail</Link>
        <a className="hover:text-ink" href={webmail}>Zoho Mail ↗</a>
      </nav>

      {mail instanceof Error ? (
        <p className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm">Couldn&apos;t read this email: {mail.message}</p>
      ) : (
        <>
          <header className="mb-4">
            <h1 className="headline text-2xl">{mail.subject}</h1>
            <p className="mt-2 text-sm text-muted">From {mail.from}</p>
            <p className="text-sm text-faint">
              To {mail.to || "–"}
              {mail.cc && ` · Cc ${mail.cc}`} · {new Date(mail.received).toLocaleString("en-GB", { timeZone: "America/Argentina/Buenos_Aires" })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className={button} href={`/admin/mail/new?mode=reply&${ids}`}>Reply</Link>
              <Link className={button} href={`/admin/mail/new?mode=all&${ids}`}>Reply all</Link>
              <Link className={button} href={`/admin/mail/new?mode=forward&${ids}`}>Forward</Link>
              <form action={markUnreadAction}>
                <input type="hidden" name="a" value={account} />
                <input type="hidden" name="m" value={message} />
                <button className={button}>Mark unread</button>
              </form>
              <form action={trashAction}>
                <input type="hidden" name="a" value={account} />
                <input type="hidden" name="f" value={folder} />
                <input type="hidden" name="m" value={message} />
                <button className={`${button} text-coral`}>Trash</button>
              </form>
            </div>
          </header>
          {/* The sender wrote this HTML: no scripts, no same-origin access, links open in a new tab. */}
          <iframe
            title={mail.subject}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={`<base target="_blank"><style>body{font-family:system-ui,sans-serif;margin:16px;color:#111;background:#fff}img{max-width:100%;height:auto}</style>${mail.html}`}
            className="h-[70vh] w-full rounded-xl border border-line bg-white"
          />
        </>
      )}
    </main>
  );
}
