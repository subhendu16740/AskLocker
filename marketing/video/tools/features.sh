#!/usr/bin/env bash
# Every feature short, with its sound, and every feature poster:
#   out/asklocker-feature-<name>-9x16.mp4 (and -sfx-only.mp4), out/posters/*.png
# usage: tools/features.sh [feature ...]   (all of them when none is named;
#        the names are FEATURES' keys in src/features.js)
#        LAUNCH=1 tools/features.sh   the launch set (src/claims.js): files end
#        -launch, never posted before end-to-end encryption ships
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(ask read voice reminders tree emergency share vaults fingerprint
  biz-capture biz-ask biz-overview biz-reminders biz-team biz-share biz-access biz-sheets)
if [ $# -gt 0 ]; then FEATURES=("$@"); else FEATURES=("${ALL[@]}"); fi
launch=()
suffix=''
if [ "${LAUNCH:-}" = 1 ]; then launch=(--launch); suffix='-launch'; fi

for f in "${FEATURES[@]}"; do
  node tools/render.mjs --film features --feature "$f" --portrait "${launch[@]}"
  tools/mux.sh "feature-$f-9x16$suffix"
done
node tools/posters.mjs --features "$(IFS=,; echo "${FEATURES[*]}")" "${launch[@]}"
