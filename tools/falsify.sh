#!/bin/bash
# tools/falsify.sh — MUTATION TESTING. Copy the repo, break one thing on purpose, and prove the
# gate that claims to cover it actually goes red. A gate that has only ever passed is untested.
#   usage: tools/falsify.sh <name> <sed-script-file> <grep-pattern-that-must-turn-FAIL>
set -u
NAME="$1"; MUT="$2"; PAT="$3"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="/tmp/fals_$NAME"
rm -rf "$DST"; mkdir -p "$DST"
cp -r "$SRC/js" "$SRC/tools" "$SRC/libs" "$SRC/index.html" "$SRC/sw.js" "$SRC/package.json" "$DST/" 2>/dev/null
ln -sfn "$SRC/node_modules" "$DST/node_modules"
bash "$MUT" "$DST" || { echo "MUTATION FAILED TO APPLY"; exit 2; }
cd "$DST"
OUT=$(timeout 500 node tools/smoketest.js 2>&1)
echo "$OUT" | grep -E "$PAT" | sed 's/^ *//' | cut -c1-150
TOT=$(echo "$OUT" | grep -c "FAIL —")
echo "--- $NAME: $TOT total failures ---"
