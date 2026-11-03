#!/usr/bin/env bash
# The launch film (src/locked.js), with sound, its six reels, and their covers.
# It says what is true once end-to-end encryption ships (src/claims.js), so
# nothing it makes is posted before the owner confirms the launch.
#   out/asklocker-locked-<16x9|9x16>-launch.mp4           the full film
#   out/asklocker-locked-<reel>-9x16-launch.mp4           the six reels: locker, who,
#                                                         asking, key, family, emergency
#   (and -sfx-only.mp4 of each, without the music)
#   out/posters/asklocker-locked-<cut>-cover-launch.png   each one's cover: the frame it names
# usage: tools/locked.sh [16x9 9x16 locker who asking key family emergency ...]   (all when none is named)
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(16x9 9x16 locker who asking key family emergency)
if [ $# -gt 0 ]; then CUTS=("$@"); else CUTS=("${ALL[@]}"); fi

mkdir -p out/posters
for cut in "${CUTS[@]}"; do
  case $cut in
    16x9) args=(--film locked --launch); tag=locked-16x9-launch ;;
    9x16) args=(--film locked --launch --portrait); tag=locked-9x16-launch ;;
    *) args=(--film locked --launch --reel "$cut" --portrait); tag="locked-$cut-9x16-launch" ;;
  esac
  node tools/render.mjs "${args[@]}"
  tools/mux.sh "$tag"
  still=$(node tools/render.mjs "${args[@]}" --stills hero | tail -1)
  cp "$still" "out/posters/asklocker-locked-$cut-cover-launch.png"
done
