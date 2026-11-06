# here-core

The shared part of every here.events calendar: the browser scripts, the
stylesheet, the build and feed scripts, the calendar-feed Lambda and their
tests. A city repo (`sfosdal/<city>-events`, lqa-events among them) holds
copies of these files beside its own: `site/city.js`, its pages, its venue
readers (`scripts/fetch-events.mjs`, `scripts/sources.mjs`) and the venue
hues in its styles.

Until 2026-11-05 lqa-events was both a city and the source of every shared
file. Now this repo is the source, and lqa-events is a city like the others.

## Twin Peaks, the test city

`site/city.js` is **Twin Peaks**, a made-up town (Steve, 2026-11-05). It has
four clubs, ten venues (two festivals among them), a share-code registry and
a hand-drawn map. Every URL is on the reserved `.example` domain, so nothing
is ever fetched. The tests run against it and give the same answer every
time:

    node --test scripts/*.test.mjs lambda/*.test.mjs

Cases that read a city's own teams, venues or share codes carry `skip: TP`.
They run here and are skipped in a real city, which keeps its own versions
in `scripts/city.test.mjs`. That file is the city's own and the sync never
writes it.

To see the page in a browser:

    node demo/make-events.mjs        # site/events.json: 40 rows dated from today (git-ignored)
    node demo/make-map.mjs           # site/local-map.json: the made-up map (committed)
    cd site && python3 -m http.server 8790

`node demo/make-events.mjs --fixture` rewrites `lambda/fixture-events.json`,
the same 40 rows fixed at 2026-11-05.

## Copying the shared files into cities

    tools/sync.py [--check] <city repo> ...

`--check` changes nothing and lists what would change.

- **`shared.txt` says what is shared:**
  - `always`: copied into every city;
  - `present`: copied only where the city already has the file, so a new
    shared script is copied in by hand once;
  - `styles`: the stylesheet, with the city's own `--v-*` venue hues kept;
  - `never`: a city's own file.
- **A city keeps more of its own in `.core-keep` at its repo root, one rule
  a line:**
  - `<path>`: the city's own copy; never written.
  - `<path> drop <regex>`: write the shared file, minus the matching lines.

  Big Island and Maui keep their island map scripts this way, and leave out
  the city-line style those scripts don't draw.

`~/Desktop/projects/lqa-events/sync-shared.sh` runs `tools/sync.py`.

Not shared yet: `index.html`, `faq.html`, `about.html` and `embed.js`.
Cities have their own copies, and the ones here are Twin Peaks' pages.
Templating their shared parts is a later step.
