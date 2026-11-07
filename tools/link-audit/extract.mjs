// The links to audit, as deployed: here.events/cities.json lists the live sites; each site serves its city.js at its
// root. Prints JSON: [{ url, uses: [{ site, venue, field }] }] — one entry per distinct link.
// usage: node extract.mjs > links.json
import vm from 'node:vm';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r; };

const list = await (await get('https://here.events/cities.json')).json();
const sites = (list.cities || list).filter((c) => c.live).map((c) => ({ ...c, url: c.url || `https://${c.key}.here.events/` })); // url only where it is not <key>.here.events
const links = new Map();
const add = (url, use) => {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return;
  if (!links.has(u)) links.set(u, { url: u, uses: [] });
  links.get(u).uses.push(use);
};
const failed = [];
for (const s of sites) {
  try {
    const src = await (await get(new URL('city.js', s.url).href)).text();
    const ctx = {}; ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
    vm.runInNewContext(src, ctx, { timeout: 5000 });
    const city = ctx.LQACity || {};
    for (const [venue, v] of Object.entries(city.venues || city.rooms || {})) {
      add(v && v.url, { site: s.key, venue, field: 'url' });
      add(v && v.tm && v.tm.fallbackUrl, { site: s.key, venue, field: 'tm.fallbackUrl' });
    }
    for (const t of city.teams || []) {
      const who = t.name || t.label || t.slug || '';
      add(t.schedule, { site: s.key, venue: who, field: 'team schedule' });
      add(t.inject && t.inject.url, { site: s.key, venue: who, field: 'team inject' });
    }
  } catch (err) { failed.push(`${s.key}: ${String(err.message || err).split('\n')[0]}`); }
}
process.stdout.write(JSON.stringify({ sites: sites.map((s) => s.key), failed, links: [...links.values()] }, null, 1));
