// Twin Peaks' map: a made-up ground for the Map view (no OpenStreetMap read) —
// a river, a lake, two roads and the town's labels, in the same shape
// scripts/build-local-map.mjs writes for a real city.
//   node demo/make-map.mjs  → site/local-map.json
import { writeFileSync } from 'node:fs';
import '../site/city.js';

const CITY = globalThis.LQACity, [S, Wb, N, E] = CITY.map.bbox;
const W = 1000, H = 625, cx = (Wb + E) / 2, cy = (S + N) / 2, k = Math.cos(cy * Math.PI / 180);
const s = Math.min(W / ((E - Wb) * k), H / (N - S));
const px = (lat, lon) => [(lon - cx) * k * s + W / 2, (cy - lat) * s + H / 2].map((v) => Math.round(v * 10) / 10);
const path = (pts, close) => 'M' + pts.map(([la, lo]) => px(la, lo).join(' ')).join('L') + (close ? 'Z' : '');
const [h0, h1, h2, h3] = CITY.map.home, [hx, hy] = px(h2, h1), [hx2, hy2] = px(h0, h3);

const map = {
  kind: 'urban',
  proj: { cx, cy, k, s, w: W, h: H },
  sea: [],
  water: [
    path([[47.575, -121.95], [47.56, -121.88], [47.545, -121.84], [47.52, -121.80], [47.50, -121.77], [47.48, -121.72], [47.46, -121.65], [47.455, -121.65], [47.475, -121.72], [47.495, -121.77], [47.515, -121.80], [47.54, -121.84], [47.555, -121.88], [47.57, -121.95]], true), // the river
    path([[47.43, -121.86], [47.445, -121.83], [47.44, -121.80], [47.425, -121.81], [47.42, -121.85]], true), // Pearl Lakes
  ],
  roads: {
    motorway: path([[47.40, -121.95], [47.46, -121.86], [47.48, -121.80], [47.47, -121.70], [47.45, -121.65]]),
    primary: path([[47.60, -121.79], [47.54, -121.80], [47.4945, -121.786], [47.44, -121.78], [47.40, -121.77]]),
  },
  labels: CITY.map.labels.map((l) => ({ name: l.name, kind: l.kind || 'town', anchor: l.anchor, xy: px(l.lat, l.lon) })),
  home: [hx, hy, Math.round((hx2 - hx) * 10) / 10, Math.round((hy2 - hy) * 10) / 10],
  credit: 'A made-up town: no map data was read.',
};
writeFileSync(new URL('../site/local-map.json', import.meta.url), JSON.stringify(map) + '\n');
console.log('site/local-map.json', JSON.stringify(map).length, 'bytes; home', map.home);
