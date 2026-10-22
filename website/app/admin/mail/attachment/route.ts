import { isAdmin } from "@/lib/admin-auth";
import { downloadAttachment } from "@/lib/mail";

// An email attachment, passed through from Zoho: /admin/mail/attachment?a=…&f=…&m=…&id=…&name=…
// Always a download, never shown inline, so a sender's HTML or SVG can't run on this origin.

export async function GET(request: Request) {
  if (!isAdmin(request.headers.get("authorization"))) return new Response(null, { status: 401 });

  const q = new URL(request.url).searchParams;
  const get = (k: string) => q.get(k) ?? "";
  try {
    const res = await downloadAttachment(get("a"), get("f"), get("m"), get("id"));
    const name = (get("name") || "attachment").replace(/[\r\n"]/g, "");
    return new Response(res.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
