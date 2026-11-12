import { llmsText } from "@/lib/llms";
import { latestRelease } from "@/lib/release";

// /llms-full.txt: see lib/llms.ts.
export async function GET() {
  const text = llmsText(await latestRelease(), true);
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
