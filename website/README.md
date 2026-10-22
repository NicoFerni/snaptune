# SnapTune website

The download page for SnapTune, plus the plugin's usage-ping API and a private admin panel. Next.js on Vercel.

```sh
npm install
npm run dev      # http://localhost:3000
npm run build
```

- The version and download link come from `project(SnapTune VERSION …)` in `../CMakeLists.txt`, so a release needs no change here.
- Ko-fi link and the Apple Developer Program goal live in `lib/site.ts`. Update `raised` by hand; the progress bar stays hidden at 0.
- The link preview (`app/opengraph-image.tsx`) is rendered at build time from `public/screenshot.png`, so `npm run shots` refreshes it too. Links point at `https://getsnaptune.com`; set `SITE_URL` to host the site elsewhere.

## Admin panel and usage pings

`/admin` shows plugin usage (installs, active installs, sessions per day, unclean exits, OS, DAW, version,
format, country), downloads per release and OS, and GitHub issues. The plugin posts one ping per DAW
session to `/api/ping` (`app/api/ping/route.ts`, sender in `../Source/Telemetry.cpp`).

Vercel environment variables:

| Variable | What it does |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis, set by adding Upstash from the Vercel Marketplace. Without it the panel shows only GitHub data and pings get a 503. |
| `ADMIN_PASSWORD` | Password for `/admin` (HTTP Basic auth, any user name; `proxy.ts`). Without it `/admin` is a 404. |
| `GITHUB_TOKEN` | Optional. Raises GitHub's API limit (60 requests/hour per IP without it; the panel caches for 5 minutes). |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | Optional. The Zoho mailbox of nicolas@ (`lib/mail.ts`). Without them the Mail panel says so. |
| `ZOHO_SUPPORT_CLIENT_ID`, `…_CLIENT_SECRET`, `…_REFRESH_TOKEN` | Optional. support@, a separate Zoho user. Any `ZOHO_<NAME>_*` set adds one more mailbox. |
| `ZOHO_DOMAIN` | Optional. Zoho data centre, `zoho.com` by default (`zoho.eu`, `zoho.in`, …: whatever your Zoho Mail URL uses). |

Mail: `/admin` shows the newest 8 inbox messages, and `/admin/mail` is the whole mailbox (Inbox, Sent,
Spam, Trash) across every Zoho mailbox configured: read (in a sandboxed frame, no scripts), download
attachments (always as a download, never shown on this origin), reply, reply all, forward (with the
original's attachments), write new mail with attachments, mark unread, move to the trash. Opening a
message marks it read. Uploads are capped at 4 MB per email (Vercel takes 4.5 MB per request); send bigger
files from Zoho. Each Server Action checks `ADMIN_PASSWORD` again (`lib/admin-auth.ts`), since actions can
be POSTed to directly.

To get the token, at [api-console.zoho.com](https://api-console.zoho.com) add a **Self Client**, then under
*Generate Code* use the scope `ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL` and
exchange the code within its lifetime:

```sh
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d grant_type=authorization_code -d client_id=… -d client_secret=… -d code=…
```

Copy `refresh_token` from the answer into Vercel. A token covers the mailboxes of the Zoho user who
generated the code, so each separate user (support@ is one) needs its own Self Client and its own
`ZOHO_<NAME>_*` set. Replies go out from whichever of your addresses the message was sent to.

"Unclean exit" means a session whose SnapTune never shut down: the DAW or the plugin crashed, or the DAW
was killed. Some DAWs exit without unloading plugins, which also counts, so watch for clusters on one
version or host rather than the raw number.

To test a plugin build against a local server: `SNAPTUNE_TELEMETRY_URL=http://localhost:3000/api/ping`.

## The playable plugin window

"Play it here" is the SnapTune window rebuilt in HTML and SVG (`components/demo/`), running the real engine in an AudioWorklet. Visitors can play a test voice, sing into their mic (live with headphones, or record a 10 s take), or open their own file.

- `public/snaptune-worklet.js` is a line-by-line port of `../Source/dsp` (Scales, PitchDetector, AutoTuneEngine). Checked against the compiled C++ engine on test melodies and speech, in both modes and at 44.1 and 48 kHz: the output matched to 88–98 dB SNR, with the same voicing and target note on every frame. When the C++ changes, port the change.
- The same file holds the test voice: a synthesized singer, off-key on purpose, over chords played in tune. The page says it's synthesized.
- Before anyone presses play, the window shows the first 4 seconds of the test voice through the engine. After changing the engine, the test voice or the demo's default settings (`components/demo/model.ts`), refresh that with `npm run demo-frames`, which writes `lib/demo-frames.json`.
- Layout: from 760 px wide it's the plugin's own 1000 × 640 layout, scaled. Narrower, the same panels stack.

## Look, pictures and film

The page is set like the manual of a precision instrument: a gold cover, the playable window, a sheet per
feature, a receipt, the method beside the machines that first drew a voice, a letter, a reply card.

- Type: Rokkitt for display (capitals) and Literata for text, both SIL OFL, loaded with `next/font`.
  The link preview uses static cuts of both in `assets/fonts/`.
- Colours: bottle green and gold, ivory for paper (`app/globals.css`), the plugin's own palette
  (`../Source/ui/SnapLookAndFeel.h`). The mark is a cent sign drawn as a tuner (`components/Logo.tsx`).
- `public/shots/*.webp` and `public/screenshot.png` are cut from the plugin's own rendering by
  `npm run shots`.
- `public/media/snaptune-loop.mp4` and `.jpg`, the film on the cover, come from the promo project:
  `cd ../promo && npm run loop`. Without them the cover shows the screenshot.
- `public/archive/` holds public-domain engravings and photographs from Wikimedia Commons, with their
  credits in `credits.json`; the footer's imprint reads it. The 4:5 plates in "How it works" are cut
  from them.
