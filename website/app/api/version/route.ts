import { readNotice } from "@/lib/feedback";
import { latestRelease } from "@/lib/release";
import { storageConfigured } from "@/lib/telemetry";

// The latest released version, for the plugin's update notice (Source/UpdateCheck.h), and the header
// notice when one is set in the admin panel. The plugin asks at most once a day per computer; the
// CDN answers most of those from its cache, so a new notice takes up to ten minutes to go out.
export async function GET() {
  const [{ version }, notice] = await Promise.all([latestRelease(), storageConfigured ? readNotice().catch(() => null) : null]);
  return Response.json(
    { version, url: "https://getsnaptune.com/#install", ...(notice ? { notice } : {}) },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
