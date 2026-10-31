#!/usr/bin/env node
// Checks that every download button on the live site downloads something: each "Download for …"
// link on the home page and the guides must answer 200 after redirects, and the home page must offer
// Mac and Windows directly. Run by .github/workflows/downloads.yml; exits 1 on any failure.
//
//   node website/scripts/check-downloads.mjs [https://getsnaptune.com]

const site = (process.argv[2] ?? "https://getsnaptune.com").replace(/\/$/, "");
const pages = ["/", "/free-autotune", "/autotune-fl-studio", "/autotune-linux"];
const failures = [];

async function status(url, method = "HEAD") {
  try {
    const res = await fetch(url, { method, redirect: "follow" });
    // Some hosts refuse HEAD; ask again for the first byte only.
    if (method === "HEAD" && (res.status === 403 || res.status === 405)) return status(url, "GET");
    return res.status;
  } catch (error) {
    return `error ${error.cause?.code ?? error.message}`;
  }
}

for (const page of pages) {
  const res = await fetch(site + page, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) {
    failures.push(`${page}: page answered ${res.status}`);
    continue;
  }

  const html = await res.text();
  const buttons = [...html.matchAll(/<a href="([^"]+)"[^>]*>Download for (\w+)<\/a>/g)].map(([, href, system]) => ({ href: href.replace(/&amp;/g, "&"), system }));

  if (page === "/") {
    for (const system of ["Mac", "Windows"]) {
      const button = buttons.find((b) => b.system === system);
      if (!button) failures.push(`/: no "Download for ${system}" button`);
      else if (!/\/releases\/download\/|^\/download\//.test(button.href)) failures.push(`/: "Download for ${system}" opens ${button.href}, not an installer`);
    }
  }

  for (const b of buttons) {
    const code = await status(new URL(b.href, site).href);
    console.log(`${code}  ${page}  ${b.system}  ${b.href}`);
    if (code !== 200) failures.push(`${page}: "Download for ${b.system}" (${b.href}) answered ${code}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nEvery download works.");
