#!/usr/bin/env bash
# The privacy film, with sound (src/privacy.js), and its covers:
#   out/asklocker-privacy-<16x9|9x16>.mp4            the full film
#   out/asklocker-privacy-<reel>-9x16.mp4            the four reels: ai, who, where, control
#   (and -sfx-only.mp4 of each, without the music)
#   out/posters/asklocker-privacy-<cut>-cover.png    each one's cover: the frame it names
# usage: tools/privacy.sh [16x9 9x16 ai who where control ...]   (all when none is named)
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(16x9 9x16 ai who where control)
if [ $# -gt 0 ]; then CUTS=("$@"); else CUTS=("${ALL[@]}"); fi

mkdir -p out/posters
for cut in "${CUTS[@]}"; do
  case $cut in
    16x9) args=(--film privacy); tag=privacy-16x9 ;;
    9x16) args=(--film privacy --portrait); tag=privacy-9x16 ;;
    *) args=(--film privacy --reel "$cut" --portrait); tag="privacy-$cut-9x16" ;;
  esac
  node tools/render.mjs "${args[@]}"
  tools/mux.sh "$tag"
  still=$(node tools/render.mjs "${args[@]}" --stills hero | tail -1)
  cp "$still" "out/posters/asklocker-privacy-$cut-cover.png"
done
