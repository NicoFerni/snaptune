"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { clearNotice, NOTICE_LENGTH, NOTICE_ORIGIN, saveNotice } from "@/lib/feedback";

// Server Actions take direct POSTs, so each checks the admin password itself instead of relying on proxy.ts.
async function requireAdmin() {
  if (!isAdmin((await headers()).get("authorization"))) throw new Error("Not authorized");
}

/** Sets the line the plugin shows in its header, or takes it down when the text is empty. The
    plugin refuses a longer text or a page outside this site, so neither is saved. */
export async function setNoticeAction(form: FormData): Promise<void> {
  await requireAdmin();

  const text = String(form.get("text") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();

  if (!text || form.get("clear")) await clearNotice();
  else if (text.length <= NOTICE_LENGTH && url.startsWith(NOTICE_ORIGIN)) await saveNotice(text, url);

  revalidatePath("/admin");
}
