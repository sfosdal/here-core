#!/bin/zsh
# One monthly here.events link audit (launchd: net.fosdal.here-link-audit, the 1st at 10:17; by hand: this script).
# Reads the deployed sites' links (extract.mjs), checks them from this Mac (audit.py, curl_cffi via uv), and writes a
# report of what CHANGED since the last run to ~/Library/Logs/here-events-link-audit/<date>.md (latest.md = the
# newest), then posts a notification. It never edits a city. State between runs:
# ~/Library/Application Support/here-events-link-audit/state.json (delete it to start a new baseline).
set -u
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
export HOME=${HOME:-/Users/sfosdal}
DIR=${0:A:h}
OUT=$HOME/Library/Logs/here-events-link-audit
STATE=$HOME/Library/Application\ Support/here-events-link-audit
LOCK=/tmp/here-link-audit.lock
mkdir -p "$OUT" "$STATE"
exec >>"$OUT/run.log" 2>&1
echo "== $(date '+%Y-%m-%d %H:%M:%S') start"
if ! mkdir "$LOCK" 2>/dev/null; then echo "another run holds $LOCK — skipped"; exit 0; fi
trap 'rm -rf "$LOCK"' EXIT
DAY=$(date +%F)
TMP=$(mktemp -d /tmp/here-link-audit.XXXXXX)
node "$DIR/extract.mjs" > "$TMP/links.json" || { echo "extract failed"; osascript -e 'display notification "Could not read the sites'"'"' city.js — see ~/Library/Logs/here-events-link-audit/run.log" with title "here.events link audit"'; exit 1; }
node -e "import('$DIR/../../scripts/links.mjs').then((m) => process.stdout.write(JSON.stringify(m.HIJACK)))" > "$TMP/patterns.json" || { echo "patterns not read"; exit 1; }
SUMMARY=$(uv run --quiet "$DIR/audit.py" "$TMP/links.json" "$STATE/state.json" "$OUT/$DAY.md" "$TMP/patterns.json") || { echo "audit failed"; osascript -e 'display notification "The audit failed — see ~/Library/Logs/here-events-link-audit/run.log" with title "here.events link audit"'; exit 1; }
ln -sf "$OUT/$DAY.md" "$OUT/latest.md"
echo "$SUMMARY"
MSG=${SUMMARY#*: }
osascript -e "display notification \"${MSG//\"/} — ~/Library/Logs/here-events-link-audit/latest.md\" with title \"here.events link audit\""
rm -rf "$TMP"
echo "== $(date '+%Y-%m-%d %H:%M:%S') done"
