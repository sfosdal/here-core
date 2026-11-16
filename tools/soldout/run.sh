#!/bin/zsh
# One sold-out run for every here.events site: Ticketmaster availability as a real
# browser sees it (its edge blocks GitHub's runners), read from this Mac for each
# site's upcoming Ticketmaster and TicketWeb links and pushed as one file,
# soldout.json on this repo's `soldout` branch, which every city's noon build reads
# (scripts/build.mjs SOLDOUT_URL). launchd runs it twice a day,
# tools/soldout/net.fosdal.here-soldout.plist. By hand:
#   tools/soldout/run.sh [--limit N]      NO_PUSH=1 leaves the file uncommitted
# Log: ~/Library/Logs/here-soldout.log
#
# The list is every live site in site/cities.js. The events lqa-events' own job
# already answers for (scripts/soldout-run.sh there: Seattle Center's venues, and
# the clubs' away games) are left to it: SKIP_URL is its file.
# About 10 s an event and thousands of events, so a run has a budget
# (BUDGET_MIN) and asks the events longest unasked first: run after run works
# round the list. DAYS is how far ahead it looks.
set -u
export PATH=$HOME/.orbstack/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin   # .orbstack/bin: docker and its credential helper (an image build needs it)
export HOME=${HOME:-/Users/sfosdal}
CORE=${0:A:h:h:h}
RUN=$HOME/repos/here-core-soldout          # a worktree of this repo on the `soldout` branch: just the data file
DOCKER=($HOME/.orbstack/bin/docker --context orbstack)
NAME=here-soldout-browser
PORT=9224                                  # lqa's job publishes 9222
LOG=$HOME/Library/Logs/here-soldout.log
LOCK=/tmp/here-soldout.lock
BUDGET_MIN=${BUDGET_MIN:-150}
DAYS=${DAYS:-30}
SKIP_SITES=${SKIP_SITES-}                  # hosts to leave out, space-separated
SKIP_URL=${SKIP_URL-https://raw.githubusercontent.com/sfosdal/lqa-events/main/scripts/data/soldout.json}
exec >>"$LOG" 2>&1
echo "== $(date '+%Y-%m-%d %H:%M:%S') start ($*)"
if ! mkdir "$LOCK" 2>/dev/null; then echo "another run holds $LOCK — skipped"; exit 0; fi
trap 'rm -rf "$LOCK"; "${DOCKER[@]}" rm -f "$NAME" >/dev/null 2>&1' EXIT

# the data checkout: the `soldout` branch as published (made here, with no history in common with main, the first time)
if [[ ! -e $RUN/.git ]]; then
  git -C "$CORE" fetch -q origin soldout 2>/dev/null
  if git -C "$CORE" rev-parse -q --verify origin/soldout >/dev/null; then
    git -C "$CORE" worktree add -q -B soldout "$RUN" origin/soldout || { echo "worktree add failed"; exit 1; }
  else
    git -C "$CORE" worktree add -q --detach "$RUN" || { echo "worktree add failed"; exit 1; }
    git -C "$RUN" checkout -q --orphan soldout && git -C "$RUN" rm -rfq . || { echo "soldout branch not made"; exit 1; }
  fi
elif git -C "$RUN" fetch -q origin soldout 2>/dev/null; then
  git -C "$RUN" reset -q --hard origin/soldout || { echo "reset to origin/soldout failed"; exit 1; }
fi

SITES=$(node -e '
  const vm = require("vm"), ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(require("fs").readFileSync(process.argv[1] + "/site/cities.js", "utf8"), ctx);
  const skip = new Set(process.argv[2].split(/\s+/).filter(Boolean));
  console.log(ctx.window.LQACities.cities.filter((c) => c.live && c.url && !skip.has(new URL(c.url).host)).map((c) => c.url).join(","));
' "$CORE" "$SKIP_SITES") || { echo "site list not read"; exit 1; }
[[ -n $SITES ]] || { echo "no sites"; exit 1; }

if ! "${DOCKER[@]}" info >/dev/null 2>&1; then
  echo "OrbStack not answering — starting it"
  orb start >/dev/null 2>&1
  for i in {1..60}; do "${DOCKER[@]}" info >/dev/null 2>&1 && break; sleep 2; done
fi
# the image: lqa's job builds the same Dockerfile, so its image is taken when it is there (a build under
# launchd can stop at the keychain: Docker Hub's credential helper wants a login session)
if ! "${DOCKER[@]}" image inspect "$NAME" >/dev/null 2>&1 && "${DOCKER[@]}" image inspect lqa-soldout-browser >/dev/null 2>&1; then
  "${DOCKER[@]}" tag lqa-soldout-browser "$NAME"
fi
if ! "${DOCKER[@]}" image inspect "$NAME" >/dev/null 2>&1; then
  "${DOCKER[@]}" build -q -t "$NAME" "$CORE/tools/soldout/browser" >/dev/null || { echo "image build failed"; exit 1; }
fi
"${DOCKER[@]}" rm -f "$NAME" >/dev/null 2>&1
"${DOCKER[@]}" run -d --name "$NAME" -p 127.0.0.1:$PORT:9222 "$NAME" >/dev/null || { echo "container start failed (is OrbStack running?)"; exit 1; }
for i in {1..30}; do curl -sf -m 2 http://127.0.0.1:$PORT/json/version >/dev/null && break; sleep 1; done

# the checker in the background: no idle sleep while it runs, and a watchdog a
# little past the budget so a hung run never blocks the next fire
WATCHDOG_SECS=$(( BUDGET_MIN * 60 + 900 ))
cd "$CORE" || exit 1
CDP_URL=http://127.0.0.1:$PORT SOLDOUT_FEEDS=$SITES SOLDOUT_OUT=$RUN/soldout.json SOLDOUT_DAYS=$DAYS SOLDOUT_BUDGET_MIN=$BUDGET_MIN SOLDOUT_SKIP_URL=$SKIP_URL \
  node scripts/soldout-check.mjs "$@" & CHECK=$!
caffeinate -i -w $CHECK &
( for ((s = 0; s < WATCHDOG_SECS; s += 30)); do sleep 30; kill -0 $CHECK 2>/dev/null || exit 0; done
  kill $CHECK 2>/dev/null && echo "watchdog: checker still running after ${WATCHDOG_SECS}s — killed" ) &
wait $CHECK; RC=$?
"${DOCKER[@]}" rm -f "$NAME" >/dev/null 2>&1
(( RC == 0 )) || { echo "checker failed (exit $RC) — nothing committed"; exit 1; }

if [[ -n "${NO_PUSH:-}" ]]; then echo "NO_PUSH set — not committing"; ls -l "$RUN/soldout.json"; exit 0; fi
cd "$RUN" || exit 1
git add soldout.json
if git diff --cached --quiet; then echo "no change"; exit 0; fi
git -c user.name="Steve Fosdal" -c user.email=steve@fosdal.net commit -q -m "Sold-out status, $(date '+%b %-d %H:%M')" || { echo "commit failed"; exit 1; }
git push -q origin HEAD:soldout && echo "pushed $(git rev-parse --short HEAD)" || echo "push failed — will retry next run"
