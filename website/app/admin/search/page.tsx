import type { Metadata } from "next";
import { getSearch, percent } from "@/lib/admin-data";
import { searchConfigured, type SearchRow } from "@/lib/search-console";
import { AdminNav, Notice, Panel, Stat, Table, ValueBars } from "../ui";

// Google search from Search Console: the last 28 days, what people searched and which pages showed up.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapTune admin · Google",
  robots: { index: false, follow: false },
};

export default async function Search() {
  const search = await getSearch();
  const report = search && !(search instanceof Error) ? search : null;
  const clicks = report?.perDay.reduce((sum, r) => sum + r.clicks, 0) ?? 0;
  const impressions = report?.perDay.reduce((sum, r) => sum + r.impressions, 0) ?? 0;
  // Average rank over the 28 days, each day weighed by how often the site showed.
  const position = impressions ? (report?.perDay.reduce((sum, r) => sum + r.position * r.impressions, 0) ?? 0) / impressions : null;

  return (
    <>
      <AdminNav current="search" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="mb-4 text-2xl font-semibold">Google search <span className="text-base font-normal text-faint">· last 28 days</span></h1>
        {!searchConfigured && <Notice>Not set up: add GSC_CLIENT_ID, GSC_CLIENT_SECRET and GSC_REFRESH_TOKEN to the Vercel project.</Notice>}
        {search instanceof Error && <Notice>Couldn&apos;t read Search Console: {search.message}</Notice>}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Clicks" value={clicks} note="to getsnaptune.com" />
              <Stat label="Impressions" value={impressions} note="times it showed in results" />
              <Stat label="CTR" value={percent(clicks, impressions)} note="clicks per impression" />
              <Stat label="Average position" value={position ? position.toFixed(1) : "–"} note="rank in the results" info="Each day's average rank, weighed by that day's impressions." />
            </div>

            <Panel title="Clicks per day">
              <ValueBars data={report.perDay.map((r) => ({ day: r.key, value: r.clicks, detail: `${r.clicks} clicks, ${r.impressions} impressions` }))} unit="clicks" />
            </Panel>

            <div className="grid gap-x-6 md:grid-cols-2">
              <Panel title="Queries" info="The top 15 searches the site showed up for. Pos. is the average rank in the results.">
                <Table head={["Query", "Clicks", "Impr.", "Pos."]} align={["left", "right", "right", "right"]} rows={rows(report.queries)} empty="No searches yet." />
              </Panel>
              <Panel title="Pages" info="The top 10 pages in the results.">
                <Table
                  head={["Page", "Clicks", "Impr.", "Pos."]}
                  align={["left", "right", "right", "right"]}
                  rows={rows(report.pages, (p) => p.replace(/^https?:\/\/getsnaptune\.com/, "") || "/")}
                  empty="No pages yet."
                />
              </Panel>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function rows(list: SearchRow[], label: (key: string) => string = (k) => k): React.ReactNode[][] {
  return list.map((r) => [
    <span key="k" className="block max-w-[16rem] truncate" title={r.key}>
      {label(r.key)}
    </span>,
    r.clicks,
    r.impressions,
    r.position.toFixed(1),
  ]);
}
