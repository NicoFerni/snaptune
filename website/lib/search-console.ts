// Google Search Console for the admin panel: what people searched, which pages showed up and how
// often they were clicked. Needs a Desktop OAuth client from the getsnaptune Google Cloud project
// and a refresh token for the account that owns the property (scope webmasters or webmasters.readonly):
//
//   GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN

const site = "sc-domain:getsnaptune.com";
const [clientId, clientSecret, refreshToken] = ["GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN"].map((k) => process.env[k]);

export const searchConfigured = Boolean(clientId && clientSecret && refreshToken);

export type SearchRow = { key: string; clicks: number; impressions: number; position: number };
export type SearchReport = { perDay: SearchRow[]; queries: SearchRow[]; pages: SearchRow[] };

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, refresh_token: refreshToken!, grant_type: "refresh_token" }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!data.access_token) throw new Error(`Google sign-in failed: ${data.error_description ?? data.error ?? res.status}`);
  cached = { token: data.access_token, expires: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 };
  return cached.token;
}

async function query(token: string, dimension: string, days: number, rowLimit: number): Promise<SearchRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: [dimension], rowLimit }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Search Console answered ${res.status}`);
  const data = (await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] };
  return (data.rows ?? []).map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }));
}

/** The last 28 days: one row per day, the top queries and the top pages. */
export async function readSearch(): Promise<SearchReport> {
  const token = await accessToken();
  const [perDay, queries, pages] = await Promise.all([query(token, "date", 28, 28), query(token, "query", 28, 15), query(token, "page", 28, 10)]);
  return { perDay, queries, pages };
}
