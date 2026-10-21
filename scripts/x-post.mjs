#!/usr/bin/env node
// Posts to X from the terminal using OAuth 1.0a (user context).
//
// Usage:
//   node scripts/x-post.mjs "Post text"
//   node scripts/x-post.mjs --file post.txt
//   node scripts/x-post.mjs --dry-run "Post text"
//   node scripts/x-post.mjs --video promo.mp4 --file post.txt
//
// Keys are read from scripts/.env (gitignored):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(import.meta.dirname, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const option = name => (args.indexOf(name) !== -1 ? args[args.indexOf(name) + 1] : undefined);
const file = option('--file');
const video = option('--video');
const text = (file
  ? fs.readFileSync(file, 'utf8')
  : args.filter((a, i) => a !== '--dry-run' && !['--file', '--video'].includes(args[i - 1]) && !['--file', '--video'].includes(a)).join(' ')
).trim();

if (!text) {
  console.error('Usage: node scripts/x-post.mjs [--dry-run] "Post text" | --file post.txt');
  process.exit(1);
}
if (text.length > 280) {
  console.error(`Post is ${text.length} characters, the limit is 280.`);
  process.exit(1);
}
if (video && !fs.existsSync(video)) {
  console.error(`No such video: ${video}`);
  process.exit(1);
}
if (dryRun) {
  console.log(`[dry run] ${text.length}/280 characters${video ? `, with ${video}` : ''}:\n\n${text}`);
  process.exit(0);
}
if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.error(`Missing keys. Create ${envPath} with X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.`);
  process.exit(1);
}

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Query parameters are part of the signature; JSON and multipart bodies are not.
function authHeader(method, url, query = {}) {
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const all = { ...query, ...oauth };
  const params = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&');
  const base = [method, enc(url), enc(params)].join('&');
  const key = `${enc(X_API_SECRET)}&${enc(X_ACCESS_TOKEN_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

async function api(method, url, { json, form, query } = {}) {
  const full = query ? `${url}?${new URLSearchParams(query)}` : url;
  const res = await fetch(full, {
    method,
    headers: { Authorization: authHeader(method, url, query), ...(json && { 'Content-Type': 'application/json' }) },
    body: json ? JSON.stringify(json) : form,
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`Error ${res.status}:`, JSON.stringify(body, null, 2));
    if (res.status === 403) {
      console.error('\nIf it says "oauth1-permissions": set the app to "Read and write" in the developer portal, then regenerate the Access Token and Secret.');
    }
    process.exit(1);
  }
  return body;
}

// Chunked upload (v2 media endpoints), then wait for X to finish processing the video.
async function uploadVideo(path) {
  const bytes = fs.readFileSync(path);
  const base = 'https://api.x.com/2/media/upload';
  const { data } = await api('POST', `${base}/initialize`, { json: { media_type: 'video/mp4', total_bytes: bytes.length, media_category: 'tweet_video' } });
  const id = data.id;
  const chunk = 4 * 1024 * 1024;

  for (let i = 0; i * chunk < bytes.length; ++i) {
    const form = new FormData();
    form.append('segment_index', String(i));
    form.append('media', new Blob([bytes.subarray(i * chunk, (i + 1) * chunk)]), 'chunk');
    await api('POST', `${base}/${id}/append`, { form });
    console.log(`Uploaded ${Math.min(bytes.length, (i + 1) * chunk)} / ${bytes.length} bytes`);
  }

  let info = (await api('POST', `${base}/${id}/finalize`)).data?.processing_info;

  while (info && info.state !== 'succeeded') {
    if (info.state === 'failed') {
      console.error('X could not process the video:', JSON.stringify(info.error ?? info));
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, (info.check_after_secs ?? 2) * 1000));
    info = (await api('GET', base, { query: { command: 'STATUS', media_id: id } })).data?.processing_info;
  }

  return id;
}

const media = video ? { media: { media_ids: [await uploadVideo(video)] } } : {};
const body = await api('POST', 'https://api.x.com/2/tweets', { json: { text, ...media } });
console.log(`Posted: https://x.com/i/web/status/${body.data.id}`);
