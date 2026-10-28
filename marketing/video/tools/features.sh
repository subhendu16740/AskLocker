#!/usr/bin/env bash
# Every feature short, with its sound, and every feature poster:
#   out/asklocker-feature-<name>-9x16.mp4 (and -sfx-only.mp4), out/posters/*.png
# usage: tools/features.sh [feature ...]   (all of them when none is named;
#        the names are FEATURES' keys in src/features.js)
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(ask read voice reminders tree emergency share vaults fingerprint
  biz-capture biz-ask biz-overview biz-reminders biz-team biz-share biz-access biz-sheets)
if [ $# -gt 0 ]; then FEATURES=("$@"); else FEATURES=("${ALL[@]}"); fi

for f in "${FEATURES[@]}"; do
  node tools/render.mjs --film features --feature "$f" --portrait
  tools/mux.sh "feature-$f-9x16"
done
node tools/posters.mjs --features "$(IFS=,; echo "${FEATURES[*]}")"
