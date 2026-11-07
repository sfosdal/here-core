#!/usr/bin/env node
// Vendor every venue icon a city.js still loads from another site (Google's favicon service, a venue's own server)
// into the repo, once, by hand — never as a build step (Steve, 2026-11-06, after the hijacked tigresqr.com: a domain
// that lapses can serve anything, and a page that fetches its favicon live would show it). Each icon is fetched once,
// saved to site/marks/venues/<host>.<ext>, and city.js points at that file. An icon that cannot be had (Google answers
// 404 with its grey globe when a site has none) is dropped: the venue shows no mark, as a venue without a logo does.
// The files are committed after a look at the contact sheets this writes (every sheet, not a sample).
//
// usage: node tools/venue-marks.mjs [--dry] <out dir for sheets> <repo> ...
// Re-running is safe: icons already local are left as they are.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const dry = args[0] === '--dry' && args.shift();
const [sheets, ...repos] = args;
if (!sheets || !repos.length) { console.error('usage: venue-marks.mjs [--dry] <sheet dir> <repo> ...'); process.exit(2); }
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const EXT = { 'image/png': 'png', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/webp': 'webp' };

// the file name an icon gets: the venue's host (Google's ?domain=, or the icon's own host plus its file name)
export function markName(url) {
  const u = new URL(url);
  if (u.hostname === 'www.google.com' && u.pathname === '/s2/favicons') return (u.searchParams.get('domain') || 'unknown').replace(/^www\./, '').toLowerCase();
  return (u.hostname.replace(/^www\./, '') + '-' + basename(u.pathname).replace(/\.[a-z0-9]+$/i, '')).toLowerCase();
}

const cache = new Map(); // one fetch per icon URL across every repo
async function get(url) {
  if (cache.has(url)) return cache.get(url);
  let got = null;
  for (let i = 0; i < 5 && !got; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      // Google's favicon service answers 404 (its grey globe) from one of its t0–t3 hosts now and then for a site it
      // does have: ask five times, a few seconds apart, before taking a 404 as "this site has no icon"
      if (r.status === 404 || r.status === 410) { if (i < 4 && /google\.com\/s2\//.test(url)) { await new Promise((r) => setTimeout(r, 3000)); continue; } got = { missing: `HTTP ${r.status}` }; break; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!EXT[type]) { got = { missing: `not an image (${type || 'no type'})` }; break; }
      got = { body: Buffer.from(await r.arrayBuffer()), ext: EXT[type] };
    } catch (err) { if (i >= 2) got = { missing: String(err.message || err) }; else await new Promise((r) => setTimeout(r, 1500)); }
  }
  cache.set(url, got);
  return got;
}

const sheet = []; // [{ repo, venue, file, src, missing }]
for (const repo of repos) {
  const path = join(repo, 'site/city.js');
  let text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  let venue = '', changed = 0, dropped = 0;
  const out = [];
  for (const line of lines) {
    const v = line.match(/^\s{4}'((?:[^'\\]|\\.)+)':\s*\{/) || line.match(/^\s{4}"((?:[^"\\]|\\.)+)":\s*\{/);
    if (v) venue = v[1].replace(/\\(.)/g, '$1');
    const m = line.match(/^(\s*)icon: '(https?:\/\/[^']+)',\s*$/);
    if (!m) { out.push(line); continue; }
    const got = await get(m[2]);
    if (got.missing) { sheet.push({ repo, venue, src: m[2], missing: got.missing }); dropped++; continue; }
    const file = `marks/venues/${markName(m[2])}.${got.ext}`;
    if (!dry) { mkdirSync(join(repo, 'site/marks/venues'), { recursive: true }); if (!existsSync(join(repo, 'site', file))) writeFileSync(join(repo, 'site', file), got.body); }
    out.push(`${m[1]}icon: '${file}',`);
    sheet.push({ repo, venue, file, src: m[2], body: got.body, ext: got.ext });
    changed++;
  }
  if (!dry && (changed || dropped)) writeFileSync(path, out.join('\n'));
  console.log(`${repo.split('/').slice(-2).join('/')}: ${changed} vendored, ${dropped} dropped`);
}

// contact sheets: one tile per distinct icon, 60 a sheet, with every venue that uses it; dropped icons listed apart
mkdirSync(sheets, { recursive: true });
const byFile = new Map();
for (const s of sheet.filter((s) => s.file)) {
  const k = s.file;
  if (!byFile.has(k)) byFile.set(k, { ...s, venues: new Set() });
  byFile.get(k).venues.add(`${s.venue} (${s.repo.split('/').at(-2) === 'scratchpad' ? 'lqa' : s.repo.split('/').at(-2).replace(/-events$/, '')})`);
}
const tiles = [...byFile.values()];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const mime = { png: 'image/png', ico: 'image/x-icon', jpg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif', webp: 'image/webp' };
const pages = Math.ceil(tiles.length / 60);
for (let p = 0; p < pages; p++) {
  const part = tiles.slice(p * 60, p * 60 + 60);
  writeFileSync(join(sheets, `sheet-${p + 1}.html`), `<!doctype html><meta charset=utf-8><style>body{font:11px -apple-system,sans-serif;margin:12px;background:#fff}h1{font-size:14px}.g{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.t{display:flex;gap:8px;align-items:center;border:1px solid #ddd;padding:6px;height:64px;overflow:hidden}.t img{width:48px;height:48px;object-fit:contain;flex:none;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/12px 12px}b{display:block;font-size:11px}</style><h1>Venue marks ${p + 1} of ${pages} (${tiles.length} distinct icons)</h1><div class=g>${part.map((t) => `<div class=t><img src="data:${mime[t.ext]};base64,${t.body.toString('base64')}"><div><b>${esc(t.file.slice(13))}</b>${esc([...t.venues].join(' · '))}</div></div>`).join('')}</div>`);
}
const missing = sheet.filter((s) => s.missing);
writeFileSync(join(sheets, 'dropped.txt'), missing.map((s) => `${s.repo.split('/').at(-2)}\t${s.venue}\t${s.missing}\t${s.src}`).join('\n') + '\n');
console.log(`${tiles.length} distinct icons on ${pages} sheets, ${missing.length} dropped (dropped.txt) → ${sheets}`);
