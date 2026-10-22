import type { Metadata } from "next";
import Link from "next/link";
import { accounts, addresses, readMessage } from "@/lib/mail";
import { ComposeForm, type ComposeDefaults } from "../ComposeForm";

// Write a new email, or reply / reply all / forward with ?mode=…&a=account&f=folder&m=message.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin · write",
  robots: { index: false, follow: false },
};

type Search = { mode?: string; a?: string; f?: string; m?: string; to?: string };

const prefix = (p: string, subject: string) => (subject.toLowerCase().startsWith(p.toLowerCase()) ? subject : `${p} ${subject}`);

export default async function Compose({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const mode: ComposeDefaults["mode"] = q.mode === "reply" || q.mode === "all" || q.mode === "forward" ? q.mode : "new";

  const loaded = await Promise.all([accounts(), mode === "new" ? null : readMessage(q.a ?? "", q.f ?? "", q.m ?? "")]).catch((e: Error) => e);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link className="hover:text-ink" href={q.m && q.a && q.f ? `/admin/mail/${q.a}/${q.f}/${q.m}` : "/admin/mail"}>← Back</Link>
      </nav>
      <h1 className="headline mb-6 text-2xl">{{ new: "New email", reply: "Reply", all: "Reply all", forward: "Forward" }[mode]}</h1>

      {loaded instanceof Error ? (
        <p className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm">Couldn&apos;t load: {loaded.message}</p>
      ) : (
        <ComposeForm defaults={defaults(mode, ...loaded, q)} />
      )}
    </main>
  );
}

function defaults(
  mode: ComposeDefaults["mode"],
  list: Awaited<ReturnType<typeof accounts>>,
  original: Awaited<ReturnType<typeof readMessage>> | null,
  q: Search,
): ComposeDefaults {
  // A reply goes out from the mailbox it came to, and from the address it was sent to when that's ours.
  const usable = original ? list.filter((a) => a.accountId === original.accountId) : list;
  const from = usable.flatMap((a) => a.sendFrom.map((address) => ({ value: `${a.accountId}|${address}`, label: address })));
  const ours = new Set(from.map((o) => o.label.toLowerCase()));
  const addressedTo = original ? addresses(`${original.to},${original.cc}`).find((x) => ours.has(x.toLowerCase())) : undefined;
  const defaultFrom = from.find((o) => o.label.toLowerCase() === addressedTo?.toLowerCase())?.value ?? from[0]?.value ?? "";

  if (!original) return { mode, from, defaultFrom, to: q.to ?? "", cc: "", subject: "" };

  const others = (header: string) => addresses(header).filter((x) => !ours.has(x.toLowerCase()) && x !== original.fromAddress);
  return {
    mode,
    from,
    defaultFrom,
    to: mode === "forward" ? "" : [original.fromAddress, ...(mode === "all" ? others(original.to) : [])].join(", "),
    cc: mode === "all" ? others(original.cc).join(", ") : "",
    subject: prefix(mode === "forward" ? "Fwd:" : "Re:", original.subject),
    original: { a: original.accountId, f: original.folderId, m: original.messageId },
  };
}
