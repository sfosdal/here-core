# /// script
# requires-python = ">=3.11"
# dependencies = ["curl_cffi"]
# ///
"""Monthly here.events link audit (Steve, 2026-11-06): read every venue and club link the live sites carry, and
report only what CHANGED since the last run. It never edits anything.

Flags a link as:
  dead      404/410, or the host no longer resolves (asked twice)
  moved     it now lands on another domain (HTTP or meta-refresh redirect)
  porn      the page reads as porn (a hijacked domain: tigresqr.com, 2026-11). Strip clubs are fine, so "nude"
            alone is not a flag; the test is whether the page is a local venue's.
  gambling  gambling-spam wording (slot gacor, togel, judi, ...), not a casino venue's own site
  parked    a parked or for-sale domain page
  empty     the page showed 3+ dates last time and none now
A link that cannot be read this time (a wall, a timeout, a 5xx) keeps last run's flags: walls come and go.

usage: uv run audit.py <links.json from extract.mjs> <state.json> <report.md>
exit 0 always when it ran; the report's first line is the summary the notification shows.
"""
import json, re, sys, time, datetime
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit, urljoin
from curl_cffi import requests

links_file, state_file, report_file = sys.argv[1:4]
data = json.load(open(links_file))
try:
    state = json.load(open(state_file))
except (FileNotFoundError, json.JSONDecodeError):
    state = None  # first run: a baseline

PORN = re.compile(r"\b(porn\w*|порн\w*|секс\w*|порево|xxx|hentai|xvideos|xhamster|sex (videos?|cams?|chat)|cam ?girls|adult videos?|onlyfans leaks?)\b", re.I)
GAMBLING = re.compile(r"\b(slot ?gacor|gacor|togel|judi (online|bola|slot)|situs (slot|judi|toto)|maxwin|rtp (live|slot)|sbobet|bandar (togel|judi)|slot ?(online|88|777)|casino online|1xbet|mostbet|pin-?up casino)\b", re.I)
PARKED = re.compile(r"(this domain (is|may be) for sale|buy this domain|domain is for sale|hugedomains|afternic|sedoparking|sedo\.com|dan\.com|parkingcrew|bodis\.com|domain parking|is parked free|parked domain)", re.I)
MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
DATES = re.compile(rf"\b{MON}\s+\d{{1,2}}\b|\b\d{{1,2}}\s+{MON}\b|\b20\d\d-\d\d-\d\d\b|\b\d{{1,2}}/\d{{1,2}}(/\d{{2,4}})?\b", re.I)
REFRESH = re.compile(r"""<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)""", re.I)
SLD = {"co", "com", "org", "net", "gov", "edu", "ac"}

def site_of(url):
    host = (urlsplit(url).hostname or "").lower()
    parts = host.split(".")
    n = 3 if len(parts) >= 3 and parts[-2] in SLD and len(parts[-1]) == 2 else 2
    return ".".join(parts[-n:])

def text_of(html):
    html = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", html)
    return re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", html))

def check(url):
    last = None
    for attempt in range(2):
        try:
            r = requests.get(url, impersonate="chrome", timeout=25, allow_redirects=True)
            final = str(r.url)
            body = r.text[:400_000] if "html" in (r.headers.get("content-type") or "") or r.text[:200].lstrip().startswith("<") else ""
            m = REFRESH.search(body[:20_000])
            if m:
                final = urljoin(final, m.group(1))
            if r.status_code in (404, 410):
                return {"read": True, "status": r.status_code, "final": final, "flags": ["dead"]}
            if r.status_code >= 400:
                last = {"read": False, "status": r.status_code, "final": final}
                time.sleep(3)
                continue
            title = (re.search(r"(?is)<title[^>]*>(.*?)</title>", body) or [None, ""])[1].strip()[:120]
            text = title + " " + text_of(body)[:200_000]
            flags = []
            if site_of(final) != site_of(url):
                flags.append("moved:" + site_of(final))
            if PORN.search(text):
                flags.append("porn")
            if GAMBLING.search(text):
                flags.append("gambling")
            if PARKED.search(text):
                flags.append("parked")
            return {"read": True, "status": r.status_code, "final": final, "title": title, "dates": len(DATES.findall(text)), "flags": flags}
        except Exception as err:  # DNS, refused, TLS, timeout
            msg = str(err).split("\n")[0][:160]
            dns = re.search(r"(resolve host|Could not resolve|Name or service not known|nodename nor servname)", msg)
            last = {"read": bool(dns) and attempt == 1, "status": 0, "error": msg, "flags": ["dead"] if dns else []}
            time.sleep(3)
    return last

links = data["links"]
with ThreadPoolExecutor(8) as pool:
    results = dict(zip([l["url"] for l in links], pool.map(check, [l["url"] for l in links])))

prev = (state or {}).get("links", {})
new_state, appeared, cleared, unread = {}, [], [], 0
for l in links:
    url, res = l["url"], results[l["url"]]
    old = prev.get(url, {})
    if not res.get("read"):
        unread += 1
        flags = old.get("flags", [])
        dates = old.get("dates")
    else:
        flags = list(res["flags"])
        dates = res.get("dates")
        if (old.get("dates") or 0) >= 3 and dates == 0 and "dead" not in flags:
            flags.append("empty")
    new_state[url] = {"flags": flags, "dates": dates, "final": res.get("final"), "title": res.get("title"), "status": res.get("status"), "uses": l["uses"]}
    if state is None:
        if flags:
            appeared.append((url, flags, res, l["uses"]))
        continue
    gained = [f for f in flags if f not in old.get("flags", [])]
    lost = [f for f in old.get("flags", []) if f not in flags]
    if gained:
        appeared.append((url, gained, res, l["uses"]))
    if lost and res.get("read"):
        cleared.append((url, lost, res, l["uses"]))

order = {"porn": 0, "gambling": 1, "parked": 2, "dead": 3, "empty": 5}
appeared.sort(key=lambda a: min(order.get(f.split(":")[0], 4) for f in a[1]))
today = datetime.date.today().isoformat()
def uses(u):
    return "; ".join(sorted({f"{x['site']} · {x['venue']} ({x['field']})" for x in u}))
def line(url, flags, res, u):
    extra = f" → {res.get('final')}" if res.get("final") and res.get("final") != url else ""
    title = f" — “{res['title']}”" if res.get("title") else ""
    return f"- **{', '.join(flags)}** {url}{extra}{title}\n  {uses(u)}"

if state is None:
    summary = f"here.events link audit {today}: baseline of {len(links)} links on {len(data['sites'])} sites — {len(appeared)} flagged now, {unread} unread"
else:
    summary = f"here.events link audit {today}: {len(appeared)} new problem{'s' * (len(appeared) != 1)}, {len(cleared)} cleared ({len(links)} links, {unread} unread)"
out = [summary, "", "Never edits anything. Fix a link in the city's site/city.js (the venue's own events page, from its own menu), then deploy.", ""]
if data.get("failed"):
    out += ["## Sites whose city.js could not be read", ""] + [f"- {f}" for f in data["failed"]] + [""]
out += [("## Flagged now (baseline)" if state is None else "## New since last run"), ""] + ([line(*a) for a in appeared] or ["- none"]) + [""]
if state is not None:
    out += ["## Cleared since last run", ""] + ([line(*c) for c in cleared] or ["- none"]) + [""]
open(report_file, "w").write("\n".join(out) + "\n")
json.dump({"run": today, "links": new_state}, open(state_file, "w"), indent=1)
print(summary)
