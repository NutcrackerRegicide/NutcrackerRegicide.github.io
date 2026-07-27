#!/usr/bin/env bash
# REGICIDE — tools/music.sh — the anthem pipeline (v123)
#
# Turns whatever John drops in "potential sounds/music/" into the six age0-5.ogg the game loads.
# The songs are due to be replaced wholesale, so this exists to make that a one-command job rather
# than six hand-run ffmpeg lines with settings nobody remembers.
#
#   ./tools/music.sh                       # convert using the mapping below, report before/after
#   ./tools/music.sh --dry                 # show what it WOULD do
#   MUSIC_Q=3 MUSIC_AC=2 ./tools/music.sh  # override the encode (see the table)
#
# ---------------------------------------------------------------------------------------------
# WHY MONO AT q1 (measured, not guessed — see the table in the v123 handoff):
#   Encoding a 2-minute excerpt of "Stone Age" every way and comparing each result's spectrum
#   against the source gave, per age0:
#       stereo q3 (what shipped)  4.86 MB  105 kbps   10.02 dB mean spectral error
#       stereo q1                 3.45 MB   74 kbps   12.31 dB
#       stereo q0                 2.73 MB   59 kbps   16.35 dB
#       mono   q3                 3.09 MB   66 kbps    9.72 dB   <- BETTER than what ships today
#       mono   q1                 2.72 MB   59 kbps   11.71 dB   <- same size as stereo q0, far better
#       mono   q0                 2.17 MB   47 kbps   15.37 dB
#   At a given file size mono beats stereo comfortably, because every bit goes into one channel.
#   The anthems are a BACKGROUND bed — ducked to 0.33 under the SFX bus and trimmed again by
#   MUSTRIM 0.42 — and a phone speaker is mono anyway, so the stereo image was buying little.
#   CAVEAT worth knowing: that metric downmixes to mono before comparing, so it is blind to
#   stereo-image loss by construction. If the new tracks are ones you want in stereo on desktop
#   headphones, run with MUSIC_AC=2 MUSIC_Q=1 and accept ~36 MB instead of ~28 MB.
# ---------------------------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${MUSIC_SRC:-../potential sounds/music}"
OUT="audio/music"
Q="${MUSIC_Q:-1}"      # vorbis quality
AC="${MUSIC_AC:-1}"    # channels: 1 mono, 2 stereo
AR="${MUSIC_AR:-44100}"
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1

# age -> source file. EDIT THIS when the songs are replaced; nothing else needs to change.
declare -a MAP=(
  "0|Stone Age.mp3"
  "1|Bronze Age Up2.mp3"
  "2|Iron Age Up2.mp3"
  "3|Classical Era Age Up.mp3"
  "4|Medieval Era Age Up.mp3"
  "5|Enlightenment Era Age Up.mp3"
)

command -v ffmpeg >/dev/null || { echo "ffmpeg not found"; exit 1; }
mkdir -p "$OUT"
printf "%-32s %9s %9s %8s %7s\n" "track" "was" "now" "saved" "secs"
before=0; after=0
for row in "${MAP[@]}"; do
  age="${row%%|*}"; file="${row#*|}"
  in="$SRC/$file"; dst="$OUT/age$age.ogg"
  [ -f "$in" ] || { echo "MISSING: $in"; exit 1; }
  old=0; [ -f "$dst" ] && old=$(stat -c%s "$dst")
  if [ "$DRY" = "1" ]; then
    printf "%-32s %9s %9s %8s %7s\n" "$file" "$old" "(dry)" "-" "-"
    continue
  fi
  # -vn strips the cover art Suno embeds, which otherwise rides along as a video stream
  ffmpeg -v error -y -i "$in" -vn -ac "$AC" -ar "$AR" -q:a "$Q" "$dst"
  new=$(stat -c%s "$dst")
  secs=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dst")
  before=$((before+old)); after=$((after+new))
  printf "%-32s %8.2fM %8.2fM %7s%% %7.0f\n" "$file" \
    "$(echo "scale=2;$old/1048576"|bc)" "$(echo "scale=2;$new/1048576"|bc)" \
    "$([ "$old" -gt 0 ] && echo "scale=0;100-100*$new/$old"|bc || echo "-")" "$secs"
done
[ "$DRY" = "1" ] && exit 0
echo "---"
printf "TOTAL  %.1f MB -> %.1f MB   (%s%% smaller, ac=%s q=%s)\n" \
  "$(echo "scale=2;$before/1048576"|bc)" "$(echo "scale=2;$after/1048576"|bc)" \
  "$(echo "scale=0;100-100*$after/$before"|bc)" "$AC" "$Q"
echo "Now run: node tools/browsercheck.js   (it loads all six and asserts the durations)"
