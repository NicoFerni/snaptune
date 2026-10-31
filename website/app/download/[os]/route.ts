import { latestRelease } from "@/lib/release";
import { recordDownload, storageConfigured } from "@/lib/telemetry";

// The site's download buttons land here: count the visitor once per IP, then send them on to the
// installer on GitHub. GitHub's own counter adds up every request, retries and updates included.

const SYSTEMS = { mac: "mac", windows: "windows", linux: "linux" } as const;
const BOTS = /bot|crawl|spider|slurp|preview|curl|wget|python|node|undici|go-http|headless/i;

export async function GET(request: Request, { params }: { params: Promise<{ os: string }> }) {
  const { os } = await params;
  const system = SYSTEMS[os as keyof typeof SYSTEMS];
  if (!system) return new Response(null, { status: 404 });

  const href = (await latestRelease())[system];
  if (!href) return new Response(null, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (storageConfigured && ip && !BOTS.test(request.headers.get("user-agent") ?? "")) {
    await recordDownload(ip, system).catch(() => {});
  }

  return Response.redirect(href, 302);
}
