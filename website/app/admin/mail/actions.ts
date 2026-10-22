"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { addresses, downloadAttachment, markRead, readMessage, sendMail, trash } from "@/lib/mail";
import { MAX_UPLOAD } from "@/lib/mail-limits";

// Server Actions take direct POSTs, so each checks the admin password itself instead of relying on proxy.ts.
async function requireAdmin() {
  if (!isAdmin((await headers()).get("authorization"))) throw new Error("Not authorized");
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type ComposeState = { error?: string };

export async function sendAction(_: ComposeState, form: FormData): Promise<ComposeState> {
  await requireAdmin();

  const mode = field(form, "mode");
  const [accountId, from] = field(form, "from").split("|");
  const to = addresses(field(form, "to")).join(",");
  const cc = addresses(field(form, "cc")).join(",");
  const subject = field(form, "subject");
  const text = field(form, "body");
  if (!accountId || !from) return { error: "Pick who it's from." };
  if (!to) return { error: "Add at least one recipient." };

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_UPLOAD) return { error: "Attachments are over 4 MB together. Send big files from Zoho." };

  let html = `<div style="white-space:pre-wrap">${escapeHtml(text)}</div>`;
  let replyTo: string | undefined;

  if (mode !== "new") {
    // The quoted original comes from Zoho again, not from the form.
    try {
      const original = await readMessage(field(form, "a"), field(form, "f"), field(form, "m"));
      const when = new Date(original.received).toLocaleString("en-GB", { timeZone: "America/Argentina/Buenos_Aires" });
      const quote =
        mode === "forward"
          ? `<div>---------- Forwarded message ----------<br>From: ${escapeHtml(original.from)}<br>Date: ${when}<br>Subject: ${escapeHtml(original.subject)}<br>To: ${escapeHtml(original.to)}</div><br>${original.html}`
          : `<div>On ${when}, ${escapeHtml(original.from)} wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${original.html}</blockquote>`;
      html += `<br><br>${quote}`;
      if (mode !== "forward") replyTo = original.messageId;
      // A forward carries the original's attachments unless they were unticked.
      if (mode === "forward" && form.get("keepAttachments")) {
        for (const a of original.attachments) {
          const res = await downloadAttachment(original.accountId, original.folderId, original.messageId, a.attachmentId);
          files.push(new File([await res.arrayBuffer()], a.name));
        }
      }
    } catch (e) {
      return { error: `Couldn't load the original: ${(e as Error).message}` };
    }
  }

  try {
    await sendMail({ accountId, from, to, cc, subject, html, replyTo, files });
  } catch (e) {
    return { error: `Not sent. ${(e as Error).message}` };
  }
  redirect("/admin/mail?folder=Sent&sent=1");
}

export async function markUnreadAction(form: FormData) {
  await requireAdmin();
  await markRead(field(form, "a"), field(form, "m"), false);
  redirect("/admin/mail");
}

export async function trashAction(form: FormData) {
  await requireAdmin();
  await trash(field(form, "a"), field(form, "f"), field(form, "m"));
  redirect("/admin/mail?trashed=1");
}
