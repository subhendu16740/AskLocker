#!/usr/bin/env bash
# The films' cuts, with sound: out/asklocker-<film>-<16x9|9x16>[-short].mp4
# (and -sfx-only.mp4).
# usage: tools/films.sh [tag ...]   e.g. tools/films.sh business-9x16 family-16x9-short
#        (all eight when none is named)
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(family-16x9 family-9x16 family-16x9-short family-9x16-short
  business-16x9 business-9x16 business-16x9-short business-9x16-short)
if [ $# -gt 0 ]; then TAGS=("$@"); else TAGS=("${ALL[@]}"); fi

for tag in "${TAGS[@]}"; do
  args=(--film "${tag%%-*}")
  if [[ $tag == *9x16* ]]; then args+=(--portrait); fi
  if [[ $tag == *-short ]]; then args+=(--short); fi
  node tools/render.mjs "${args[@]}"
  tools/mux.sh "$tag"
done
