#!/bin/bash
# tools/falsify.sh — MUTATION TESTING. Copy the repo, break one thing on purpose, and prove the
# gate that claims to cover it actually goes red. A gate that has only ever passed is untested.
#   usage: tools/falsify.sh <name> <sed-script-file> <grep-pattern-that-must-turn-FAIL>
set -u
NAME="$1"; MUT="$2"; PAT="$3"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="/tmp/fals_$NAME"
rm -rf "$DST"; mkdir -p "$DST"
# v134.0 …and css/, manifest.json and assets/ too. Without them the control run — no mutation at
# all — came back with ONE failure ("every SHELL entry resolves to a real file"), which is a noisy
# baseline: a harness that always shows a red teaches you to read past the reds.
cp -r "$SRC/js" "$SRC/tools" "$SRC/libs" "$SRC/css" "$SRC/assets" \
      "$SRC/index.html" "$SRC/sw.js" "$SRC/manifest.json" "$SRC/package.json" "$DST/" 2>/dev/null
ln -sfn "$SRC/node_modules" "$DST/node_modules"
bash "$MUT" "$DST" || { echo "MUTATION FAILED TO APPLY"; exit 2; }
cd "$DST"
OUT=$(timeout 500 node tools/smoketest.js 2>&1)
echo "$OUT" | grep -E "$PAT" | sed 's/^ *//' | cut -c1-150
TOT=$(echo "$OUT" | grep -c "FAIL —")
# v134.3 A RUN THAT NEVER REACHED ITS VERDICT IS NOT A PASS. A mutation that throws — or one written
# carelessly enough to take a line of real code out with its comment, which is exactly how this was
# found — kills the process partway through, prints no FAIL line at all, and was reported here as
# "0 total failures": the harness saying the gate did not notice, when the truth was that nothing
# had finished looking. Zero failures has to mean the suite ran to the end and found nothing.
if ! echo "$OUT" | grep -qE "ALL SMOKE TESTS PASSED|FAILURES"; then
  echo "--- $NAME: SUITE DID NOT FINISH (crash or timeout) — this is not a fair test of the gate ---"
  echo "$OUT" | tail -3 | sed 's/^/    /'
  exit 3
fi
echo "--- $NAME: $TOT total failures ---"
