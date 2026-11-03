#!/usr/bin/env bash
# The launch film (src/locked.js), with sound, its six reels, and their covers,
# for a family or (with business first) for a business. It says what is true
# once end-to-end encryption ships (src/claims.js), so nothing it makes is
# posted before the owner confirms the launch.
#   out/asklocker-locked[-business]-<16x9|9x16>-launch.mp4          the full film
#   out/asklocker-locked[-business]-<reel>-9x16-launch.mp4          the six reels: locker, who,
#       asking, key, family, emergency (a business: locker, who, asking, key, share, team)
#   (and -sfx-only.mp4 of each, without the music)
#   out/posters/asklocker-locked[-business]-<cut>-cover-launch.png  each one's cover: the frame it names
# usage: tools/locked.sh [business] [16x9 9x16 <reel> ...]   (every cut when none is named)
set -euo pipefail
cd "$(dirname "$0")/.."
film=locked
ALL=(16x9 9x16 locker who asking key family emergency)
if [ "${1:-}" = business ]; then
  film=locked-business
  ALL=(16x9 9x16 locker who asking key share team)
  shift
fi
if [ $# -gt 0 ]; then CUTS=("$@"); else CUTS=("${ALL[@]}"); fi

mkdir -p out/posters
for cut in "${CUTS[@]}"; do
  case $cut in
    16x9) args=(--film "$film" --launch); tag=$film-16x9-launch ;;
    9x16) args=(--film "$film" --launch --portrait); tag=$film-9x16-launch ;;
    *) args=(--film "$film" --launch --reel "$cut" --portrait); tag="$film-$cut-9x16-launch" ;;
  esac
  node tools/render.mjs "${args[@]}"
  tools/mux.sh "$tag"
  still=$(node tools/render.mjs "${args[@]}" --stills hero | tail -1)
  cp "$still" "out/posters/asklocker-$film-$cut-cover-launch.png"
done
