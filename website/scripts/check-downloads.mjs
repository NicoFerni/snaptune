#!/usr/bin/env node
// Checks that every download button on the live site downloads something: each "Download for …"
// link on the home page and the guides must answer 200 after redirects, and the home page must offer
// Mac and Windows directly. Run by .github/workflows/downloads.yml; exits 1 on any failure.
//
//   node website/scripts/check-downloads.mjs [https://getsnaptune.com]

const site = (process.argv[2] ?? "https://getsnaptune.com").replace(/\/$/, "");
const pages = ["/", "/free-autotune", "/autotune-fl-studio", "/autotune-linux"];
const failures = [];

// Vercel or GitHub's file host now and then answers 5xx for a minute; only a failure that outlasts a
// few retries is a broken download.
const transient = (code) => typeof code !== "number" || code === 429 || code >= 500;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries(check) {
  let result;
  for (const delay of [0, 15_000, 45_000]) {
    if (delay) await wait(delay);
    result = await check();
    if (!transient(result.code)) break;
  }
  return result;
}

async function status(url, method = "HEAD") {
  try {
    const res = await fetch(url, { method, redirect: "follow" });
    // Some hosts refuse HEAD; ask again for the first byte only.
    if (method === "HEAD" && (res.status === 403 || res.status === 405)) return status(url, "GET");
    return { code: res.status, host: new URL(res.url).host };
  } catch (error) {
    return { code: `error ${error.cause?.code ?? error.message}`, host: new URL(url).host };
  }
}

async function page(url) {
  try {
    const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    return { code: res.status, html: res.ok ? await res.text() : "" };
  } catch (error) {
    return { code: `error ${error.cause?.code ?? error.message}`, html: "" };
  }
}

for (const path of pages) {
  const { code, html } = await withRetries(() => page(site + path));
  if (code !== 200) {
    failures.push(`${path}: page answered ${code}`);
    continue;
  }

  const buttons = [...html.matchAll(/<a href="([^"]+)"[^>]*>Download for (\w+)<\/a>/g)].map(([, href, system]) => ({ href: href.replace(/&amp;/g, "&"), system }));

  if (path === "/") {
    for (const system of ["Mac", "Windows"]) {
      const button = buttons.find((b) => b.system === system);
      if (!button) failures.push(`/: no "Download for ${system}" button`);
      else if (!/\/releases\/download\/|^\/download\//.test(button.href)) failures.push(`/: "Download for ${system}" opens ${button.href}, not an installer`);
    }
  }

  for (const b of buttons) {
    const { code, host } = await withRetries(() => status(new URL(b.href, site).href));
    console.log(`${code}  ${path}  ${b.system}  ${b.href}  (${host})`);
    if (code !== 200) failures.push(`${path}: "Download for ${b.system}" (${b.href}) answered ${code} from ${host}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nEvery download works.");
