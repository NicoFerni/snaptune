import { latestRelease } from "@/lib/release";

// The latest released version, for the plugin's update notice (Source/UpdateCheck.h). The plugin
// asks at most once a day per computer; the CDN answers most of those from its cache.
export async function GET() {
  const { version } = await latestRelease();
  return Response.json({ version, url: "https://getsnaptune.com/#install" }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
