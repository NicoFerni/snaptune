// Tells Bing (and the other IndexNow engines: Yandex, Seznam, Naver) that the pages in the live
// sitemap changed, so they recrawl now instead of whenever they next pass. Run after a deploy that
// changes text:
//
//   npm run indexnow               (from website/)
//
// The key is public by design: IndexNow checks that public/<key>.txt on the site holds it.

const site = process.env.SITE_URL ?? "https://getsnaptune.com";
const key = "ff344364034771ecc3fca62127b85a20";

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
});

// 200 and 202 both mean accepted; 403 means the key file isn't live yet.
console.log(`${res.status} ${res.statusText}: ${urlList.length} URLs`);
if (!res.ok) process.exit(1);
