#!/bin/bash
# Build the page and load it once in headless Chrome. Prints script errors and saves the rendered DOM.
#   tools/smoke.sh <view> [plugins] [click-selectors]
#   view     tab to open, e.g. race, outright, teams
#   plugins  "all" (default), "none", or a comma list of plugin names without extension
#   clicks   CSS selectors separated by |, clicked one after another before the DOM is saved
# Output: .smoke/<view>.html (rendered DOM) and one line: SMOKE OK or SMOKE ERRORS followed by the errors.
# Only one run at a time (a lock directory prevents parallel Chrome runs).
set -u
cd "$(dirname "$0")/.."
VIEW="${1:-race}"; PLUG="${2:-all}"; CLICKS="${3:-}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p .smoke
LOCK=.smoke/lock; n=0
until mkdir "$LOCK" 2>/dev/null; do n=$((n+1)); [ $n -gt 240 ] && { echo "SMOKE LOCK TIMEOUT"; exit 3; }; perl -e 'select(undef,undef,undef,0.5)'; done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
OUT="$PWD/.smoke/page-$$.html"
PLUGINS="$PLUG" node build.mjs "$OUT" >/dev/null || { echo "SMOKE BUILD FAILED"; exit 2; }
ENC=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$CLICKS")
PROFILE=$(mktemp -d)
perl -e 'alarm 60; exec @ARGV' "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$PROFILE" --window-size=1440,900 \
  --virtual-time-budget=9000 --dump-dom "file://$OUT?smoke=1&click=$ENC#$VIEW" > ".smoke/$VIEW.html" 2>/dev/null
rm -rf "$PROFILE" "$OUT"
RES=$(python3 - ".smoke/$VIEW.html" <<'PY'
import re,sys,html
s=open(sys.argv[1],encoding='utf8',errors='replace').read()
m=re.search(r'<pre id="__smoke"[^>]*>(.*?)</pre>',s,re.S)
print(html.unescape(m.group(1)) if m else 'NO_SMOKE_MARKER (page did not finish loading)')
PY
)
if [ "$RES" = "NO_ERRORS" ]; then echo "SMOKE OK $VIEW (plugins: $PLUG) -> .smoke/$VIEW.html"; else echo "SMOKE ERRORS $VIEW (plugins: $PLUG):"; echo "$RES"; exit 1; fi
