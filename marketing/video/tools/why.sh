#!/usr/bin/env bash
# The why films (src/why.js), with sound, and their covers:
#   out/asklocker-why-<founder|family|business>-<16x9|9x16>.mp4   (and -sfx-only.mp4)
#   out/posters/asklocker-why-<story>-<16x9|9x16>-cover.png       the frame each names
# They make no claim about encryption, so they are rendered without --launch
# and can be posted today.
# usage: tools/why.sh [founder family business ...]   (all three when none is named)
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(founder family business)
if [ $# -gt 0 ]; then STORIES=("$@"); else STORIES=("${ALL[@]}"); fi

mkdir -p out/posters
for story in "${STORIES[@]}"; do
  for shape in 16x9 9x16; do
    args=(--film why --reel "$story")
    [ "$shape" = 9x16 ] && args+=(--portrait)
    tag="why-$story-$shape"
    node tools/render.mjs "${args[@]}"
    tools/mux.sh "$tag"
    still=$(node tools/render.mjs "${args[@]}" --stills hero | tail -1)
    cp "$still" "out/posters/asklocker-why-$story-$shape-cover.png"
  done
done
