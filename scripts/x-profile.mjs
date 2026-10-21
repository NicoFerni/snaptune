#!/usr/bin/env node
// Shows or updates the X profile with the API (v1.1 account endpoints, OAuth 1.0a user context).
//
// Usage:
//   node scripts/x-profile.mjs              show the current profile
//   node scripts/x-profile.mjs --dry-run    show what --apply would change
//   node scripts/x-profile.mjs --apply      update name, bio, link, avatar and header
//
// Keys are read from scripts/.env (gitignored), the same ones x-post.mjs uses.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(import.meta.dirname, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
const brand = path.join(import.meta.dirname, '..', 'brand', 'social');

const profile = {
  name: 'SnapTune',
  description: 'Free, open-source pitch correction plugin. VST3, AU and LV2 for Mac, Windows and Linux. Hard-tune your vocals and hear it live while you record.',
  url: 'https://getsnaptune.com',
};
const avatar = path.join(brand, 'avatar-400.png');
const header = path.join(brand, 'x-header-1500x500.png');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run');

if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.error(`Missing keys. Create ${envPath} with X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.`);
  process.exit(1);
}
if (profile.description.length > 160) {
  console.error(`Bio is ${profile.description.length} characters, the limit is 160.`);
  process.exit(1);
}

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Form and query parameters are part of the OAuth 1.0a signature, unlike JSON bodies.
function authHeader(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&');
  const base = [method, enc(url), enc(paramString)].join('&');
  const key = `${enc(X_API_SECRET)}&${enc(X_ACCESS_TOKEN_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

async function call(method, endpoint, params = {}) {
  const url = `https://api.x.com/1.1/${endpoint}`;
  const body = new URLSearchParams(params).toString().replace(/\+/g, '%20');
  const res = await fetch(method === 'GET' && body ? `${url}?${body}` : url, {
    method,
    headers: {
      Authorization: authHeader(method, url, params),
      ...(method === 'POST' && { 'Content-Type': 'application/x-www-form-urlencoded' }),
    },
    ...(method === 'POST' && { body }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${endpoint}: error ${res.status} ${text}`);
    if (res.status === 403) console.error('Profile endpoints may need a paid API tier, or the app may lack "Read and write".');
    process.exit(1);
  }
  return text ? JSON.parse(text) : {};
}

const me = await call('GET', 'account/verify_credentials.json', { skip_status: 'true', include_entities: 'true' });
const currentUrl = me.entities?.url?.urls?.[0]?.expanded_url ?? me.url ?? '';
console.log(`@${me.screen_name}`);
console.log(`  name:     ${me.name}`);
console.log(`  bio:      ${me.description}`);
console.log(`  link:     ${currentUrl}`);
console.log(`  location: ${me.location}`);
console.log(`  avatar:   ${me.profile_image_url_https}`);
console.log(`  header:   ${me.profile_banner_url ?? '(none)'}`);

if (!apply && !dryRun) process.exit(0);

console.log('\nNew profile:');
console.log(`  name:   ${profile.name}`);
console.log(`  bio:    ${profile.description} (${profile.description.length}/160)`);
console.log(`  link:   ${profile.url}`);
console.log(`  avatar: ${path.relative(process.cwd(), avatar)}`);
console.log(`  header: ${path.relative(process.cwd(), header)}`);
if (dryRun) process.exit(0);

await call('POST', 'account/update_profile.json', { ...profile, skip_status: 'true' });
console.log('\nUpdated name, bio and link.');
await call('POST', 'account/update_profile_image.json', { image: fs.readFileSync(avatar).toString('base64'), skip_status: 'true' });
console.log('Updated avatar.');
await call('POST', 'account/update_profile_banner.json', { banner: fs.readFileSync(header).toString('base64') });
console.log('Updated header.');
console.log(`\nhttps://x.com/${me.screen_name}`);
