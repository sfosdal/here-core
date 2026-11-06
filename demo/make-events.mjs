// Twin Peaks' events: the same 40 rows every time, dated from a start day.
//   node demo/make-events.mjs            → site/events.json, from today (for the page in a browser)
//   node demo/make-events.mjs --fixture  → lambda/fixture-events.json, from 2026-11-05 (fixed: the Lambda test)
// Every feature the list draws is in here: each home club (Steelheads games
// to filter), sold-out and free rows, a film at the movie venue, a weekly
// series, a festival's three days, an all-day expo, a show title that names
// owls without being an Owls match, broadcasts on a game.
import { writeFileSync } from 'node:fs';

const fixture = process.argv.includes('--fixture');
const start = fixture ? '2026-11-05' : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const day = (n) => { const d = new Date(start + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const X = 'https://twinpeaks.example/';
const ev = (n, venue, title, time, extra = {}) => ({ venue, title, date: day(n), time, url: X + 'e/' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...extra });

const events = [
  ev(0, 'Expo Barn', 'Snoqualmie Valley Logging Show', '', { type: 'expo' }),
  ev(0, 'Bijou Cinema', 'The Man from Another Place', '15:30:00', { movie: true, end: '17:20:00' }),
  ev(0, 'Great Northern Hotel', 'Audrey\'s Dance — A Recital', '19:30:00', { type: 'arts', capacity: 560, soldOut: true }),
  ev(0, 'Roadhouse', 'Julee Cruise Tribute Night', '21:00:00', { type: 'concert', age21: true }),
  ev(1, 'Double R Diner', 'Cherry Pie Thursday', '18:00:00', { type: 'bar', free: true }),
  ev(1, 'Timber Arena', 'Twin Peaks Steelheads vs. Spokane Chiefs', '19:05:00', { type: 'sports', watch: { tv: ['TPTV 4'], radio: ['KTWP 1240 AM'] } }),
  ev(2, 'Grange Hall', 'Log Lady Lecture Series', '19:00:00', { type: 'community' }),
  ev(2, 'Roadhouse', 'The Owls Are Not What They Seem', '20:30:00', { type: 'concert' }),
  ev(3, 'Timber Arena', 'Twin Peaks Steelheads vs. Everett Silvertips', '18:05:00', { type: 'sports', soldOut: true, capacity: 7900 }),
  ev(3, 'Bijou Cinema', 'Fire Walk With Me (35mm)', '21:00:00', { movie: true, end: '23:15:00' }),
  ev(4, 'Packard Field', 'Twin Peaks Loggers vs. Yakima Fir', '13:00:00', { type: 'sports' }),
  ev(4, 'Great Northern Hotel', 'Pinecone Gala', '18:00:00', { type: 'arts' }),
  ev(5, 'Timber Arena', 'Bobby & the Briggs — The Arena Tour', '19:30:00', { type: 'concert', capacity: 7400 }),
  ev(6, 'Packard Field', 'Twin Peaks Owls vs. Tacoma Defiance', '19:00:00', { type: 'sports' }),
  ev(6, 'Grange Hall', 'Bookhouse Boys Pancake Breakfast', '08:00:00', { type: 'community', free: true }),
  ev(7, 'Roadhouse', 'Chromatics', '21:00:00', { type: 'concert', soldOut: true }),
  ev(8, 'Double R Diner', 'Cherry Pie Thursday', '18:00:00', { type: 'bar', free: true }),
  ev(8, 'Timber Arena', 'Twin Peaks Steelheads vs. Portland Winterhawks', '19:05:00', { type: 'sports' }),
  ev(9, 'Great Northern Hotel', 'Invitation to Love — Staged Reading', '19:30:00', { type: 'arts' }),
  ev(10, 'Bijou Cinema', 'Black Lodge Shorts', '19:00:00', { movie: true, end: '20:40:00' }),
  ev(11, 'Packard Field', 'Twin Peaks Timbermen vs. Spokane Indians', '18:35:00', { type: 'sports' }),
  ev(12, 'Expo Barn', 'Northwest Woodcarvers Fair', '', { type: 'expo' }),
  ev(13, 'Timber Arena', 'Twin Peaks Steelheads vs. Seattle Thunderbirds', '17:05:00', { type: 'sports' }),
  ev(13, 'Roadhouse', 'Rebekah Del Rio', '20:00:00', { type: 'concert', age21: true }),
  ev(15, 'Double R Diner', 'Cherry Pie Thursday', '18:00:00', { type: 'bar', free: true }),
  ev(16, 'Packard Mill Days', 'Packard Mill Days — Day 1', '11:00:00', { type: 'community' }),
  ev(17, 'Packard Mill Days', 'Packard Mill Days — Day 2', '11:00:00', { type: 'community' }),
  ev(18, 'Packard Mill Days', 'Packard Mill Days — Day 3', '11:00:00', { type: 'community' }),
  ev(18, 'Timber Arena', 'Twin Peaks Steelheads vs. Kelowna Rockets', '19:05:00', { type: 'sports', soldOut: true }),
  ev(19, 'Great Northern Hotel', 'Winter Quartet', '19:30:00', { type: 'arts' }),
  ev(20, 'Grange Hall', 'Miss Twin Peaks Rehearsal', '18:00:00', { type: 'community' }),
  ev(21, 'Miss Twin Peaks', 'Miss Twin Peaks Pageant', '19:00:00', { type: 'community' }),
  ev(22, 'Double R Diner', 'Cherry Pie Thursday', '18:00:00', { type: 'bar', free: true }),
  ev(23, 'Roadhouse', 'Trouble', '21:00:00', { type: 'concert', soldOut: true }),
  ev(24, 'Timber Arena', 'Twin Peaks Steelheads vs. Vancouver Giants', '19:05:00', { type: 'sports' }),
  ev(25, 'Bijou Cinema', 'Wrapped in Plastic: A Documentary', '19:00:00', { movie: true }),
  ev(26, 'Packard Field', 'Twin Peaks Loggers vs. Ellensburg Pines', '13:00:00', { type: 'sports' }),
  ev(27, 'Great Northern Hotel', 'Holiday Ball', '20:00:00', { type: 'arts', soldOut: true }),
  ev(28, 'Expo Barn', 'Winter Craft Market', '', { type: 'expo', free: true }),
  ev(29, 'Roadhouse', 'New Year\'s Eve at the Roadhouse', '21:00:00', { type: 'concert', soldOut: true, age21: true }),
];
const out = { generated: start + 'T20:00:00.000Z', events };
const path = new URL(fixture ? '../lambda/fixture-events.json' : '../site/events.json', import.meta.url);
writeFileSync(path, JSON.stringify(out, null, 1) + '\n');
console.log(`${events.length} events from ${start} → ${path.pathname}`);
